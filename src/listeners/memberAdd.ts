import { Events, Listener } from '@sapphire/framework';
import { GuildMember } from 'discord.js';
import { prisma } from '../utils/db';

export class MemberAddListener extends Listener {
  public constructor(context: Listener.Context, options: Listener.Options) {
    super(context, { ...options, event: Events.GuildMemberAdd });
  }

  public async run(member: GuildMember) {
    await prisma.memberAnalytics.create({
      data: { event: 'join', memberId: member.user.id },
    });
  }
}
