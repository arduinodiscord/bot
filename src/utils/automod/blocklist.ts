import { container } from '@sapphire/framework';
import { automodConfig } from '../config';
import { getPrisma } from '../db';
import { hammingDistance } from './phash';

/**
 * Moderator-trained image lists, mirrored in memory so lookups never touch the
 * database on the hot path. Loaded from the database at startup (when one is
 * configured) and updated immediately on every moderator decision, so the
 * feature also works fully in-memory.
 *
 * Fingerprint kinds:
 * - `sha`: content id (SHA-256 of the proxy thumbnail bytes). Exact identity
 *   that an uploader cannot forge. The only kind that can trigger an auto-ban
 *   or an allowlist skip.
 * - `phash`: perceptual hash, matched within a Hamming distance. Catches
 *   re-encoded variants, but a lookalike can land within the threshold, so a
 *   near match is only ever treated as evidence, never as confirmation.
 * - `meta` rows (old metadata signatures, forgeable) are ignored on load.
 */
export type FingerprintKind = 'sha' | 'phash';
export type Severity = 'scam' | 'spam';

const blockExact = new Map<string, Severity>();
const blockNear = new Map<string, Severity>();
const allowExact = new Set<string>();

/** Total confirmed fingerprints in the blocklist (drives learning mode). */
export function blocklistSize(): number {
  return blockExact.size + blockNear.size;
}

/** Test-only reset. */
export function __resetBlocklist(): void {
  blockExact.clear();
  blockNear.clear();
  allowExact.clear();
}

const worse = (a: Severity | null, b: Severity | null): Severity | null =>
  a === 'scam' || b === 'scam' ? 'scam' : a ?? b;

/** Load the persisted lists into memory. Safe to call with no database. */
export async function loadBlocklist(): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;
  try {
    const rows = await prisma.spamSignature.findMany({
      select: { signature: true, kind: true, severity: true },
    });
    for (const { signature, kind, severity } of rows) {
      const sev: Severity = severity === 'scam' ? 'scam' : 'spam';
      if (kind === 'sha') blockExact.set(signature, sev);
      else if (kind === 'phash') blockNear.set(signature, sev);
    }
    const allowRows = await prisma.allowSignature.findMany({
      select: { signature: true, kind: true },
    });
    for (const { signature, kind } of allowRows) if (kind === 'sha') allowExact.add(signature);

    container.logger.info(
      `Automod: loaded ${blockExact.size} exact and ${blockNear.size} perceptual blocklist fingerprint(s), ${allowExact.size} allowlisted image(s).`
    );
  } catch (error) {
    container.logger.error('Loading blocklist failed:', error);
  }
}

export interface BlocklistMatch {
  /** Severity of an exact content match, if any. */
  exact: Severity | null;
  /** Severity of a perceptual near match, if any (and no exact match). */
  near: Severity | null;
}

/** Check an image's fingerprints against the blocklist. */
export function checkBlocklist(contentIds: string[], hashes: string[]): BlocklistMatch {
  let exact: Severity | null = null;
  for (const id of contentIds) exact = worse(exact, blockExact.get(id) ?? null);

  let near: Severity | null = null;
  if (!exact)
    for (const hash of hashes)
      for (const [known, sev] of blockNear)
        if (hammingDistance(hash, known) <= automodConfig.phashThreshold) near = worse(near, sev);

  return { exact, near };
}

/** Whether this exact image was marked "Not spam" by a moderator. */
export const isAllowlisted = (contentId: string): boolean => allowExact.has(contentId);

/**
 * Add fingerprints to the blocklist. Severity only ever escalates: an image
 * first confirmed as spam and later as scam becomes scam, in memory and in the
 * database, so auto-ban survives a restart.
 */
export async function addToBlocklist(
  contentIds: string[],
  hashes: string[],
  addedBy: string,
  reason: string,
  severity: Severity = 'spam'
): Promise<void> {
  const entries: Array<{ signature: string; kind: FingerprintKind }> = [
    ...contentIds.map((signature) => ({ signature, kind: 'sha' as const })),
    ...hashes.map((signature) => ({ signature, kind: 'phash' as const })),
  ];
  for (const { signature, kind } of entries) {
    const map = kind === 'sha' ? blockExact : blockNear;
    map.set(signature, worse(map.get(signature) ?? null, severity)!);
  }
  // The latest moderator decision wins: confirming an image that was once
  // marked "Not spam" removes it from the allowlist.
  for (const id of contentIds) allowExact.delete(id);

  const prisma = getPrisma();
  if (!prisma || entries.length === 0) return;
  try {
    if (contentIds.length > 0)
      await prisma.allowSignature.deleteMany({ where: { signature: { in: contentIds } } });
    await prisma.$transaction(
      entries.map(({ signature, kind }) =>
        prisma.spamSignature.upsert({
          where: { signature },
          create: { signature, kind, addedBy, reason, severity },
          // Escalate spam -> scam; never downgrade scam.
          update: severity === 'scam' ? { severity: 'scam', kind } : { kind },
        })
      )
    );
  } catch (error) {
    container.logger.error('Persisting blocklist fingerprints failed:', error);
  }
}

/**
 * Mark exact images as not spam. Only content ids are stored: a perceptual
 * allowlist would let a scam image that merely resembles an allowlisted one
 * skip every check.
 */
export async function addToAllowlist(
  contentIds: string[],
  addedBy: string,
  reason?: string
): Promise<void> {
  for (const id of contentIds) allowExact.add(id);
  const prisma = getPrisma();
  if (!prisma || contentIds.length === 0) return;
  try {
    await prisma.allowSignature.createMany({
      data: contentIds.map((signature) => ({ signature, kind: 'sha', addedBy, reason })),
      skipDuplicates: true,
    });
  } catch (error) {
    container.logger.error('Persisting allowlist fingerprints failed:', error);
  }
}

/**
 * Undo moderator training for these images: remove them from the blocklist
 * (memory and database). Used by "Not spam", so a wrong "Confirm scam" or
 * "Confirm spam" can be reversed instead of silently continuing to act.
 * Returns how many fingerprints were removed.
 */
export async function removeFromBlocklist(contentIds: string[], hashes: string[]): Promise<number> {
  let removed = 0;
  for (const id of contentIds) if (blockExact.delete(id)) removed++;
  for (const hash of hashes) if (blockNear.delete(hash)) removed++;
  const prisma = getPrisma();
  const all = [...contentIds, ...hashes];
  if (prisma && all.length > 0) {
    try {
      await prisma.spamSignature.deleteMany({ where: { signature: { in: all } } });
    } catch (error) {
      container.logger.error('Removing blocklist fingerprints failed:', error);
    }
  }
  return removed;
}
