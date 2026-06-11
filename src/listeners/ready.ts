import { Events, Listener } from '@sapphire/framework';
import type { Client } from 'discord.js';
import { initDatabase } from '../utils/db';

export class ReadyListener extends Listener {
  public constructor(context: Listener.Context, options: Listener.Options) {
    super(context, { ...options, once: true, event: Events.ClientReady });
  }

  public async run({ user }: Client) {
    const { username, id, discriminator } = user!;
    this.container.logger.info(
      `Logged in as ${username}#${discriminator} (${id})`
    );

    // Connect persistence if configured; the bot runs in-memory otherwise.
    await initDatabase();
  }
}
