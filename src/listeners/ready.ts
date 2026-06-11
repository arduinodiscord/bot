import { Events, Listener } from '@sapphire/framework';
import type { Client } from 'discord.js';
import { initDatabase } from '../utils/db';
import { loadBlocklist } from '../utils/automod/blocklist';
import { seedInviteCache } from '../utils/inviteCache';
import { JOIN_LEAVE_LOG_CHANNEL_ID, SERVER_ID } from '../utils/config';

export class ReadyListener extends Listener {
  public constructor(context: Listener.Context, options: Listener.Options) {
    super(context, { ...options, once: true, event: Events.ClientReady });
  }

  public async run(client: Client<true>) {
    const { username, id, discriminator } = client.user;
    this.container.logger.info(
      `Logged in as ${username}#${discriminator} (${id})`
    );

    // Connect persistence if configured; the bot runs in-memory otherwise.
    await initDatabase();
    // Warm the automod blocklist from the database (no-op without one).
    await loadBlocklist();
    // Seed the invite-use cache so join logging can attribute the source.
    await this.fillInviteCache(client);
  }

  private async fillInviteCache(client: Client<true>): Promise<void> {
    // Only needed when join logging is enabled; fetching invites requires the
    // Manage Server permission, so failures are non-fatal.
    if (!JOIN_LEAVE_LOG_CHANNEL_ID) return;
    const guild = await client.guilds.fetch(SERVER_ID).catch(() => null);
    if (!guild) return;
    try {
      const invites = await guild.invites.fetch();
      seedInviteCache(invites.values());
      this.container.logger.info(`Invite cache filled (${invites.size} invites).`);
    } catch (error) {
      this.container.logger.warn(
        'Could not fetch invites for join tracking (missing Manage Server permission?):',
        error
      );
    }
  }
}
