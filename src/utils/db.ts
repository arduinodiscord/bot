import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { container } from '@sapphire/framework';
import { DATABASE_URL } from './config';

/**
 * The Prisma client, or `null` when no database is configured. The bot is
 * designed to run fully in-memory when persistence is unavailable, so every
 * consumer must treat a `null` client as "persistence disabled" rather than
 * an error.
 */
let prisma: PrismaClient | null = null;

export const getPrisma = (): PrismaClient | null => prisma;

/**
 * Attempt to connect to the database. Safe to call when `DATABASE_URL` is
 * unset (logs a notice and leaves the bot in in-memory mode) and when the
 * connection fails (logs the error and continues without persistence).
 *
 * Prisma 7 connects through a driver adapter rather than an embedded engine,
 * so we hand it a `pg` connection backed by `DATABASE_URL`.
 */
export async function initDatabase(): Promise<void> {
  if (!DATABASE_URL) {
    container.logger.warn(
      'DATABASE_URL not set — running in-memory only. The spam-image blocklist will reset on restart.'
    );
    return;
  }

  const adapter = new PrismaPg(DATABASE_URL);
  const client = new PrismaClient({ adapter });
  try {
    await client.$connect();
    prisma = client;
    container.logger.info('Database connection success');
  } catch (error) {
    container.logger.error(
      'Database connection failed — continuing without persistence.',
      error
    );
  }
}
