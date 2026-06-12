import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Client,
} from 'discord.js';
import { container } from '@sapphire/framework';
import { helpForumChannelIds, helpAssistConfig } from './config';
import { fetchOpenHelpPosts } from './helpPosts';
import universalEmbed from './embed';

const SWEEP_INTERVAL_MS = 30 * 60_000;

/** Threads we've nudged, so we can later auto-archive if still abandoned. */
const nudged = new Map<string, number>();

function nudgePayload() {
  const embed = new EmbedBuilder(universalEmbed).setDescription(
    "👋 This post has been quiet for a while. If you're sorted, tap **Mark Solved** to close it — otherwise reply with an update (what you've tried, your wiring/code) so a helper can jump back in."
  );
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('solved')
      .setLabel('✅ Mark Solved')
      .setStyle(ButtonStyle.Success)
  );
  return { embeds: [embed], components: [row] };
}

/**
 * One pass: nudge open help posts idle past the nudge threshold, and archive
 * those still untouched by a human a while after their nudge. A human reply
 * after the nudge clears the state so the post is treated as live again.
 */
async function sweepOnce(client: Client): Promise<void> {
  const now = Date.now();
  const posts = await fetchOpenHelpPosts(client);
  const live = new Set(posts.map((p) => p.thread.id));

  for (const { thread, lastActivityAt, lastFromBot } of posts) {
    const nudgedAt = nudged.get(thread.id);

    if (nudgedAt) {
      const humanReplied = !lastFromBot && lastActivityAt > nudgedAt;
      if (humanReplied) {
        nudged.delete(thread.id);
      } else if (now - nudgedAt >= helpAssistConfig.staleArchiveMs) {
        await thread.setArchived(true, 'Auto-archived: no activity after nudge').catch(() => null);
        nudged.delete(thread.id);
      }
      continue;
    }

    if (now - lastActivityAt >= helpAssistConfig.staleNudgeMs) {
      const sent = await thread.send(nudgePayload()).catch(() => null);
      if (sent) nudged.set(thread.id, now);
    }
  }

  // Forget state for threads that are no longer open (solved/archived/deleted).
  for (const id of nudged.keys()) if (!live.has(id)) nudged.delete(id);
}

/**
 * Start the periodic stale-help-post sweep. No-op unless help forums are
 * configured and the sweep is enabled. The interval is unref'd so it never
 * keeps the process alive on its own.
 */
export function startStaleHelpSweep(client: Client): void {
  if (!helpAssistConfig.staleSweepEnabled) return;
  if (helpForumChannelIds.length === 0) return;

  const run = () =>
    sweepOnce(client).catch((error) =>
      container.logger.error('Stale help-post sweep failed:', error)
    );

  // First pass shortly after startup, then on a fixed interval.
  setTimeout(run, 60_000).unref();
  setInterval(run, SWEEP_INTERVAL_MS).unref();
}
