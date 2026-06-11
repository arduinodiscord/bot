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

export type FingerprintKind = 'meta' | 'phash';

export interface BlocklistMatch {
  blocked: boolean;
  /** Fingerprints from the input that matched the blocklist. */
  matched: string[];
}

/** Load the persisted blocklist into memory. Safe to call with no database. */
export async function loadBlocklist(): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;
  try {
    const rows = await prisma.spamSignature.findMany({
      select: { signature: true, kind: true },
    });
    for (const { signature, kind } of rows)
      (kind === 'phash' ? perceptualHashes : exactSignatures).add(signature);
    container.logger.info(
      `Automod: loaded ${exactSignatures.size} signature(s) and ${perceptualHashes.size} perceptual hash(es) from the blocklist.`
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

  return { blocked: matched.size > 0, matched: [...matched] };
}

/** Add fingerprints to the blocklist (in-memory always; persisted if possible). */
export async function addToBlocklist(
  signatures: string[],
  hashes: string[],
  addedBy: string,
  reason: string
): Promise<void> {
  for (const signature of signatures) exactSignatures.add(signature);
  for (const hash of hashes) perceptualHashes.add(hash);

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
    await prisma.spamSignature.createMany({ data: rows, skipDuplicates: true });
  } catch (error) {
    container.logger.error('Persisting blocklist fingerprints failed:', error);
  }
}
