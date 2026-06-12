import type { Client, ThreadChannel } from 'discord.js';
import { SERVER_ID, helpForumChannelIds } from './config';
import { SOLVED_PREFIX } from './solveThread';

export interface OpenHelpPost {
  thread: ThreadChannel;
  /** Timestamp (ms) of the last message, falling back to thread creation. */
  lastActivityAt: number;
  /** Whether that last message was posted by the bot (e.g. a prompt/nudge). */
  lastFromBot: boolean;
}

/** Whether a thread has already been marked solved (✅ title prefix). */
export const isSolved = (thread: ThreadChannel): boolean =>
  thread.name.startsWith(SOLVED_PREFIX);

/**
 * Find the currently-open (active, unsolved) posts across the configured help
 * forums, annotated with last-activity info. Shared by the stale-post sweep and
 * the `/openposts` digest. Best-effort: per-thread fetch failures are skipped.
 */
export async function fetchOpenHelpPosts(
  client: Client
): Promise<OpenHelpPost[]> {
  if (helpForumChannelIds.length === 0) return [];

  const guild = await client.guilds.fetch(SERVER_ID).catch(() => null);
  if (!guild) return [];

  const active = await guild.channels.fetchActiveThreads().catch(() => null);
  if (!active) return [];

  const posts: OpenHelpPost[] = [];
  for (const thread of active.threads.values()) {
    if (!thread.parentId || !helpForumChannelIds.includes(thread.parentId))
      continue;
    if (thread.archived || isSolved(thread)) continue;

    const last = await thread.messages
      .fetch({ limit: 1 })
      .then((messages) => messages.first() ?? null)
      .catch(() => null);

    posts.push({
      thread,
      lastActivityAt: last?.createdTimestamp ?? thread.createdTimestamp ?? 0,
      lastFromBot: last?.author?.id === client.user?.id,
    });
  }
  return posts;
}
