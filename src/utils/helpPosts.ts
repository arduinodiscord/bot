import {
  ChannelType,
  SnowflakeUtil,
  type Client,
  type Message,
  type ThreadChannel,
} from 'discord.js';
import { SERVER_ID, helpChannelIds } from './config';
import { SOLVED_PREFIX } from './solveThread';

export interface OpenHelpPost {
  thread: ThreadChannel;
  /**
   * Timestamp (ms) of the last message. When the last message couldn't be
   * fetched this is estimated from `thread.lastMessageId`, then thread creation.
   */
  lastActivityAt: number;
  /** The last message itself, when there is one and it could be fetched. */
  lastMessage: Message | null;
  /**
   * Whether the last message was actually fetched (an empty thread counts as
   * known). When false, `lastMessage` is null because the fetch failed, not
   * because the thread is empty, so callers must not act on it.
   */
  lastMessageKnown: boolean;
}

/** Whether a thread has already been marked solved (✅ title prefix). */
export const isSolved = (thread: ThreadChannel): boolean =>
  thread.name.startsWith(SOLVED_PREFIX);

/** Best-effort activity estimate when the last message can't be fetched. */
export function estimateLastActivity(
  lastMessageId: string | null,
  createdTimestamp: number | null
): number {
  if (lastMessageId) {
    try {
      return SnowflakeUtil.timestampFrom(lastMessageId);
    } catch {
      // fall through to creation time
    }
  }
  return createdTimestamp ?? 0;
}

/**
 * Find the currently-open (active, unsolved, public) posts across the
 * configured help channels, annotated with last-activity info. Works for
 * threads under both forum and text help channels. Shared by the stale-post
 * sweep and the `/openposts` digest.
 */
export async function fetchOpenHelpPosts(
  client: Client
): Promise<OpenHelpPost[]> {
  if (helpChannelIds.length === 0) return [];

  const guild = await client.guilds.fetch(SERVER_ID).catch(() => null);
  if (!guild) return [];

  const active = await guild.channels.fetchActiveThreads().catch(() => null);
  if (!active) return [];

  const posts: OpenHelpPost[] = [];
  for (const thread of active.threads.values()) {
    if (!thread.parentId || !helpChannelIds.includes(thread.parentId))
      continue;
    if (thread.type === ChannelType.PrivateThread) continue;
    if (thread.archived || isSolved(thread)) continue;

    const fetched = await thread.messages
      .fetch({ limit: 1 })
      .then((messages) => ({ ok: true, last: messages.first() ?? null }))
      .catch(() => ({ ok: false, last: null }));

    let lastActivityAt: number;
    if (fetched.last) lastActivityAt = fetched.last.createdTimestamp;
    else if (fetched.ok) lastActivityAt = thread.createdTimestamp ?? 0;
    else
      lastActivityAt = estimateLastActivity(
        thread.lastMessageId,
        thread.createdTimestamp
      );

    posts.push({
      thread,
      lastActivityAt,
      lastMessage: fetched.last,
      lastMessageKnown: fetched.ok,
    });
  }
  return posts;
}
