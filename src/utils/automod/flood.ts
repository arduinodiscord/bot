import { automodConfig } from '../config';

/** A short message recorded for flood detection. */
export interface FloodMessage {
  at: number;
  channelId: string;
  messageId: string;
}

export interface FloodDetection {
  flooded: boolean;
  reason: string;
  /** The short messages that contributed to the verdict. */
  messages: FloodMessage[];
  /** Distinct channels involved. */
  channels: string[];
}

const NONE: FloodDetection = {
  flooded: false,
  reason: '',
  messages: [],
  channels: [],
};

/** Per-user recent short messages, pruned to the flood window. */
const userMessages = new Map<string, FloodMessage[]>();
/** Last time we raised a flood alert for a user, for cooldown suppression. */
const lastAlertAt = new Map<string, number>();

const unique = <T>(values: T[]): T[] => [...new Set(values)];

/**
 * Record a short message and evaluate whether the user is now flooding — i.e.
 * sending too many tiny messages in quick succession instead of consolidating
 * them into one. Only the caller's notion of "short" reaches here; this just
 * counts how many landed inside the sliding window.
 *
 * On a positive verdict the user's buffer is cleared so the next flood has to
 * build up from scratch (the alert cooldown still guards against re-alerting).
 */
export function recordShortMessage(
  userId: string,
  message: FloodMessage
): FloodDetection {
  const horizon = message.at - automodConfig.floodWindowMs;
  const messages = (userMessages.get(userId) ?? []).filter(
    (m) => m.at >= horizon
  );
  messages.push(message);

  if (messages.length >= automodConfig.floodThreshold) {
    userMessages.delete(userId);
    return {
      flooded: true,
      reason: `${messages.length} short messages in ${Math.round(
        automodConfig.floodWindowMs / 1000
      )}s`,
      messages,
      channels: unique(messages.map((m) => m.channelId)),
    };
  }

  userMessages.set(userId, messages);
  return NONE;
}

/** Whether enough time has passed since the last flood alert for this user. */
export function shouldAlertFlood(userId: string, now: number): boolean {
  const last = lastAlertAt.get(userId);
  return !last || now - last >= automodConfig.alertCooldownMs;
}

export function markFloodAlerted(userId: string, now: number): void {
  lastAlertAt.set(userId, now);
}

/** Forget a user's flood state (e.g. after a moderator resolves an alert). */
export function clearFloodUser(userId: string): void {
  userMessages.delete(userId);
  lastAlertAt.delete(userId);
}

// Periodically drop stale state so the maps don't grow unbounded. unref()
// keeps this timer from holding the process open.
const sweep = setInterval(() => {
  const horizon = Date.now() - automodConfig.floodWindowMs;
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
