import { ChannelType, type ThreadChannel } from 'discord.js';

export const SOLVED_PREFIX = '✅ ';

export interface SolveCheck {
  ok: boolean;
  reason?: string;
}

type SolvableThread = Pick<ThreadChannel, 'name' | 'ownerId'>;

/**
 * Whether `userId` may mark `thread` solved: the asker always can, and so can
 * staff (Manage Messages). Already-solved threads are rejected. `askerIds`
 * defaults to the thread owner; pass the starter message author too for
 * text-channel threads (see {@link needsStarterLookup}).
 */
export function canMarkSolved(
  thread: SolvableThread,
  userId: string,
  isStaff: boolean,
  askerIds: ReadonlyArray<string | null> = [thread.ownerId]
): SolveCheck {
  if (thread.name.startsWith(SOLVED_PREFIX))
    return { ok: false, reason: 'This post is already marked solved.' };
  if (!isStaff && !askerIds.includes(userId))
    return {
      ok: false,
      reason: 'Only the person who opened this post (or a moderator) can mark it solved.',
    };
  return { ok: true };
}

/**
 * In a text channel, a helper can open a thread from someone else's message,
 * so the asker is the starter message's author rather than the thread owner.
 * True when that (slow) lookup could change the answer for `userId`.
 */
export function needsStarterLookup(
  thread: SolvableThread & { parent: { type: ChannelType } | null },
  userId: string,
  isStaff: boolean
): boolean {
  return (
    !isStaff &&
    !thread.name.startsWith(SOLVED_PREFIX) &&
    thread.ownerId !== userId &&
    thread.parent?.type === ChannelType.GuildText
  );
}

/**
 * Everyone who counts as the asker: the thread owner plus, for text-channel
 * threads, the author of the message the thread was started from. The starter
 * fetch can be slow; callers must defer the interaction first.
 */
export async function fetchAskerIds(
  thread: ThreadChannel
): Promise<Array<string | null>> {
  const ids: Array<string | null> = [thread.ownerId];
  if (thread.parent?.type !== ChannelType.GuildText) return ids;
  const starter = await thread.fetchStarterMessage().catch(() => null);
  if (starter && !starter.author.bot) ids.push(starter.author.id);
  return ids;
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
