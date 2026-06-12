import { Events, Listener } from '@sapphire/framework';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type AnyThreadChannel,
} from 'discord.js';
import { helpForumChannelIds } from '../utils/config';
import universalEmbed from '../utils/embed';

/**
 * Posts a "Mark Solved" button when a new post is created in a configured help
 * forum, so the asker can close it (and credit a helper) in one click. Disabled
 * unless HELP_FORUM_CHANNEL_IDS is set.
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
  }
}
