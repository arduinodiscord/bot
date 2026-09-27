import type { ThreadChannel } from 'discord.js';

export const SOLVED_PREFIX = '✅ ';

export interface SolveCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Whether `userId` may mark `thread` solved: the original poster always can,
 * and so can staff (Manage Messages). Already-solved threads are rejected.
 */
export function canMarkSolved(
  thread: ThreadChannel,
  userId: string,
  isStaff: boolean
): SolveCheck {
  if (thread.name.startsWith(SOLVED_PREFIX))
    return { ok: false, reason: 'This post is already marked solved.' };
  if (thread.ownerId !== userId && !isStaff)
    return {
      ok: false,
      reason: 'Only the person who opened this post (or a moderator) can mark it solved.',
    };
  return { ok: true };
}

export interface SolveResult {
  renamed: boolean;
  archived: boolean;
  /** The first error hit, for logging. */
  error?: unknown;
}

/**
 * Prefix the thread title with ✅ and archive it. Idempotent and non-throwing;
 * the result says which steps failed (usually a missing Manage Threads
 * permission) so callers can tell the user instead of claiming success.
 */
export async function applySolved(thread: ThreadChannel): Promise<SolveResult> {
  const result: SolveResult = { renamed: true, archived: true };
  if (!thread.name.startsWith(SOLVED_PREFIX)) {
    const name = (SOLVED_PREFIX + thread.name).slice(0, 100);
    await thread.setName(name).catch((error: unknown) => {
      result.renamed = false;
      result.error ??= error;
    });
  }
  await thread.setArchived(true).catch((error: unknown) => {
    result.archived = false;
    result.error ??= error;
  });
  return result;
}

/** User-facing explanation for a partially or wholly failed solve. */
export function describeSolveFailure(result: SolveResult): string | null {
  if (result.renamed && result.archived) return null;
  const failed =
    !result.renamed && !result.archived
      ? 'rename or close'
      : !result.renamed
        ? 'rename'
        : 'close';
  return `I couldn't ${failed} this post. I may be missing the **Manage Threads** permission here. Please ask a moderator to close it.`;
}
