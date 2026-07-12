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

/** Prefix the thread title with ✅ and archive it. Idempotent and non-throwing. */
export async function applySolved(thread: ThreadChannel): Promise<void> {
  const name = thread.name.startsWith(SOLVED_PREFIX)
    ? thread.name
    : (SOLVED_PREFIX + thread.name).slice(0, 100);
  await thread.setName(name).catch(() => null);
  await thread.setArchived(true).catch(() => null);
}
