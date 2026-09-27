import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Client,
  type Message,
} from 'discord.js';
import { container } from '@sapphire/framework';
import { helpChannelIds, helpAssistConfig } from './config';
import { fetchOpenHelpPosts } from './helpPosts';
import universalEmbed from './embed';

const SWEEP_INTERVAL_MS = 30 * 60_000;

const NUDGE_TEXT =
  "This post has had no activity for a while. If your problem is solved, click **Mark Solved** to close it. If not, reply with an update (what you've tried, your current code and wiring) so helpers can pick it up again. If nobody replies, the post will be closed automatically.";

function nudgePayload() {
  const embed = new EmbedBuilder(universalEmbed).setDescription(NUDGE_TEXT);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('solved')
      .setLabel('Mark Solved')
      .setStyle(ButtonStyle.Success)
  );
  return { embeds: [embed], components: [row] };
}

/**
 * Whether `message` is one of our stale-post nudges. Nudge state is derived
 * from the thread itself rather than memory, so a restart never re-nudges a
 * post whose last message is already our nudge.
 */
function isNudge(message: Message | null, botId: string | undefined): boolean {
  if (!message || !botId || message.author.id !== botId) return false;
  return message.embeds.some((embed) => embed.description === NUDGE_TEXT);
}

export type StaleAction = 'nudge' | 'archive' | 'none';

/**
 * Decide what the sweep should do with one open post. Pure, for testing.
 *
 * Never acts when the last message couldn't be fetched: without it we can't
 * tell whether our nudge is already there, and guessing re-nudges the same
 * post on every sweep.
 */
export function staleAction(post: {
  lastMessageKnown: boolean;
  lastIsNudge: boolean;
  lastActivityAt: number;
  now: number;
  nudgeMs: number;
  archiveMs: number;
}): StaleAction {
  if (!post.lastMessageKnown) return 'none';
  const idle = post.now - post.lastActivityAt;
  if (post.lastIsNudge) return idle >= post.archiveMs ? 'archive' : 'none';
  return idle >= post.nudgeMs ? 'nudge' : 'none';
}

/**
 * One pass: nudge open help posts idle past the nudge threshold, and archive
 * those whose last message is still our nudge after the archive threshold.
 * Any reply after the nudge makes the post live again (and eligible for a
 * fresh nudge once it goes quiet).
 */
async function sweepOnce(client: Client): Promise<void> {
  const now = Date.now();
  const posts = await fetchOpenHelpPosts(client);

  for (const { thread, lastActivityAt, lastMessage, lastMessageKnown } of posts) {
    const action = staleAction({
      lastMessageKnown,
      lastIsNudge: isNudge(lastMessage, client.user?.id),
      lastActivityAt,
      now,
      nudgeMs: helpAssistConfig.staleNudgeMs,
      archiveMs: helpAssistConfig.staleArchiveMs,
    });

    if (action === 'archive')
      await thread
        .setArchived(true, 'Auto-archived: no activity after nudge')
        .catch((error) =>
          container.logger.warn(
            `Stale sweep: could not archive thread ${thread.id}:`,
            error
          )
        );
    else if (action === 'nudge')
      await thread
        .send(nudgePayload())
        .catch((error) =>
          container.logger.warn(
            `Stale sweep: could not nudge thread ${thread.id}:`,
            error
          )
        );
  }
}

/**
 * Start the periodic stale-help-post sweep. No-op unless help channels are
 * configured and the sweep is enabled. The interval is unref'd so it never
 * keeps the process alive on its own.
 */
export function startStaleHelpSweep(client: Client): void {
  if (!helpAssistConfig.staleSweepEnabled) return;
  if (helpChannelIds.length === 0) return;

  const run = () =>
    sweepOnce(client).catch((error) =>
      container.logger.error('Stale help-post sweep failed:', error)
    );

  // First pass shortly after startup, then on a fixed interval.
  setTimeout(run, 60_000).unref();
  setInterval(run, SWEEP_INTERVAL_MS).unref();
}
