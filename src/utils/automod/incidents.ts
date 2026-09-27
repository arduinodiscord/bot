import { randomUUID } from 'node:crypto';

/**
 * The kinds of incident the moderation console can surface. `burst`, `fanout`,
 * `blocklist` and `suspect` come from the image-spam detector (`suspect` is a
 * scored hit with no burst/fan-out/blocklist detection behind it, e.g. OCR
 * keywords or new-account corroboration); `flood` from the text-flooding
 * detector.
 */
export type IncidentLevel =
  | 'burst'
  | 'fanout'
  | 'blocklist'
  | 'suspect'
  | 'flood'
  | 'crosspost';

export interface IncidentMessage {
  channelId: string;
  messageId: string;
}

export interface Incident {
  id: string;
  userId: string;
  guildId: string;
  level: IncidentLevel;
  reason: string;
  messages: IncidentMessage[];
  /** Metadata signatures to blocklist if a moderator confirms this is spam. */
  signatures: string[];
  /** Perceptual hashes to blocklist if a moderator confirms this is spam. */
  hashes: string[];
  createdAt: number;
  /** Composite risk score produced by the scoring pipeline. */
  score: number;
  /** Qualitative tier bucketed from the score. */
  tier: 'low' | 'medium' | 'high' | 'critical';
  /** Individual signal contributions that made up the score. */
  matched: { label: string; points: number }[];
  /** Distinct user IDs observed in the same cross-user cluster (always includes the author). */
  clusterUserIds: string[];
  /** Concatenated OCR text extracted from image attachments (may be ''). */
  ocrText: string;
  /** Category to use when a moderator confirms and blocklists this incident. */
  severity: 'scam' | 'spam';
  /** Whether this alert was posted by learning mode below the normal tier gate. */
  learning: boolean;
  /** Set when the bot timed the user out automatically, so "Not spam" can undo it. */
  autoTimedOut?: boolean;
}

/**
 * In-memory store of open incidents, keyed by a short id embedded in the
 * moderation buttons' custom ids. Incidents are intentionally ephemeral: if
 * the bot restarts, open alerts simply expire (their buttons report this).
 */
const incidents = new Map<string, Incident>();
// Volunteer moderators often reach an alert hours later; keep it actionable
// for a day. Incidents are small, and the sweep below bounds the map.
const TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Input type for `createIncident`. The six scoring/enrichment fields are
 * optional so that the flood and crosspost call sites — which don't yet run
 * through the scoring pipeline — compile unchanged. Defaults are filled in
 * inside `createIncident`.
 */
type IncidentInput = Omit<
  Incident,
  'id' | 'createdAt' | 'score' | 'tier' | 'matched' | 'clusterUserIds' | 'ocrText' | 'severity' | 'learning'
> &
  Partial<Pick<Incident, 'score' | 'tier' | 'matched' | 'clusterUserIds' | 'ocrText' | 'severity' | 'learning'>>;

export function createIncident(data: IncidentInput): Incident {
  const incident: Incident = {
    ...data,
    id: randomUUID().slice(0, 8),
    createdAt: Date.now(),
    score: data.score ?? 0,
    tier: data.tier ?? 'medium',
    matched: data.matched ?? [],
    clusterUserIds: data.clusterUserIds ?? [data.userId],
    ocrText: data.ocrText ?? '',
    severity: data.severity ?? 'spam',
    learning: data.learning ?? false,
  };
  incidents.set(incident.id, incident);
  return incident;
}

export const getIncident = (id: string): Incident | undefined =>
  incidents.get(id);

export const deleteIncident = (id: string): boolean => incidents.delete(id);

/**
 * Atomically take an incident for handling: returns it and removes it from the
 * store, so a second moderator clicking at the same moment gets nothing
 * instead of repeating the action. Put it back with `restoreIncident` if the
 * action fails and should be retryable.
 */
export function claimIncident(id: string): Incident | undefined {
  const incident = incidents.get(id);
  if (incident) incidents.delete(id);
  return incident;
}

export function restoreIncident(incident: Incident): void {
  incidents.set(incident.id, incident);
}

const sweep = setInterval(() => {
  const horizon = Date.now() - TTL_MS;
  for (const [id, incident] of incidents)
    if (incident.createdAt < horizon) incidents.delete(id);
}, 10 * 60_000);
sweep.unref();
