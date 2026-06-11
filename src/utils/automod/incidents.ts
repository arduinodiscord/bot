import { randomUUID } from 'node:crypto';
import type { DetectionLevel } from './tracker';

export type IncidentLevel = Exclude<DetectionLevel, 'none'> | 'blocklist';

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
}

/**
 * In-memory store of open incidents, keyed by a short id embedded in the
 * moderation buttons' custom ids. Incidents are intentionally ephemeral: if
 * the bot restarts, open alerts simply expire (their buttons report this).
 */
const incidents = new Map<string, Incident>();
const TTL_MS = 60 * 60 * 1000;

export function createIncident(
  data: Omit<Incident, 'id' | 'createdAt'>
): Incident {
  const incident: Incident = {
    ...data,
    id: randomUUID().slice(0, 8),
    createdAt: Date.now(),
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
