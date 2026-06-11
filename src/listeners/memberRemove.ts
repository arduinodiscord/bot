import { Events, Listener, container } from '@sapphire/framework';
import {
  EmbedBuilder,
  TimestampStyles,
  time,
  type GuildMember,
  type PartialGuildMember,
} from 'discord.js';
import { JOIN_LEAVE_LOG_CHANNEL_ID } from '../utils/config';
import { getPrisma } from '../utils/db';
import universalEmbed from '../index';

export class MemberRemoveListener extends Listener {
  public constructor(context: Listener.Context, options: Listener.Options) {
    super(context, { ...options, event: Events.GuildMemberRemove });
  }

  public async run(member: GuildMember | PartialGuildMember) {
    await this.recordAnalytics(member.id);
    await this.logLeave(member);
  }

  private async recordAnalytics(memberId: string): Promise<void> {
    const prisma = getPrisma();
    if (!prisma) return;
    try {
      await prisma.memberAnalytics.create({
        data: { event: 'leave', memberId },
      });
    } catch (error) {
      container.logger.error('Recording leave analytics failed:', error);
    }
  }

  private async logLeave(
    member: GuildMember | PartialGuildMember
  ): Promise<void> {
    if (!JOIN_LEAVE_LOG_CHANNEL_ID) return;
    const channel = await container.client.channels
      .fetch(JOIN_LEAVE_LOG_CHANNEL_ID)
      .catch(() => null);
    if (!channel?.isSendable()) return;

    const embed = new EmbedBuilder(universalEmbed)
      .setTitle('📤 Member left')
      .setAuthor({
        name: member.user.tag,
        iconURL: member.displayAvatarURL(),
      })
      .setDescription(`<@${member.id}>`)
      .setFooter({ text: `ID: ${member.id}` })
      .setTimestamp();

    // joinedAt is null for partials/uncached members.
    if (member.joinedAt)
      embed.addFields({
        name: 'Joined',
        value: time(member.joinedAt, TimestampStyles.RelativeTime),
        inline: true,
      });

    await channel.send({ embeds: [embed] }).catch(() => null);
  }
}
