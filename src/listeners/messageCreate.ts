import { Events, Listener, container } from '@sapphire/framework';
import { PermissionFlagsBits, type GuildMember, type Message } from 'discord.js';
import { SERVER_ID, MOD_LOG_CHANNEL_ID, automodConfig } from '../utils/config';
import { imageSignatures } from '../utils/automod/signature';
import { imageFingerprints, fetchEvidence, type ImageFingerprint } from '../utils/automod/phash';
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
import { checkBlocklist, isAllowlisted } from '../utils/automod/blocklist';
import { isAutomodReady } from '../utils/automod/state';
import { learningModeActive } from '../utils/automod/learning';
import { recordAndCluster } from '../utils/automod/globalIndex';
import { matchKeywords, matchSeedKeywords } from '../utils/automod/keywords';
import { scoreSignals, WIDE_SPREAD, type Signals, type Tier } from '../utils/automod/score';
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
  MAX_DELETE_PER_INCIDENT,
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

    // Nothing below may run before the blocklist has loaded, or a confirmed
    // scam image reposted during startup would be scored as unknown.
    if (!isAutomodReady()) return;

    // Metadata signatures are uploader-controlled, so they only feed the
    // per-user tracker (where forging them can only hurt the forger). Identity
    // across users, the blocklist and the allowlist use content ids.
    const signatures = imageSignatures(message);
    if (signatures.length === 0) return;
    const imageCount = signatures.length;

    const now = Date.now();
    // Content ids + perceptual hashes are best-effort (network fetch + decode).
    const fp = await imageFingerprints(message);

    // An exact confirmed-scam match always wins, even over an allowlist entry.
    const vetted = (i: ImageFingerprint) => Boolean(i.contentId && isAllowlisted(i.contentId));
    const unvetted = fp.images.filter((i) => !vetted(i));
    const contentIds = unvetted.flatMap((i) => (i.contentId ? [i.contentId] : []));
    const hashes = unvetted.flatMap((i) => (i.hash ? [i.hash] : []));
    const block = checkBlocklist(fp.contentIds, hashes);
    // Skip only when EVERY image is a moderator-vetted exact image: one
    // allowlisted picture must not carry a scam image through with it.
    if (fp.images.length === imageCount && unvetted.length === 0 && block.exact !== 'scam') {
      container.logger.info(
        `Automod: image(s) from ${message.author.id} in ${message.channelId} were marked "Not spam"; skipped.`
      );
      return;
    }

    // OCR text feeds the scam-keyword signal; best-effort and may be ''.
    const ocrText = await ocrMessage(
      message,
      fp.images.map((i) => i.contentId)
    );

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

    const content = message.content.trim();
    const imageOnly = content === '';

    // Cross-user clustering: the same image posted by several accounts.
    const cluster = recordAndCluster({
      userId: message.author.id,
      channelId: message.channelId,
      messageId: message.id,
      at: now,
      contentIds,
      hashes,
      imageOnly,
    });

    // Corroborating content signals.
    const imageOnlyPair = imageOnly && imageCount === 2;
    const massMention = /@(everyone|here)\b/.test(content);
    const hasLinkOrMention = /https?:\/\//i.test(content) || massMention;
    // Scam images usually carry their payload link inside the image itself,
    // where the content check above cannot see it.
    const ocrHasLink = /https?:\/\/|www\.|discord\.gg\/|t\.me\//i.test(ocrText);

    // Fold every signal into a single confidence score + tier.
    const signals: Signals = {
      scamExact: block.exact === 'scam',
      spamExact: block.exact === 'spam',
      nearBlocklist: block.near !== null,
      clusterUsers: cluster.userIds.length,
      fanoutChannels:
        detection.level === 'fanout' ? detection.channels.length : 0,
      keywordMatches: matchKeywords(ocrText).length,
      seedKeywordMatches: matchSeedKeywords(ocrText).length,
      newAccount: isNewMember,
      hasLinkOrMention,
      massMention,
      ocrHasLink,
      imageOnlyPair,
      burst: detection.level === 'burst',
    };
    const { score, tier, matched: matchedSignals, newAccountOnly } = scoreSignals(signals);
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
    // Any warning sign counts for learning, except being a new member alone.
    const suspicious = tier !== 'none' || (score > 0 && !newAccountOnly);
    if (learning) {
      if (!suspicious && !automodConfig.learningCatchAll) return;
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

    // Messages this incident covers. The author's own always count. Another
    // account's message is only included when it also has the raid shape
    // (images, no text) and this one does too, or the spread is wide: a member
    // who shared the same diagram with a normal question must never have
    // their message deleted because someone else reposted it.
    const msgMap = new Map<string, { channelId: string; messageId: string }>();
    const raidUserIds = new Set<string>([message.author.id]);
    for (const e of cluster.events) {
      if (e.userId === message.author.id) {
        msgMap.set(e.messageId, { channelId: e.channelId, messageId: e.messageId });
        continue;
      }
      if (e.imageOnly) raidUserIds.add(e.userId);
      if (e.imageOnly && (imageOnly || cluster.userIds.length >= WIDE_SPREAD))
        msgMap.set(e.messageId, { channelId: e.channelId, messageId: e.messageId });
    }
    if (detection.level !== 'none')
      for (const e of detection.events)
        msgMap.set(e.messageId, { channelId: e.channelId, messageId: e.messageId });
    msgMap.set(message.id, { channelId: message.channelId, messageId: message.id });
    const messages = [...msgMap.values()];

    // Incident level drives the console title/label; the tier drives colour and
    // auto-action.
    const blocked = block.exact !== null || block.near !== null;
    const multiAccount = signals.clusterUsers >= automodConfig.clusterMinUsers;
    const level: IncidentLevel = blocked
      ? 'blocklist'
      : multiAccount
        ? 'cluster'
        : signals.fanoutChannels >= automodConfig.fanoutChannels
          ? 'fanout'
          : signals.burst
            ? 'burst'
            : 'suspect';

    const reason = block.exact
      ? `Exact copy of an image moderators confirmed as ${block.exact}`
      : block.near
        ? `Looks like an image moderators confirmed as ${block.near}`
        : multiAccount
          ? `Same image from ${signals.clusterUsers} accounts in ${new Set(cluster.events.map((e) => e.channelId)).size} channel(s)`
          : detection.reason ||
            (score > 0
              ? 'Flagged by the image checks'
              : 'No warning signs. Posted because learning mode shows every image');

    const incident = createIncident({
      userId: message.author.id,
      guildId: message.guildId,
      level,
      reason,
      messages,
      contentIds,
      hashes,
      score,
      // A learning-mode hit may score below every threshold ('none'); it is
      // still shown to moderators, as the lowest-confidence bucket.
      tier: tier === 'none' ? 'low' : tier,
      matched: matchedSignals,
      clusterUserIds: cluster.userIds,
      raidUserIds: [...raidUserIds],
      ocrText,
      severity: block.exact ?? block.near ?? 'spam',
      // Flag alerts that only exist because of learning mode, so the console
      // explains why moderators are seeing a low-confidence hit.
      learning: learning && (tier === 'none' || (tier === 'low' && !automodConfig.logLowConfidence)),
    });

    // Tiered enforcement, capped at the approved ceiling: only an exact
    // confirmed-scam match (the sole path to `critical`) auto-bans; `high`
    // times out and deletes; medium/low alert only and wait for a human.
    // Enforcement always runs — the alert cooldown below only throttles
    // mod-log posts.
    let autoAction: AutoActionResult | null = null;
    let evidence: Buffer | undefined;
    if (tier === 'critical' || tier === 'high') {
      // Grab a copy of the image first: once deleted, moderators can't see it.
      const evidenceFetch = fetchEvidence(message);
      const attempted = Math.min(messages.length, MAX_DELETE_PER_INCIDENT);
      if (tier === 'critical') {
        // Auto-ban ONLY the author. Each raider posting the blocklisted image
        // is banned as the author of their own message; the rest of the
        // cluster is listed in the alert for one-click moderator action.
        const banned = banMember(message.guild, message.author.id, `Automod: ${reason}`).catch(
          () => false
        );
        evidence = await evidenceFetch;
        const deleted = await deleteIncidentMessages(container.client, incident).catch(() => 0);
        autoAction = { attempted, deleted, banned: await banned };
      } else {
        // Time out first so the raider stops posting while deletes run.
        const timedOut = timeoutMember(message.guild, message.author.id, `Automod: ${reason}`).catch(
          () => false
        );
        evidence = await evidenceFetch;
        const deleted = await deleteIncidentMessages(container.client, incident).catch(() => 0);
        autoAction = { attempted, deleted, timedOut: await timedOut };
        incident.autoTimedOut = autoAction.timedOut;
      }
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

    await this.postAlert(message, incident, autoAction, {
      image: evidence,
      previewUrl: message.attachments.first()?.proxyURL,
    });
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
      contentIds: [],
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
      contentIds: [],
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
    evidence?: { image?: Buffer; previewUrl?: string }
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
      await channel.send(buildAlertPayload(incident, member, autoAction, evidence));
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
