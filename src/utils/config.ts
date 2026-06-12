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
  // Server-management features. Each self-disables when its id is unset.
  JOIN_LEAVE_LOG_CHANNEL_ID = '', // member join/leave + invite-source logging
  CROSSPOST_LOG_CHANNEL_ID = '', // where auto-crosspost results are logged
  ROLE_SELECT_MESSAGE_ID = '', // message whose buttons toggle opt-in roles
  EVENT_NOTIFS_ROLE_ID = '', // role toggled by the "events" button
  SERVER_UPDATE_NOTIFS_ROLE_ID = '', // role toggled by the "server_updates" button
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

/** Announcement/feed channels whose messages are auto-published (crossposted). */
export const crosspostChannelIds = idList(process.env.CROSSPOST_CHANNEL_IDS);

/**
 * Forum channels treated as "help" forums: new posts get a "Mark Solved" button.
 * The /solved command works in any thread regardless of this list.
 */
export const helpForumChannelIds = idList(process.env.HELP_FORUM_CHANNEL_IDS);

/** Whether the keyword -> tag auto-suggester is active (on unless "false"). */
export const tagSuggestEnabled = process.env.TAG_SUGGEST_ENABLED !== 'false';

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
  /**
   * Max Hamming distance (out of 64) for two perceptual hashes to count as the
   * same image. Higher = more lenient/near-duplicate matching. Default 6.
   */
  phashThreshold: posInt(process.env.AUTOMOD_PHASH_THRESHOLD, 6),
  /** Sliding window (ms) for detecting cross-channel fan-out. */
  fanoutWindowMs: posInt(process.env.AUTOMOD_FANOUT_WINDOW_MS, 120_000),
  /** How long (ms) auto-applied/console timeouts last. Default 1 hour. */
  timeoutMs: posInt(process.env.AUTOMOD_TIMEOUT_MS, 60 * 60 * 1000),
  /** Minimum gap (ms) between alerts for the same user, to avoid alert spam. */
  alertCooldownMs: posInt(process.env.AUTOMOD_ALERT_COOLDOWN_MS, 30_000),
  /** Roles whose members are never inspected or actioned by the automod. */
  immuneRoleIds: idList(process.env.AUTOMOD_IMMUNE_ROLE_IDS),
  /**
   * How long after joining (ms) a member is treated as "new", so their image
   * posts are scrutinised harder. Default 72 hours.
   */
  newMemberWindowMs: posInt(process.env.AUTOMOD_NEW_MEMBER_WINDOW_MS, 72 * 60 * 60 * 1000),
  /**
   * Stricter burst threshold applied to new members (catches join-then-spam
   * faster). Should be <= burstThreshold. Default 2.
   */
  newMemberBurstThreshold: posInt(process.env.AUTOMOD_NEW_MEMBER_BURST_THRESHOLD, 2),

  // --- Text-flooding detector ---
  /** Whether the text-flooding detector is active (on unless "false"). */
  floodEnabled: process.env.AUTOMOD_FLOOD_ENABLED !== 'false',
  /**
   * Number of short messages from one user within `floodWindowMs` to flag
   * flooding (a user fragmenting one thought across many tiny messages).
   */
  floodThreshold: posInt(process.env.AUTOMOD_FLOOD_THRESHOLD, 5),
  /** Sliding window (ms) for counting flood messages. Default 15s. */
  floodWindowMs: posInt(process.env.AUTOMOD_FLOOD_WINDOW_MS, 15_000),
  /**
   * A message counts toward flooding only if its trimmed content length is at
   * most this. Longer messages are treated as normal conversation. Default 25.
   */
  floodMaxChars: posInt(process.env.AUTOMOD_FLOOD_MAX_CHARS, 25),
  /**
   * When true, the bot also times the user out automatically on a flood hit.
   * Off by default: flooding is usually a habit, not an attack, so by default
   * we only alert moderators and let them decide.
   */
  floodAutoTimeout: process.env.AUTOMOD_FLOOD_AUTO_TIMEOUT === 'true',
};
