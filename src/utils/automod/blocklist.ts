import { container } from '@sapphire/framework';
import { automodConfig } from '../config';
import { getPrisma } from '../db';
import { hammingDistance } from './phash';

/**
 * In-memory mirror of the blocklist, kept warm so lookups never touch the
 * database on the hot path. Populated from the database on startup (when one is
 * configured) and updated immediately whenever a moderator confirms spam, so
 * the feature works fully in-memory when no database is present.
 */
const exactSignatures = new Set<string>();
const perceptualHashes = new Set<string>();
const scamSignatures = new Set<string>(); // severity === 'scam' (meta)
const scamHashes = new Set<string>();     // severity === 'scam' (phash)
const allowSignatures = new Set<string>();
const allowHashes = new Set<string>();

export type FingerprintKind = 'meta' | 'phash';

export interface BlocklistMatch {
  blocked: boolean;
  severity: 'scam' | 'spam' | null;
  /** Fingerprints from the input that matched the blocklist. */
  matched: string[];
}

/** Load the persisted blocklist into memory. Safe to call with no database. */
export async function loadBlocklist(): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;
  try {
    const rows = await prisma.spamSignature.findMany({
      select: { signature: true, kind: true, severity: true },
    });
    for (const { signature, kind, severity } of rows) {
      (kind === 'phash' ? perceptualHashes : exactSignatures).add(signature);
      if (severity === 'scam')
        (kind === 'phash' ? scamHashes : scamSignatures).add(signature);
    }

    const allowRows = await prisma.allowSignature.findMany({
      select: { signature: true, kind: true },
    });
    for (const { signature, kind } of allowRows)
      (kind === 'phash' ? allowHashes : allowSignatures).add(signature);

    container.logger.info(
      `Automod: loaded ${exactSignatures.size} signature(s) and ${perceptualHashes.size} perceptual hash(es) from the blocklist (${scamSignatures.size + scamHashes.size} scam), ${allowSignatures.size + allowHashes.size} allowlist entry/entries.`
    );
  } catch (error) {
    container.logger.error('Loading blocklist failed:', error);
  }
}

/**
 * Check incoming fingerprints against the blocklist. Metadata signatures match
 * exactly; perceptual hashes match within the configured Hamming distance.
 */
export function isBlocklisted(
  signatures: string[],
  hashes: string[]
): BlocklistMatch {
  const matched = new Set<string>();

  for (const signature of signatures)
    if (exactSignatures.has(signature)) matched.add(signature);

  for (const hash of hashes)
    for (const known of perceptualHashes)
      if (hammingDistance(hash, known) <= automodConfig.phashThreshold) {
        matched.add(hash);
        break;
      }

  const blocked = matched.size > 0;

  let severity: 'scam' | 'spam' | null = null;
  if (blocked) {
    // Determine if any matched fingerprint is in the scam sets.
    let isScam = false;
    for (const m of matched) {
      if (scamSignatures.has(m)) { isScam = true; break; }
      for (const known of scamHashes)
        if (hammingDistance(m, known) <= automodConfig.phashThreshold) {
          isScam = true;
          break;
        }
      if (isScam) break;
    }
    severity = isScam ? 'scam' : 'spam';
  }

  return { blocked, severity, matched: [...matched] };
}

/**
 * Check if incoming fingerprints are in the allowlist. Allowlisted images
 * suppress spam alerts even when they cluster-match or blocklist-match.
 */
export function isAllowlisted(signatures: string[], hashes: string[]): boolean {
  if (signatures.some((s) => allowSignatures.has(s))) return true;
  for (const h of hashes)
    for (const known of allowHashes)
      if (hammingDistance(h, known) <= automodConfig.phashThreshold) return true;
  return false;
}

/** Add fingerprints to the blocklist (in-memory always; persisted if possible). */
export async function addToBlocklist(
  signatures: string[],
  hashes: string[],
  addedBy: string,
  reason: string,
  severity: 'scam' | 'spam' = 'spam'
): Promise<void> {
  for (const signature of signatures) {
    exactSignatures.add(signature);
    if (severity === 'scam') scamSignatures.add(signature);
  }
  for (const hash of hashes) {
    perceptualHashes.add(hash);
    if (severity === 'scam') scamHashes.add(hash);
  }

  const prisma = getPrisma();
  if (!prisma) return;

  const rows = [
    ...signatures.map((signature) => ({
      signature,
      kind: 'meta' as FingerprintKind,
      addedBy,
      reason,
      severity,
    })),
    ...hashes.map((signature) => ({
      signature,
      kind: 'phash' as FingerprintKind,
      addedBy,
      reason,
      severity,
    })),
  ];
  if (rows.length === 0) return;

  try {
    await prisma.spamSignature.createMany({ data: rows, skipDuplicates: true });
  } catch (error) {
    container.logger.error('Persisting blocklist fingerprints failed:', error);
  }
}

/** Add fingerprints to the allowlist (in-memory always; persisted if possible). */
export async function addToAllowlist(
  signatures: string[],
  hashes: string[],
  addedBy: string,
  reason?: string
): Promise<void> {
  for (const signature of signatures) allowSignatures.add(signature);
  for (const hash of hashes) allowHashes.add(hash);

  const prisma = getPrisma();
  if (!prisma) return;

  const rows = [
    ...signatures.map((signature) => ({
      signature,
      kind: 'meta' as FingerprintKind,
      addedBy,
      reason,
    })),
    ...hashes.map((signature) => ({
      signature,
      kind: 'phash' as FingerprintKind,
      addedBy,
      reason,
    })),
  ];
  if (rows.length === 0) return;

  try {
    await prisma.allowSignature.createMany({ data: rows, skipDuplicates: true });
  } catch (error) {
    container.logger.error('Persisting allowlist fingerprints failed:', error);
  }
}
