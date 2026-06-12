import { Events, Listener } from '@sapphire/framework';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type AnyThreadChannel,
} from 'discord.js';
import { helpForumChannelIds, helpAssistConfig } from '../utils/config';
import { resolveTag } from '../utils/resolveTag';
import universalEmbed from '../utils/embed';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * On a new post in a configured help forum:
 *  - posts a "Mark Solved" button so the asker can close it in one click, and
 *  - if the opening post is too thin (short, no code, no image), auto-posts the
 *    `needinfo` checklist so helpers don't have to ask for the basics.
 * Disabled unless HELP_FORUM_CHANNEL_IDS is set.
 */
export class ThreadCreateListener extends Listener {
  public constructor(context: Listener.Context, options: Listener.Options) {
    super(context, { ...options, event: Events.ThreadCreate });
  }

  public async run(thread: AnyThreadChannel, newlyCreated: boolean) {
    if (!newlyCreated) return;
    if (helpForumChannelIds.length === 0) return;
    if (!thread.parentId || !helpForumChannelIds.includes(thread.parentId))
      return;

    const embed = new EmbedBuilder(universalEmbed).setDescription(
      'When your question is answered, the original poster or a moderator can click **Mark Solved** to close this post. Use `/solved helper:@user` to also thank whoever helped. 🛠️'
    );
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('solved')
        .setLabel('✅ Mark Solved')
        .setStyle(ButtonStyle.Success)
    );

    await thread.send({ embeds: [embed], components: [row] }).catch(() => null);

    if (helpAssistConfig.autoNeedinfo) await this.maybeRequestInfo(thread);
  }

  /** Post the needinfo checklist when the opening message lacks substance. */
  private async maybeRequestInfo(thread: AnyThreadChannel): Promise<void> {
    // The starter message can lag a moment behind ThreadCreate for forum posts.
    let starter = await thread.fetchStarterMessage().catch(() => null);
    if (!starter) {
      await delay(1500);
      starter = await thread.fetchStarterMessage().catch(() => null);
    }
    if (!starter) return; // can't judge it — leave it alone

    const hasImage = starter.attachments.size > 0;
    const hasCode = starter.content.includes('```');
    const tooShort =
      starter.content.trim().length < helpAssistConfig.needinfoMinChars;
    if (hasImage || hasCode || !tooShort) return;

    const payload = resolveTag('needinfo', starter.author.id);
    if (!payload?.content) return;

    await thread
      .send({
        content: payload.content,
        allowedMentions: { users: [starter.author.id] },
      })
      .catch(() => null);
  }
}
