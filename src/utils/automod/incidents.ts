import { randomUUID } from 'node:crypto';

/**
 * The kinds of incident the moderation console can surface. `burst`, `fanout`
 * and `blocklist` come from the image-spam detector; `flood` from the
 * text-flooding detector.
 */
export type IncidentLevel =
  | 'burst'
  | 'fanout'
  | 'blocklist'
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
}

/**
 * In-memory store of open incidents, keyed by a short id embedded in the
 * moderation buttons' custom ids. Incidents are intentionally ephemeral: if
 * the bot restarts, open alerts simply expire (their buttons report this).
 */
const incidents = new Map<string, Incident>();
const TTL_MS = 60 * 60 * 1000;

/**
 * Input type for `createIncident`. The six scoring/enrichment fields are
 * optional so that the flood and crosspost call sites — which don't yet run
 * through the scoring pipeline — compile unchanged. Defaults are filled in
 * inside `createIncident`.
 */
type IncidentInput = Omit<
  Incident,
  'id' | 'createdAt' | 'score' | 'tier' | 'matched' | 'clusterUserIds' | 'ocrText' | 'severity'
> &
  Partial<Pick<Incident, 'score' | 'tier' | 'matched' | 'clusterUserIds' | 'ocrText' | 'severity'>>;

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
  };
  incidents.set(incident.id, incident);
  return incident;
}

export const getIncident = (id: string): Incident | undefined =>
  incidents.get(id);

export const deleteIncident = (id: string): boolean => incidents.delete(id);

const sweep = setInterval(() => {
  const horizon = Date.now() - TTL_MS;
  for (const [id, incident] of incidents)
    if (incident.createdAt < horizon) incidents.delete(id);
}, 10 * 60_000);
sweep.unref();
