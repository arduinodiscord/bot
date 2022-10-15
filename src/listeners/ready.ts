import { Events, Listener } from '@sapphire/framework';
import type { Client } from 'discord.js';

export class ReadyListener extends Listener {
  public constructor(context: Listener.Context, options: Listener.Options) {
    super(context, { ...options, once: true, event: Events.ClientReady });
  }

  public run({ user }: Client) {
    const { username, id, discriminator } = user!;
    this.container.logger.info(
      `Logged in as ${username}#${discriminator} (${id})`
    );

    user?.setPresence({
      status: 'online',
      activities: [
        {
          name: 'slash commands!',
          type: 'WATCHING'
        }
      ]
    })
  }
}
