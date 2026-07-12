import { automodConfig } from '../config';

/** A substantive text message recorded for cross-channel detection. */
export interface TextMessage {
  at: number;
  channelId: string;
  messageId: string;
  /** Tokenised, normalised words of the message, for similarity comparison. */
  tokens: Set<string>;
}

/** Which signal tripped: a near-identical repeat, or a new-member shotgun. */
export type CrosspostKind = 'similar' | 'spread';

export interface CrosspostDetection {
  kind: CrosspostKind;
  reason: string;
  /** Contributing messages, oldest first (so the first is the one to keep). */
  messages: TextMessage[];
  /** Distinct channels involved. */
  channels: string[];
}

/** Per-user recent substantive messages, pruned to the crosspost window. */
const userMessages = new Map<string, TextMessage[]>();
/** Last time we raised a crosspost alert for a user, for cooldown suppression. */
const lastAlertAt = new Map<string, number>();

const unique = <T>(values: T[]): T[] => [...new Set(values)];

/** Lowercase, strip punctuation, collapse whitespace — then split into words. */
export function tokenize(text: string): Set<string> {
  const normalized = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return new Set(normalized.split(' ').filter(Boolean));
}

/** Jaccard overlap of two token sets, in [0, 1]. */
function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

/** Whether two messages are "the same question" under the configured threshold. */
export function isSimilar(a: TextMessage, b: TextMessage): boolean {
  return similarity(a.tokens, b.tokens) >= automodConfig.crosspostSimilarityPct / 100;
}

export interface CrosspostOptions {
  /** Whether the author currently counts as a new member (enables `spread`). */
  isNewMember?: boolean;
}

/**
 * Record a substantive message and decide whether the user is fanning the same
 * question across channels. The high-confidence `similar` signal (near-identical
 * text in N+ channels) wins over the content-agnostic new-member `spread`
 * signal. On a hit the buffer is cleared so the next incident builds afresh.
 */
export function recordTextMessage(
  userId: string,
  message: TextMessage,
  options: CrosspostOptions = {}
): CrosspostDetection | null {
  const horizon = message.at - automodConfig.crosspostWindowMs;
  const messages = (userMessages.get(userId) ?? []).filter(
    (m) => m.at >= horizon
  );
  messages.push(message);

  const similar = detectSimilarFanout(messages);
  const detection = similar ?? detectNewMemberSpread(messages, options);

  if (detection) {
    userMessages.delete(userId);
    return detection;
  }

  userMessages.set(userId, messages);
  return null;
}

/** Near-identical text across `crosspostChannels`+ distinct channels. */
function detectSimilarFanout(messages: TextMessage[]): CrosspostDetection | null {
  for (const anchor of messages) {
    const cluster = messages.filter((m) => isSimilar(m, anchor));
    const channels = unique(cluster.map((m) => m.channelId));
    if (channels.length >= automodConfig.crosspostChannels) {
      const ordered = [...cluster].sort((a, b) => a.at - b.at);
      return {
        kind: 'similar',
        reason: `Same question posted across ${channels.length} channels`,
        messages: ordered,
        channels,
      };
    }
  }
  return null;
}

/**
 * A new member posting in `crosspostSpreadChannels`+ distinct channels, even
 * when the wording differs enough to dodge the similarity check.
 */
function detectNewMemberSpread(
  messages: TextMessage[],
  options: CrosspostOptions
): CrosspostDetection | null {
  if (!options.isNewMember) return null;
  const channels = unique(messages.map((m) => m.channelId));
  if (channels.length < automodConfig.crosspostSpreadChannels) return null;
  const ordered = [...messages].sort((a, b) => a.at - b.at);
  return {
    kind: 'spread',
    reason: `New member posting across ${channels.length} channels at once`,
    messages: ordered,
    channels,
  };
}

/** Whether enough time has passed since the last crosspost alert for this user. */
export function shouldAlertCrosspost(userId: string, now: number): boolean {
  const last = lastAlertAt.get(userId);
  return !last || now - last >= automodConfig.alertCooldownMs;
}

export function markCrosspostAlerted(userId: string, now: number): void {
  lastAlertAt.set(userId, now);
}

/** Forget a user's crosspost state (e.g. after a moderator resolves an alert). */
export function clearCrosspostUser(userId: string): void {
  userMessages.delete(userId);
  lastAlertAt.delete(userId);
}

// Periodically drop stale state so the maps don't grow unbounded. unref()
// keeps this timer from holding the process open.
const sweep = setInterval(() => {
  const horizon = Date.now() - automodConfig.crosspostWindowMs;
  for (const [userId, messages] of userMessages) {
    const fresh = messages.filter((m) => m.at >= horizon);
    if (fresh.length === 0) userMessages.delete(userId);
    else userMessages.set(userId, fresh);
  }
  const cooldownHorizon = Date.now() - automodConfig.alertCooldownMs;
  for (const [userId, at] of lastAlertAt)
    if (at < cooldownHorizon) lastAlertAt.delete(userId);
}, 5 * 60_000);
sweep.unref();
