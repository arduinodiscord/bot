import { container } from '@sapphire/framework';
import { getPrisma } from './db';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Retention periods promised in PRIVACY.md. Changing one of these changes a
 * public commitment: update the policy in the same PR.
 */
export const RETENTION = {
  /** Member join/leave events (and the unused message/command analytics tables). */
  analyticsDays: 90,
  /** Audit trail of moderation actions taken through the bot. */
  moderationActionDays: 365,
} as const;

/** Delete rows past their retention period. No-op without a database. */
export async function pruneExpiredData(now = Date.now()): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;
  const analyticsCutoff = new Date(now - RETENTION.analyticsDays * DAY_MS);
  const moderationCutoff = new Date(now - RETENTION.moderationActionDays * DAY_MS);
  try {
    const [members, messages, commands, actions] = await Promise.all([
      prisma.memberAnalytics.deleteMany({ where: { time: { lt: analyticsCutoff } } }),
      prisma.messageAnalytics.deleteMany({ where: { time: { lt: analyticsCutoff } } }),
      prisma.commandAnalytics.deleteMany({ where: { time: { lt: analyticsCutoff } } }),
      prisma.moderationAction.deleteMany({ where: { time: { lt: moderationCutoff } } }),
    ]);
    const total = members.count + messages.count + commands.count + actions.count;
    if (total > 0)
      container.logger.info(
        `Retention: pruned ${members.count} member, ${messages.count} message, ${commands.count} command analytics row(s) and ${actions.count} moderation action(s).`
      );
  } catch (error) {
    container.logger.error('Retention: pruning expired data failed:', error);
  }
}

/** Prune now and then daily. The timer is unref'd so it never holds the process open. */
export function startRetentionSweep(): void {
  void pruneExpiredData();
  setInterval(() => void pruneExpiredData(), DAY_MS).unref();
}
