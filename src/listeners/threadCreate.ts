import { Events, Listener } from '@sapphire/framework';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type AnyThreadChannel,
} from 'discord.js';
import { helpChannelIds, helpAssistConfig } from '../utils/config';
import universalEmbed from '../utils/embed';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Concise auto-needinfo text. Kept inline (not in tags.ts) so the full
// /tag needinfo content — used by helpers explicitly — stays unchanged.
const AUTO_NEEDINFO_TEXT = [
  '**To help us help you, please share:**',
  '• What you want it to do vs. what\'s actually happening',
  '• A photo of your project and a wiring diagram',
  '• Your code in a **code block** (\\`\\`\\`)',
  '• Any error messages',
  '',
  'Once your question is answered, click **Mark Solved** below. 🛠️',
].join('\n');

const SOLVED_ONLY_TEXT =
  'When your question is answered, the original poster or a moderator can click **Mark Solved** to close this post. Use `/solved helper:@user` to also thank whoever helped. 🛠️';

const solvedRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
    .setCustomId('solved')
    .setLabel('✅ Mark Solved')
    .setStyle(ButtonStyle.Success)
);

/**
 * On a new help thread — a forum post, or a thread opened inside a text help
 * channel — sends a single message with the Mark Solved button and, when the
 * opening post is thin, an inline needinfo checklist in the same embed.
 * Disabled unless a help channel is configured (HELP_CHANNEL_IDS).
 */
export class ThreadCreateListener extends Listener {
  public constructor(context: Listener.Context, options: Listener.Options) {
    super(context, { ...options, event: Events.ThreadCreate });
  }

  public async run(thread: AnyThreadChannel, newlyCreated: boolean) {
    if (!newlyCreated) return;
    if (helpChannelIds.length === 0) return;
    if (!thread.parentId || !helpChannelIds.includes(thread.parentId)) return;

    const thin =
      helpAssistConfig.autoNeedinfo && (await this.isThinPost(thread));

    const embed = new EmbedBuilder(universalEmbed).setDescription(
      thin ? AUTO_NEEDINFO_TEXT : SOLVED_ONLY_TEXT
    );

    await thread
      .send({ embeds: [embed], components: [solvedRow] })
      .catch(() => null);
  }

  /**
   * Returns true when the opening post lacks enough substance to get meaningful
   * help without prompting. Errs strongly on the side of NOT firing:
   *
   * - Combines the thread title (forum post title) with the body length, so a
   *   descriptive title alone can clear the threshold.
   * - A code block, inline code, an image attachment, or any URL counts as
   *   substantive content regardless of character count.
   * - The threshold (HELP_NEEDINFO_MIN_CHARS, default 120) applies to
   *   title + body combined, not body alone.
   */
  private async isThinPost(thread: AnyThreadChannel): Promise<boolean> {
    // Forum starter messages can lag a moment behind ThreadCreate.
    let starter = await thread.fetchStarterMessage().catch(() => null);
    if (!starter) {
      await delay(1500);
      starter = await thread.fetchStarterMessage().catch(() => null);
    }
    if (!starter) return false; // can't judge — leave it alone

    const body = starter.content.trim();

    if (starter.attachments.size > 0) return false;
    if (body.includes('```')) return false;
    if (/`[^`\n]+`/.test(body)) return false; // inline code
    if (/https?:\/\/\S+/.test(body)) return false; // any URL

    const titleLen = thread.name.trim().length;
    const combined = titleLen + body.length;
    return combined < helpAssistConfig.needinfoMinChars;
  }
}
