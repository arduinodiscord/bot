import { Events, Listener } from '@sapphire/framework';
import { EmbedBuilder, type Message } from 'discord.js';
import universalEmbed from '../utils/embed';

// Matches https://discord.com/channels/<guild>/<channel>/<message> (and the
// canary/ptb subdomains). IDs are 17-20 digits to be future-proof.
const MESSAGE_LINK =
  /https?:\/\/(?:canary\.|ptb\.)?discord\.com\/channels\/(\d{17,20})\/(\d{17,20})\/(\d{17,20})/g;

/**
 * When a user posts a link to another message in this server, re-posts that
 * message's content inline as a quote embed for context. Same-guild only.
 */
export class MessageLinkEmbedListener extends Listener {
  public constructor(context: Listener.Context, options: Listener.Options) {
    super(context, { ...options, event: Events.MessageCreate });
  }

  public async run(message: Message) {
    if (!message.inGuild() || message.author.bot) return;

    const matches = [...message.content.matchAll(MESSAGE_LINK)];
    if (matches.length === 0) return;

    for (const [, guildId, channelId, messageId] of matches) {
      if (guildId !== message.guildId) continue;

      const channel = await message.client.channels
        .fetch(channelId)
        .catch(() => null);
      if (!channel?.isTextBased() || channel.isDMBased()) continue;

      const linked = await channel.messages.fetch(messageId).catch(() => null);
      if (!linked || (!linked.content && linked.embeds.length === 0)) continue;

      const embed = new EmbedBuilder(universalEmbed)
        .setAuthor({
          name: `${linked.author.tag} said:`,
          iconURL: linked.author.displayAvatarURL(),
        })
        .setDescription(linked.content || '*[no text content]*')
        .setFooter({
          text: `Quoted by ${message.author.tag} • click the link for full context`,
        })
        .setTimestamp(linked.createdAt);

      await message.channel.send({ embeds: [embed] }).catch(() => null);
    }
  }
}
