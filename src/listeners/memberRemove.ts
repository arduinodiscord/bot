import { Events, Listener } from '@sapphire/framework';
import type { GuildMember } from 'discord.js';
import { prisma } from '../utils/db';

export class MemberRemoveListener extends Listener {
  public constructor(context: Listener.Context, options: Listener.Options) {
    super(context, { ...options, event: Events.GuildMemberRemove });
  }

  public async run(member: GuildMember) {
    await prisma.memberAnalytics.create({
      data: { event: 'leave', memberId: member.user.id },
    });
  }
}
