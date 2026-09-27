import { Events, Listener, container } from '@sapphire/framework';
import { PermissionFlagsBits, type GuildMember, type Message } from 'discord.js';
import { SERVER_ID, MOD_LOG_CHANNEL_ID, automodConfig } from '../utils/config';
import { imageSignatures, isImageAttachment } from '../utils/automod/signature';
import { perceptualHashes } from '../utils/automod/phash';
import { ocrMessage } from '../utils/automod/ocr';
import {
  recordImageMessage,
  shouldAlert,
  markAlerted,
} from '../utils/automod/tracker';
import {
  recordShortMessage,
  shouldAlertFlood,
  markFloodAlerted,
} from '../utils/automod/flood';
import {
  recordTextMessage,
  shouldAlertCrosspost,
  markCrosspostAlerted,
  tokenize,
} from '../utils/automod/crosspost';
import { isBlocklisted, isAllowlisted } from '../utils/automod/blocklist';
import { learningModeActive } from '../utils/automod/learning';
import { recordAndCluster } from '../utils/automod/globalIndex';
import { matchKeywords } from '../utils/automod/keywords';
import { scoreSignals, type Tier } from '../utils/automod/score';
import {
  createIncident,
  type Incident,
  type IncidentLevel,
} from '../utils/automod/incidents';
import {
  buildAlertPayload,
  attemptedAutoAction,
  deleteIncidentMessages,
  type AutoActionResult,
  timeoutMember,
  banMember,
} from '../utils/automod/console';

