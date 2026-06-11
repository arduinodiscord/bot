import { Events, Listener, container } from '@sapphire/framework';
import { EmbedBuilder, type Message } from 'discord.js';
import { CROSSPOST_LOG_CHANNEL_ID, crosspostChannelIds } from '../utils/config';
import universalEmbed from '../index';

/**
 * Auto-publishes (crossposts) messages in configured announcement/feed channels
 * and logs the result, mirroring the legacy bot's behaviour. Disabled unless
 * CROSSPOST_CHANNEL_IDS is set.
 */
export class CrosspostListener extends Listener {
  public constructor(context: Listener.Context, options: Listener.Options) {
    super(context, { ...options, event: Events.MessageCreate });
  }

  public async run(message: Message) {
    if (crosspostChannelIds.length === 0) return;
    if (!message.inGuild()) return;
    if (!crosspostChannelIds.includes(message.channelId)) return;
    if (!message.crosspostable) return;

    const channelName =
      'name' in message.channel ? message.channel.name : message.channelId;

    try {
      await message.crosspost();
      await this.log(`Auto-crossposted in #${channelName}`);
    } catch (error) {
      container.logger.error(`Auto-crosspost failed in #${channelName}:`, error);
      await this.log(
        `Failed to auto-crosspost in #${channelName}`,
        'Likely rate-limiting — check the logs for details.'
      );
    }
  }

  private async log(title: string, description?: string): Promise<void> {
    if (!CROSSPOST_LOG_CHANNEL_ID) return;
    const channel = await container.client.channels
      .fetch(CROSSPOST_LOG_CHANNEL_ID)
      .catch(() => null);
    if (!channel?.isSendable()) return;

    const embed = new EmbedBuilder(universalEmbed)
      .setTitle(title)
      .setTimestamp();
    if (description) embed.setDescription(description);
    await channel.send({ embeds: [embed] }).catch(() => null);
  }
}
