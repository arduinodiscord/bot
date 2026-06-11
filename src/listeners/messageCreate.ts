import { Events, Listener, container } from '@sapphire/framework';
import { PermissionFlagsBits, type GuildMember, type Message } from 'discord.js';
import { SERVER_ID, MOD_LOG_CHANNEL_ID, automodConfig } from '../utils/config';
import { imageSignatures } from '../utils/automod/signature';
import { perceptualHashes } from '../utils/automod/phash';
import {
  recordImageMessage,
  shouldAlert,
  markAlerted,
} from '../utils/automod/tracker';
import { isBlocklisted } from '../utils/automod/blocklist';
import {
  createIncident,
  type Incident,
  type IncidentLevel,
} from '../utils/automod/incidents';
import {
  buildAlertPayload,
  deleteIncidentMessages,
  timeoutMember,
} from '../utils/automod/console';

export class MessageCreateListener extends Listener {
  public constructor(context: Listener.Context, options: Listener.Options) {
    super(context, { ...options, event: Events.MessageCreate });
  }

  public async run(message: Message) {
    if (!message.inGuild() || message.author.bot) return;
    if (message.guildId !== SERVER_ID) return;
    // Without a console channel there is nowhere to surface alerts.
    if (!MOD_LOG_CHANNEL_ID) return;
    if (message.member && this.isImmune(message.member)) return;

    const signatures = imageSignatures(message);
    if (signatures.length === 0) return;

    const now = Date.now();
    // Perceptual hashes are best-effort (network fetch + decode); the metadata
    // signatures still cover anything that fails to hash.
    const hashes = await perceptualHashes(message);
    // New members get a stricter burst threshold so join-then-spam trips
    // faster; tenure is useless for compromised veterans, who are instead
    // caught by the fan-out/blocklist signals below.
    const isNewMember = Boolean(
      message.member?.joinedTimestamp &&
        now - message.member.joinedTimestamp < automodConfig.newMemberWindowMs
    );
    const detection = recordImageMessage(
      message.author.id,
      {
        at: now,
        channelId: message.channelId,
        messageId: message.id,
        signatures,
        hashes,
      },
      isNewMember
        ? { burstThreshold: automodConfig.newMemberBurstThreshold }
        : {}
    );

    const { blocked, matched } = isBlocklisted(signatures, hashes);

    let level: IncidentLevel | null = null;
    if (blocked) level = 'blocklist';
    else if (detection.level !== 'none') level = detection.level;
    if (!level) return;

    if (!shouldAlert(message.author.id, now)) return;
    markAlerted(message.author.id, now);

    // For blocklist-only hits the detector found no cluster, so the incident is
    // just the current message; otherwise use the contributing events.
    const messages =
      detection.level === 'none'
        ? [{ channelId: message.channelId, messageId: message.id }]
        : detection.events.map((e) => ({
            channelId: e.channelId,
            messageId: e.messageId,
          }));

    const incident = createIncident({
      userId: message.author.id,
      guildId: message.guildId,
      level,
      reason:
        level === 'blocklist'
          ? `Matched ${matched.length} known spam image${matched.length === 1 ? '' : 's'}`
          : detection.reason,
      messages,
      // For a fresh detection, blocklist the fingerprints that triggered it.
      // For a blocklist hit, reinforce with this message's fingerprints.
      signatures: level === 'blocklist' ? signatures : detection.signatures,
      hashes: level === 'blocklist' ? hashes : detection.hashes,
    });

    // Tiered enforcement: high-confidence signals act immediately; a
    // same-channel burst only alerts and waits for a human.
    const highConfidence = level === 'fanout' || level === 'blocklist';
    let autoActed = false;
    if (highConfidence) {
      const deleted = await deleteIncidentMessages(
        container.client,
        incident
      ).catch(() => 0);
      const timedOut = await timeoutMember(
        message.guild,
        message.author.id,
        `Automod: ${incident.reason}`
      ).catch(() => false);
      autoActed = deleted > 0 || timedOut;
    }

    await this.postAlert(message, incident, autoActed);
  }

  private isImmune(member: GuildMember): boolean {
    if (member.permissions.has(PermissionFlagsBits.ManageMessages)) return true;
    return automodConfig.immuneRoleIds.some((roleId) =>
      member.roles.cache.has(roleId)
    );
  }

  private async postAlert(
    message: Message<true>,
    incident: Incident,
    autoActed: boolean
  ): Promise<void> {
    const channel = await container.client.channels
      .fetch(MOD_LOG_CHANNEL_ID)
      .catch(() => null);
    if (!channel || !channel.isSendable()) {
      container.logger.warn(
        `Automod: MOD_LOG_CHANNEL_ID ${MOD_LOG_CHANNEL_ID} is not a sendable channel; cannot post alert.`
      );
      return;
    }

    const member =
      message.member ??
      (await message.guild.members.fetch(message.author.id).catch(() => null));

    await channel.send(buildAlertPayload(incident, member, autoActed));
  }
}
