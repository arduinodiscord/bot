import { Events, Listener } from '@sapphire/framework';
import type { Message } from 'discord.js';
import { prisma } from '../utils/db';

export class MessageCreateListener extends Listener {
  public constructor(context: Listener.Context, options: Listener.Options) {
    super(context, { ...options, event: Events.MessageCreate });
  }

  public async run(message: Message) {
    await prisma.messageAnalytics.create({
      data: { memberId: message.author.id, channelId: message.channel.id },
    });
  }
}
