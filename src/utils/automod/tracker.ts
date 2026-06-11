import { automodConfig } from '../config';
import { hammingDistance } from './phash';

export interface ImageEvent {
  at: number;
  channelId: string;
  messageId: string;
  /** Cheap metadata fingerprints (one per image attachment). */
  signatures: string[];
  /** Perceptual hashes (one per image attachment, best-effort). */
  hashes: string[];
}

export type DetectionLevel = 'none' | 'burst' | 'fanout';

export interface Detection {
  level: DetectionLevel;
  reason: string;
  /** The image events that contributed to this verdict. */
  events: ImageEvent[];
  /** Distinct channels involved. */
  channels: string[];
  /** Distinct metadata signatures involved. */
  signatures: string[];
  /** Distinct perceptual hashes involved. */
  hashes: string[];
}

const NONE: Detection = {
  level: 'none',
  reason: '',
  events: [],
  channels: [],
  signatures: [],
  hashes: [],
};

/** Per-user recent image events, pruned to the longest detection window. */
const userEvents = new Map<string, ImageEvent[]>();
/** Last time we raised an alert for a user, for cooldown suppression. */
const lastAlertAt = new Map<string, number>();

const retentionMs = () =>
  Math.max(automodConfig.burstWindowMs, automodConfig.fanoutWindowMs);

const unique = <T>(values: T[]): T[] => [...new Set(values)];

export interface DetectionOptions {
  /**
   * Override for the same-channel burst threshold. Used to apply a stricter
   * threshold to new members. Falls back to the configured default.
   */
  burstThreshold?: number;
}

/**
 * Record an image-bearing message and evaluate whether the user's recent
 * activity now constitutes spam. Fan-out (same image across channels) takes
 * precedence over a same-channel burst because it is the higher-confidence
 * signal.
 */
export function recordImageMessage(
  userId: string,
  event: ImageEvent,
  options: DetectionOptions = {}
): Detection {
  const burstThreshold = options.burstThreshold ?? automodConfig.burstThreshold;
  const horizon = event.at - retentionMs();
  const events = (userEvents.get(userId) ?? []).filter((e) => e.at >= horizon);
  events.push(event);
  userEvents.set(userId, events);

  // --- Fan-out: the same image seen across N+ distinct channels ---
  const fanoutFrom = event.at - automodConfig.fanoutWindowMs;
  const fanoutEvents = events.filter((e) => e.at >= fanoutFrom);

  const fanout =
    detectExactFanout(fanoutEvents) ?? detectPerceptualFanout(fanoutEvents);
  if (fanout) return fanout;

  // --- Burst: N+ image messages within the burst window ---
  const burstFrom = event.at - automodConfig.burstWindowMs;
  const burstEvents = events.filter((e) => e.at >= burstFrom);
  if (burstEvents.length >= burstThreshold) {
    return {
      level: 'burst',
      reason: `${burstEvents.length} image messages in ${Math.round(
        automodConfig.burstWindowMs / 1000
      )}s`,
      events: burstEvents,
      channels: unique(burstEvents.map((e) => e.channelId)),
      signatures: unique(burstEvents.flatMap((e) => e.signatures)),
      hashes: unique(burstEvents.flatMap((e) => e.hashes)),
    };
  }

  return NONE;
}

/** Fan-out by exact metadata signature (catches byte-identical re-uploads). */
function detectExactFanout(events: ImageEvent[]): Detection | null {
  const channelsBySignature = new Map<string, Set<string>>();
  for (const e of events)
    for (const signature of e.signatures) {
      const channels = channelsBySignature.get(signature) ?? new Set<string>();
      channels.add(e.channelId);
      channelsBySignature.set(signature, channels);
    }

  const fanned = [...channelsBySignature.entries()].filter(
    ([, channels]) => channels.size >= automodConfig.fanoutChannels
  );
  if (fanned.length === 0) return null;

  const signatures = fanned.map(([signature]) => signature);
  const contributing = events.filter((e) =>
    e.signatures.some((s) => signatures.includes(s))
  );
  const channels = unique(contributing.map((e) => e.channelId));
  return {
    level: 'fanout',
    reason: `Identical image posted across ${channels.length} channels`,
    events: contributing,
    channels,
    signatures,
    hashes: unique(contributing.flatMap((e) => e.hashes)),
  };
}

/**
 * Fan-out by perceptual hash (catches re-encoded/resized copies of the same
 * image that have different metadata signatures per channel). For each hash we
 * cluster all near-duplicates within the configured Hamming distance and check
 * whether that cluster spans enough distinct channels.
 */
function detectPerceptualFanout(events: ImageEvent[]): Detection | null {
  const hashed = events.flatMap((e) =>
    e.hashes.map((hash) => ({ hash, event: e }))
  );

  for (const anchor of hashed) {
    const cluster = hashed.filter(
      ({ hash }) =>
        hammingDistance(hash, anchor.hash) <= automodConfig.phashThreshold
    );
    const channels = unique(cluster.map(({ event }) => event.channelId));
    if (channels.length >= automodConfig.fanoutChannels) {
      const contributing = unique(cluster.map(({ event }) => event));
      return {
        level: 'fanout',
        reason: `Near-identical image posted across ${channels.length} channels`,
        events: contributing,
        channels,
        signatures: unique(contributing.flatMap((e) => e.signatures)),
        hashes: unique(cluster.map(({ hash }) => hash)),
      };
    }
  }
  return null;
}

/** Whether enough time has passed since the last alert for this user. */
export function shouldAlert(userId: string, now: number): boolean {
  const last = lastAlertAt.get(userId);
  return !last || now - last >= automodConfig.alertCooldownMs;
}

export function markAlerted(userId: string, now: number): void {
  lastAlertAt.set(userId, now);
}

/** Forget a user's tracked state (e.g. after a moderator resolves an alert). */
export function clearUser(userId: string): void {
  userEvents.delete(userId);
  lastAlertAt.delete(userId);
}

// Periodically drop stale state so the maps don't grow unbounded for users
// who post one image and never return. unref() keeps this from holding the
// process open.
const sweep = setInterval(() => {
  const horizon = Date.now() - retentionMs();
  for (const [userId, events] of userEvents) {
    const fresh = events.filter((e) => e.at >= horizon);
    if (fresh.length === 0) userEvents.delete(userId);
    else userEvents.set(userId, fresh);
  }
  const cooldownHorizon = Date.now() - automodConfig.alertCooldownMs;
  for (const [userId, at] of lastAlertAt)
    if (at < cooldownHorizon) lastAlertAt.delete(userId);
}, 5 * 60_000);
sweep.unref();
