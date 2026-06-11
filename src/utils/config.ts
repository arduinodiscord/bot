import 'dotenv/config';

// TODO: zod validation would be nicer to have here

// const requiredEnvironment = ['BOT_TOKEN', 'DATABASE_URL'];
const requiredEnvironment = ['BOT_TOKEN'];

const missingEnv = requiredEnvironment.filter((req) => !process.env[req]);

if (missingEnv.length > 0)
  throw new Error(
    'Missing required environment variables: \n- ' + missingEnv.join('\n- ')
  );
// This should be the server and the bot commands channel id's.
export const {
  BOT_TOKEN = '',
  SERVER_ID = '420594746990526466', // Arduino Official Server
  BOT_COMMANDS_CHANNEL_ID = '451158319361556491', // Arduino Official Bot Channel
  // Channel where automod posts spam alerts for moderators to action.
  // Leave unset to disable the automod console entirely.
  MOD_LOG_CHANNEL_ID = '',
  // Optional: persistence for the spam-image blocklist. When unset the bot
  // runs fully in-memory and the blocklist resets on restart.
  DATABASE_URL = '',
} = process.env;

/** Parse a positive integer from the environment, falling back to a default. */
const posInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

/** Parse a comma-separated list of ids from the environment. */
const idList = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

/**
 * Tunables for the image-spam detector. Every value is overridable via the
 * environment so moderators can adjust thresholds without a redeploy.
 */
export const automodConfig = {
  /** Number of image messages from one user within `burstWindowMs` to flag a burst. */
  burstThreshold: posInt(process.env.AUTOMOD_BURST_THRESHOLD, 3),
  /** Sliding window (ms) for counting an image burst. */
  burstWindowMs: posInt(process.env.AUTOMOD_BURST_WINDOW_MS, 60_000),
  /** Distinct channels the same image must appear in to flag a fan-out. */
  fanoutChannels: posInt(process.env.AUTOMOD_FANOUT_CHANNELS, 2),
  /** Sliding window (ms) for detecting cross-channel fan-out. */
  fanoutWindowMs: posInt(process.env.AUTOMOD_FANOUT_WINDOW_MS, 120_000),
  /** How long (ms) auto-applied/console timeouts last. Default 1 hour. */
  timeoutMs: posInt(process.env.AUTOMOD_TIMEOUT_MS, 60 * 60 * 1000),
  /** Minimum gap (ms) between alerts for the same user, to avoid alert spam. */
  alertCooldownMs: posInt(process.env.AUTOMOD_ALERT_COOLDOWN_MS, 30_000),
  /** Roles whose members are never inspected or actioned by the automod. */
  immuneRoleIds: idList(process.env.AUTOMOD_IMMUNE_ROLE_IDS),
};
