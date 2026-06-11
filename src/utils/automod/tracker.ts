import { automodConfig } from '../config';

export interface ImageEvent {
  at: number;
  channelId: string;
  messageId: string;
  signatures: string[];
}

export type DetectionLevel = 'none' | 'burst' | 'fanout';

export interface Detection {
  level: DetectionLevel;
  reason: string;
  /** The image events that contributed to this verdict. */
  events: ImageEvent[];
  /** Distinct channels involved. */
  channels: string[];
  /** Distinct image signatures involved. */
  signatures: string[];
}

const NONE: Detection = {
  level: 'none',
  reason: '',
  events: [],
  channels: [],
  signatures: [],
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

  // --- Fan-out: one signature seen across N+ distinct channels ---
  const fanoutFrom = event.at - automodConfig.fanoutWindowMs;
  const fanoutEvents = events.filter((e) => e.at >= fanoutFrom);
  const channelsBySignature = new Map<string, Set<string>>();
  for (const e of fanoutEvents)
    for (const signature of e.signatures) {
      const channels = channelsBySignature.get(signature) ?? new Set<string>();
      channels.add(e.channelId);
      channelsBySignature.set(signature, channels);
    }

  const fannedSignatures = [...channelsBySignature.entries()].filter(
    ([, channels]) => channels.size >= automodConfig.fanoutChannels
  );

  if (fannedSignatures.length > 0) {
    const signatures = fannedSignatures.map(([signature]) => signature);
    const contributing = fanoutEvents.filter((e) =>
      e.signatures.some((s) => signatures.includes(s))
    );
    const channels = unique(contributing.map((e) => e.channelId));
    return {
      level: 'fanout',
      reason: `Identical image posted across ${channels.length} channels`,
      events: contributing,
      channels,
      signatures,
    };
  }

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
    };
  }

  return NONE;
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
