import { container } from '@sapphire/framework';
import { getPrisma } from '../db';

/**
 * In-memory mirror of the blocklist. Always consulted first so the feature
 * works even with no database, and so confirmed-spam signatures take effect
 * immediately within the running process.
 */
const memory = new Set<string>();

export interface BlocklistMatch {
  blocked: boolean;
  matched: string[];
}

/** Check whether any of the given signatures is a known spam image. */
export async function isBlocklisted(
  signatures: string[]
): Promise<BlocklistMatch> {
  const matched = new Set(signatures.filter((s) => memory.has(s)));

  const prisma = getPrisma();
  if (prisma) {
    try {
      const rows = await prisma.spamSignature.findMany({
        where: { signature: { in: signatures } },
        select: { signature: true },
      });
      for (const row of rows) {
        matched.add(row.signature);
        memory.add(row.signature); // warm the in-memory cache
      }
    } catch (error) {
      container.logger.error('Blocklist lookup failed:', error);
    }
  }

  return { blocked: matched.size > 0, matched: [...matched] };
}

/** Add signatures to the blocklist (in-memory always; persisted if possible). */
export async function addToBlocklist(
  signatures: string[],
  addedBy: string,
  reason: string
): Promise<void> {
  for (const signature of signatures) memory.add(signature);

  const prisma = getPrisma();
  if (!prisma) return;
  try {
    await prisma.spamSignature.createMany({
      data: signatures.map((signature) => ({ signature, addedBy, reason })),
      skipDuplicates: true,
    });
  } catch (error) {
    container.logger.error('Persisting blocklist signatures failed:', error);
  }
}
