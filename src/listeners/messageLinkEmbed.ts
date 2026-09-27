import { Events, Listener } from '@sapphire/framework';
import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  type GuildMember,
  type GuildTextBasedChannel,
  type Message,
  type Role,
} from 'discord.js';
import universalEmbed from '../utils/embed';

// Matches https://discord.com/channels/<guild>/<channel>/<message> (and the
// canary/ptb subdomains). IDs are 17-20 digits to be future-proof.
const MESSAGE_LINK =
  /https?:\/\/(?:canary\.|ptb\.)?discord\.com\/channels\/(\d{17,20})\/(\d{17,20})\/(\d{17,20})/g;

/** Most quote embeds posted for a single message, to prevent link-dump spam. */
const MAX_EMBEDS_PER_MESSAGE = 3;

/** What someone needs to be able to read a message in a channel. */
const READ_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.ReadMessageHistory,
];

/**
 * When a user posts a link to another message in this server, re-posts that
 * message's content inline as a quote embed for context. Same-guild only.
 *
 * The bot can read channels most members can't (staff/mod channels), so a
 * linked message is only quoted when its channel is readable by BOTH the
 * poster and the @everyone role — i.e. it is public. Otherwise anyone could
 * leak a private channel by pasting a link to it somewhere public. Private
 * threads are never quoted; public threads use their parent's permissions.
 */
export class MessageLinkEmbedListener extends Listener {
  public constructor(context: Listener.Context, options: Listener.Options) {
    super(context, { ...options, event: Events.MessageCreate });
  }

  public async run(message: Message) {
    if (!message.inGuild() || message.author.bot) return;

    const matches = [...message.content.matchAll(MESSAGE_LINK)];
    if (matches.length === 0) return;

    const member =
      message.member ??
      (await message.guild.members.fetch(message.author.id).catch(() => null));
    if (!member) return;

    const seen = new Set<string>();
    let posted = 0;

    for (const [, guildId, channelId, messageId] of matches) {
      if (posted >= MAX_EMBEDS_PER_MESSAGE) break;
      if (guildId !== message.guildId || seen.has(messageId)) continue;
      seen.add(messageId);

      const channel = await message.client.channels
        .fetch(channelId)
        .catch(() => null);
      if (!channel?.isTextBased() || channel.isDMBased()) continue;
      if (channel.guildId !== message.guildId) continue;
      if (!isPubliclyReadable(channel, member, message.guild.roles.everyone))
        continue;

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

      const sent = await message.channel
        .send({ embeds: [embed], allowedMentions: { parse: [] } })
        .catch(() => null);
      if (sent) posted++;
    }
  }
}

/**
 * True only when both the poster and @everyone can view the channel and read
 * its history. Threads inherit visibility from their parent; private threads
 * are membership-gated, so they are always treated as private.
 */
function isPubliclyReadable(
  channel: GuildTextBasedChannel,
  member: GuildMember,
  everyone: Role
): boolean {
  if (channel.type === ChannelType.PrivateThread) return false;
  const target = channel.isThread() ? channel.parent : channel;
  if (!target) return false;
  return (
    target.permissionsFor(everyone)?.has(READ_PERMISSIONS) === true &&
    target.permissionsFor(member)?.has(READ_PERMISSIONS) === true
  );
}
