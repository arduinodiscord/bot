import { Events, Listener } from '@sapphire/framework';
import type { Client } from 'discord.js';
import { initDatabase } from '../utils/db';
import { blocklistSize, loadBlocklist } from '../utils/automod/blocklist';
import { loadKeywords } from '../utils/automod/keywords';
import { learningModeActive } from '../utils/automod/learning';
import { warmOcr } from '../utils/automod/ocr';
import { seedInviteCache } from '../utils/inviteCache';
import { startStaleHelpSweep } from '../utils/staleHelpSweep';
import {
  JOIN_LEAVE_LOG_CHANNEL_ID,
  MOD_LOG_CHANNEL_ID,
  SERVER_ID,
  automodConfig,
} from '../utils/config';

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
    // Load learned scam keywords from the database (no-op without one).
    await loadKeywords();
    this.logAutomodStatus();
    // Pre-initialize the OCR worker (model download) off the message path.
    void warmOcr();
    // Seed the invite-use cache so join logging can attribute the source.
    await this.fillInviteCache(client);
    // Begin nudging/auto-archiving stale help posts (no-op unless configured).
    startStaleHelpSweep(client);
  }

  /** Surface automod state at startup so a silent misconfiguration is visible. */
  private logAutomodStatus(): void {
    if (!MOD_LOG_CHANNEL_ID) {
      this.container.logger.warn(
        'Automod: MOD_LOG_CHANNEL_ID is not set — ALL spam detection is disabled and no alerts will be posted.'
      );
      return;
    }
    if (learningModeActive()) {
      const coverage = automodConfig.learningCatchAll
        ? 'EVERY image message is posted to the mod log (catch-all enabled)'
        : 'every image with any suspicion signal is posted to the mod log';
      this.container.logger.info(
        `Automod: learning mode ACTIVE (blocklist ${blocklistSize()}/${automodConfig.learningCorpusTarget} confirmed fingerprints, mode=${automodConfig.learningMode}) — ${coverage} for training.`
      );
    } else {
      this.container.logger.info(
        `Automod: learning mode inactive (blocklist ${blocklistSize()} fingerprint(s), mode=${automodConfig.learningMode}) — normal confidence gating applies.`
      );
    }
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
