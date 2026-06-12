import { Events, Listener, container } from '@sapphire/framework';
import {
  EmbedBuilder,
  TimestampStyles,
  time,
  type GuildMember,
} from 'discord.js';
import { JOIN_LEAVE_LOG_CHANNEL_ID } from '../utils/config';
import { getInviteUses, setInviteUses } from '../utils/inviteCache';
import { getPrisma } from '../utils/db';
import universalEmbed from '../utils/embed';

export class MemberAddListener extends Listener {
  public constructor(context: Listener.Context, options: Listener.Options) {
    super(context, { ...options, event: Events.GuildMemberAdd });
  }

  public async run(member: GuildMember) {
    await this.recordAnalytics(member.id);
    await this.logJoin(member);
  }

  private async recordAnalytics(memberId: string): Promise<void> {
    const prisma = getPrisma();
    if (!prisma) return;
    try {
      await prisma.memberAnalytics.create({
        data: { event: 'join', memberId },
      });
    } catch (error) {
      container.logger.error('Recording join analytics failed:', error);
    }
  }

  private async logJoin(member: GuildMember): Promise<void> {
    if (!JOIN_LEAVE_LOG_CHANNEL_ID) return;
    const channel = await container.client.channels
      .fetch(JOIN_LEAVE_LOG_CHANNEL_ID)
      .catch(() => null);
    if (!channel?.isSendable()) return;

    const source = await this.resolveInviteSource(member);
    const embed = new EmbedBuilder(universalEmbed)
      .setTitle('📥 Member joined')
      .setAuthor({
        name: member.user.tag,
        iconURL: member.displayAvatarURL(),
      })
      .setThumbnail(member.displayAvatarURL())
      .setDescription(`<@${member.id}> — member #${member.guild.memberCount}`)
      .addFields(
        {
          name: 'Account created',
          value: time(member.user.createdAt, TimestampStyles.RelativeTime),
          inline: true,
        },
        {
          name: 'Invite',
          value: source ?? 'Unknown (Server Discovery or vanity URL)',
          inline: true,
        }
      )
      .setFooter({ text: `ID: ${member.id}` })
      .setTimestamp();

    await channel.send({ embeds: [embed] }).catch(() => null);
  }

  /**
   * Work out which invite was used by finding the one whose use count grew
   * since the cached snapshot, then refresh the cache for every invite.
   */
  private async resolveInviteSource(
    member: GuildMember
  ): Promise<string | null> {
    let source: string | null = null;
    try {
      const invites = await member.guild.invites.fetch();
      for (const invite of invites.values()) {
        const previous = getInviteUses(invite.code) ?? 0;
        if (!source && invite.uses !== null && invite.uses > previous)
          source = `\`${invite.code}\` by ${invite.inviter?.tag ?? 'unknown'}`;
        setInviteUses(invite.code, invite.uses ?? 0);
      }
    } catch (error) {
      container.logger.warn('Could not resolve invite source on join:', error);
    }
    return source;
  }
}