/** Severity order, so a more severe detection can break through the alert cooldown. */
const TIER_RANK: Record<Tier, number> = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };

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

    // Text-flooding and cross-channel question spam run independently of the
    // image automod below: they key off message text, not attachments. A
    // failure in either must not stop the image checks.
    await this.runFlood(message).catch((error) =>
      container.logger.error('Automod: flood detector failed:', error)
    );
    await this.runCrosspost(message).catch((error) =>
      container.logger.error('Automod: crosspost detector failed:', error)
    );

    const signatures = imageSignatures(message);
    if (signatures.length === 0) return;

    const now = Date.now();
    // Perceptual hashes are best-effort (network fetch + decode); the metadata
    // signatures still cover anything that fails to hash.
    const hashes = await perceptualHashes(message);

    // Moderator-vetted images are never spam: short-circuit before spending any
    // OCR / clustering work on them.
    if (isAllowlisted(signatures, hashes)) {
      container.logger.info(
        `Automod: image from ${message.author.id} in ${message.channelId} matched the allowlist ("Not spam"); skipped.`
      );
      return;
    }

    // OCR text feeds the scam-keyword signal; best-effort and may be ''.
    const ocrText = await ocrMessage(message);

    // New members get a stricter burst threshold so join-then-spam trips
    // faster; tenure is useless for compromised veterans, who are instead
    // caught by the fan-out/blocklist/cluster signals below.
    const isNewMember = this.isNewMember(message.member, now);
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

    // Cross-user clustering: the same image posted by several accounts.
    const cluster = recordAndCluster({
      userId: message.author.id,
      channelId: message.channelId,
      messageId: message.id,
      at: now,
      signatures,
      hashes,
    });

    const { blocked, severity } = isBlocklisted(signatures, hashes);

    // Corroborating content signals.
    const imageCount = [...message.attachments.values()].filter(
      isImageAttachment
    ).length;
    const imageOnlyPair = message.content.trim() === '' && imageCount === 2;
    const hasLinkOrMention =
      /https?:\/\//i.test(message.content) || message.mentions.everyone;
    // Scam images usually carry their payload link inside the image itself,
    // where the message-content check above cannot see it.
    const ocrHasLink = /https?:\/\/|www\.|discord\.gg\/|t\.me\//i.test(ocrText);

    // Fold every signal into a single confidence score + tier.
    const signals = {
      scamBlocklist: severity === 'scam',
      spamBlocklist: severity === 'spam',
      clusterUsers: cluster.userIds.length,
      fanoutChannels:
        detection.level === 'fanout' ? detection.channels.length : 0,
      keywordMatches: matchKeywords(ocrText).length,
      newAccount: isNewMember,
      hasLinkOrMention: Boolean(hasLinkOrMention),
      ocrHasLink,
      imageOnlyPair,
      burst: detection.level === 'burst',
    };
    const { score, tier, matched: matchedSignals } = scoreSignals(signals);
    const signalSummary =
      matchedSignals.map((m) => `${m.label} (+${m.points})`).join(', ') || 'none';
    container.logger.debug(
      `Automod: image from ${message.author.id} in ${message.channelId} scored ${score} (${tier}); signals: ${signalSummary}`
    );

    // While learning mode is active (empty/small corpus), ANY nonzero
    // suspicion signal is surfaced so moderators can train the blocklist and
    // keywords — or, with the catch-all opted in, every image message. The
    // usual tier gate takes over once the corpus has grown.
    const learning = learningModeActive();
    if (learning) {
      if (score <= 0 && !automodConfig.learningCatchAll) return;
    } else {
      if (tier === 'none') return;
      if (tier === 'low' && !automodConfig.logLowConfidence) {
        // A real detection died at the gate — say so, or "why didn't this
        // alert?" requires a code audit.
        container.logger.info(
          `Automod: suppressed low-confidence image alert for ${message.author.id} (score ${score}; signals: ${signalSummary}). Set AUTOMOD_LOG_LOW_CONFIDENCE=true to post these.`
        );
        return;
      }
    }

    // Deduped message list: cluster events + per-user detection events + the
    // current message, keyed by message id.
    const msgMap = new Map<string, { channelId: string; messageId: string }>();
    for (const e of cluster.events)
      msgMap.set(e.messageId, {
        channelId: e.channelId,
        messageId: e.messageId,
      });
    if (detection.level !== 'none')
      for (const e of detection.events)
        msgMap.set(e.messageId, {
          channelId: e.channelId,
          messageId: e.messageId,
        });
    msgMap.set(message.id, {
      channelId: message.channelId,
      messageId: message.id,
    });
    const messages = [...msgMap.values()];

    // Incident level drives the console title/label; the tier drives colour and
    // auto-action. A blocklist hit is always labelled as such; otherwise a
    // cross-user cluster or channel fan-out reads as fan-out, a burst as a
    // burst, and anything scored purely from corroborating signals (keywords,
    // tenure, links) as a plain suspect.
    const level: IncidentLevel = blocked
      ? 'blocklist'
      : signals.clusterUsers >= automodConfig.clusterMinUsers ||
          signals.fanoutChannels >= automodConfig.fanoutChannels
        ? 'fanout'
        : signals.burst
          ? 'burst'
          : 'suspect';

    const reason = blocked
      ? `Matched a known ${severity} image`
      : signals.clusterUsers >= automodConfig.clusterMinUsers
        ? `Same image from ${signals.clusterUsers} accounts across ${new Set(cluster.events.map((e) => e.channelId)).size} channel(s)`
        : detection.reason ||
          (score > 0
            ? 'Image flagged by confidence scoring'
            : 'No suspicious signals. Posted because learning mode is on');

    const incident = createIncident({
      userId: message.author.id,
      guildId: message.guildId,
      level,
      reason,
      messages,
      signatures,
      hashes,
      score,
      // A learning-mode hit may score below every threshold ('none'); it is
      // still shown to moderators, as the lowest-confidence bucket.
      tier: tier === 'none' ? 'low' : tier,
      matched: matchedSignals,
      clusterUserIds: cluster.userIds,
      ocrText,
      severity: severity ?? 'spam',
      // Flag alerts that only exist because of learning mode, so the console
      // explains why moderators are seeing a low-confidence hit.
      learning: learning && (tier === 'none' || (tier === 'low' && !automodConfig.logLowConfidence)),
    });

    // Tiered enforcement, capped at the approved ceiling: only a confirmed scam
    // blocklist match (the sole path to `critical`) auto-bans; `high` deletes
    // and times out; medium/low alert only and wait for a human. Enforcement
    // always runs — the alert cooldown below only throttles mod-log posts.
    let autoAction: AutoActionResult | null = null;
    if (tier === 'critical') {
      // Auto-ban ONLY the confirmed-scam author. Cluster members are joined by
      // similarity and are not independently confirmed, so we do not auto-ban
      // them here — each raider posting the blocklisted image is banned as the
      // author of their own message. The cluster is still recorded on the
      // incident and surfaced in the alert for one-click mod action.
      autoAction = {
        attempted: incident.messages.length,
        deleted: await deleteIncidentMessages(container.client, incident).catch(() => 0),
        banned: await banMember(message.guild, message.author.id, `Automod: ${reason}`).catch(
          () => false
        ),
      };
    } else if (tier === 'high') {
      autoAction = {
        attempted: incident.messages.length,
        deleted: await deleteIncidentMessages(container.client, incident).catch(() => 0),
        timedOut: await timeoutMember(message.guild, message.author.id, `Automod: ${reason}`).catch(
          () => false
        ),
      };
      incident.autoTimedOut = autoAction.timedOut;
    }

    const rank = TIER_RANK[tier];
    if (!shouldAlert(message.author.id, now, rank)) {
      container.logger.info(
        `Automod: alert for ${message.author.id} suppressed by cooldown (score ${score}, ${tier})${
          autoAction ? `; auto-action: ${JSON.stringify(autoAction)}` : ''
        }.`
      );
      return;
    }
    markAlerted(message.author.id, now, rank);

    const previewUrl = message.attachments.first()?.proxyURL;
    await this.postAlert(message, incident, autoAction, previewUrl);
  }

  /**
   * Detect text flooding: many short messages from one user in quick
   * succession. Only short, non-empty text counts — pure-image messages are
   * left to the image automod above so the two detectors don't double up.
   */
  private async runFlood(message: Message<true>): Promise<void> {
    if (!automodConfig.floodEnabled) return;

    const content = message.content.trim();
    if (content.length === 0 || content.length > automodConfig.floodMaxChars)
      return;

    const now = Date.now();
    const detection = recordShortMessage(message.author.id, {
      at: now,
      channelId: message.channelId,
      messageId: message.id,
    });
    if (!detection.flooded) return;
    if (!shouldAlertFlood(message.author.id, now)) return;
    markFloodAlerted(message.author.id, now);

    const incident = createIncident({
      userId: message.author.id,
      guildId: message.guildId,
      level: 'flood',
      reason: detection.reason,
      messages: detection.messages.map((m) => ({
        channelId: m.channelId,
        messageId: m.messageId,
      })),
      // Flooding leaves no image fingerprints to blocklist.
      signatures: [],
      hashes: [],
    });

    // Flooding is usually a habit, not an attack, so we only auto-act when a
    // server opts in; otherwise a human decides from the console.
    let autoAction: AutoActionResult | null = null;
    if (automodConfig.floodAutoTimeout)
      autoAction = {
        timedOut: await timeoutMember(
          message.guild,
          message.author.id,
          `Automod: ${incident.reason}`
        ).catch(() => false),
      };

    await this.postAlert(message, incident, autoAction);
  }

  /**
   * Detect a user fanning the same question across many channels — the classic
   * new-joiner "ask everywhere at once" pattern. High-confidence near-identical
   * repeats auto-delete the duplicate copies (keeping the first); the broader
   * new-member spread signal only alerts. Tenure is read the same way as the
   * image automod: new members are scrutinised harder.
   */
  private async runCrosspost(message: Message<true>): Promise<void> {
    if (!automodConfig.crosspostEnabled) return;

    const content = message.content.trim();
    if (content.length < automodConfig.crosspostMinChars) return;

    const now = Date.now();
    const detection = recordTextMessage(
      message.author.id,
      {
        at: now,
        channelId: message.channelId,
        messageId: message.id,
        tokens: tokenize(content),
      },
      { isNewMember: this.isNewMember(message.member, now) }
    );
    if (!detection) return;
    if (!shouldAlertCrosspost(message.author.id, now)) return;
    markCrosspostAlerted(message.author.id, now);

    const messages = detection.messages.map((m) => ({
      channelId: m.channelId,
      messageId: m.messageId,
    }));
    const incident = createIncident({
      userId: message.author.id,
      guildId: message.guildId,
      level: 'crosspost',
      reason: detection.reason,
      messages,
      // Cross-posting leaves no image fingerprints to blocklist.
      signatures: [],
      hashes: [],
    });

    // Auto-delete only genuine duplicates: for a near-identical fan-out, drop
    // every copy but the first. The content-agnostic spread signal isn't a set
    // of duplicates, so it only alerts and waits for a human. Gated behind an
    // opt-in flag so a false positive can't silently delete a legit message
    // until a server has watched the detector and trusts it.
    let autoAction: AutoActionResult | null = null;
    if (
      automodConfig.crosspostAutoDelete &&
      detection.kind === 'similar' &&
      messages.length > 1
    ) {
      const duplicates = messages.slice(1);
      autoAction = {
        attempted: duplicates.length,
        deleted: await deleteIncidentMessages(container.client, {
          messages: duplicates,
        }).catch(() => 0),
      };
    }

    await this.postAlert(message, incident, autoAction);
  }

  private isImmune(member: GuildMember): boolean {
    if (member.permissions.has(PermissionFlagsBits.ManageMessages)) return true;
    return automodConfig.immuneRoleIds.some((roleId) =>
      member.roles.cache.has(roleId)
    );
  }

  /** Whether a member is still within the configured "new member" window. */
  private isNewMember(member: GuildMember | null, now: number): boolean {
    return Boolean(
      member?.joinedTimestamp &&
        now - member.joinedTimestamp < automodConfig.newMemberWindowMs
    );
  }

  private async postAlert(
    message: Message<true>,
    incident: Incident,
    autoAction: AutoActionResult | null,
    previewUrl?: string
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

    try {
      await channel.send(buildAlertPayload(incident, member, autoAction, previewUrl));
    } catch (error) {
      // The auto-action (if any) already happened; make sure it is not lost.
      container.logger.error(
        `Automod: posting alert to mod log failed (missing Send Messages / Embed Links?). Incident ${incident.id} for ${incident.userId}: ${incident.reason}${
          attemptedAutoAction(autoAction) ? `; auto-action: ${JSON.stringify(autoAction)}` : ''
        }`,
        error
      );
    }
  }
}
