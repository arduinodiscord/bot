import { automodConfig } from '../config';
import { hammingDistance } from './phash';

export interface GlobalImageEvent {
  userId: string;
  channelId: string;
  messageId: string;
  at: number;
  signatures: string[];
  hashes: string[];
}

export interface ClusterResult {
  userIds: string[];   // distinct users sharing this image within the window
  events: GlobalImageEvent[];
}

// Flat recent buffer of image events across all users, pruned to the window.
let recent: GlobalImageEvent[] = [];

/** Record an event and return the cross-user cluster it belongs to. */
export function recordAndCluster(event: GlobalImageEvent): ClusterResult {
  const horizon = event.at - automodConfig.clusterWindowMs;
  recent = recent.filter((e) => e.at >= horizon);

  const matches = recent.filter((e) => sharesImage(e, event));
  recent.push(event);

  const cluster = [...matches, event];
  const userIds = [...new Set(cluster.map((e) => e.userId))];
  return { userIds, events: cluster };
}

function sharesImage(a: GlobalImageEvent, b: GlobalImageEvent): boolean {
  if (a.signatures.some((s) => b.signatures.includes(s))) return true;
  for (const h1 of a.hashes)
    for (const h2 of b.hashes)
      if (hammingDistance(h1, h2) <= automodConfig.phashThreshold) return true;
  return false;
}

/** Test-only reset. */
export function __resetGlobalIndex(): void { recent = []; }

const sweep = setInterval(() => {
  const horizon = Date.now() - automodConfig.clusterWindowMs;
  recent = recent.filter((e) => e.at >= horizon);
}, 60_000);
sweep.unref();
