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
 * Channels treated as "help" channels. Entries may be **forum** channels (each
 * post is a thread) or **regular text** channels (threads opened inside them get
 * the same treatment): new help threads get a "Mark Solved" button and, when
 * thin, the needinfo checklist, and the stale-post sweep / `/openposts` track
 * them. The /solved command works in any thread regardless of this list.
 *
 * Reads HELP_CHANNEL_IDS (preferred) and the legacy HELP_FORUM_CHANNEL_IDS,
 * merged and de-duplicated, so existing configs keep working.
 */
export const helpChannelIds = [
  ...new Set([
    ...idList(process.env.HELP_CHANNEL_IDS),
    ...idList(process.env.HELP_FORUM_CHANNEL_IDS),
  ]),
];

/** Whether the keyword -> tag auto-suggester is active (on unless "false"). */
export const tagSuggestEnabled = process.env.TAG_SUGGEST_ENABLED !== 'false';

/** Whether to nudge users who paste unformatted code toward the codeblock tag. */
export const codeFormatSuggestEnabled =
  process.env.CODE_FORMAT_SUGGEST_ENABLED !== 'false';

/** Whether to nudge "can I ask?" / "anyone here?" non-questions toward the ask tag. */
export const askSuggestEnabled = process.env.ASK_SUGGEST_ENABLED !== 'false';

/**
 * Help-channel quality-of-life knobs. The auto-needinfo and stale-post sweep
 * only do anything when `helpChannelIds` is configured.
 */
export const helpAssistConfig = {
  /** Auto-post the needinfo checklist when a new help post is too thin. */
  autoNeedinfo: process.env.HELP_AUTO_NEEDINFO !== 'false',
  /** A starter message shorter than this (and without code) counts as "thin". */
  needinfoMinChars: posInt(process.env.HELP_NEEDINFO_MIN_CHARS, 60),
  /** Whether the stale-post nudge/auto-archive sweep runs. */
  staleSweepEnabled: process.env.HELP_STALE_SWEEP_ENABLED !== 'false',
  /**
   * Idle time (ms) before an open help post gets a "still need help?" nudge.
   * Default 72h (3 days) — helpers often take a while to reach a post.
   */
  staleNudgeMs: posInt(process.env.HELP_STALE_NUDGE_HOURS, 72) * 60 * 60 * 1000,
  /**
   * Idle time (ms) after a nudge, with no human reply, before auto-archiving.
   * Default 168h (7 days) on top of the nudge wait, so nothing is archived from
   * under a slow-but-active conversation.
   */
  staleArchiveMs: posInt(process.env.HELP_STALE_ARCHIVE_HOURS, 168) * 60 * 60 * 1000,
};

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

  // --- Cross-channel question-spam detector ---
  /** Whether the cross-channel question-spam detector is active (on unless "false"). */
  crosspostEnabled: process.env.AUTOMOD_CROSSPOST_ENABLED !== 'false',
  /**
   * Distinct channels the same (or near-identical) message must span within
   * `crosspostWindowMs` to flag a cross-channel repeat. Applies at any tenure.
   */
  crosspostChannels: posInt(process.env.AUTOMOD_CROSSPOST_CHANNELS, 2),
  /**
   * Distinct channels a *new* member must post substantive messages in within
   * the window to flag content-agnostic "shotgunning" (they reworded enough to
   * dodge the similarity check but are clearly asking everywhere at once).
   */
  crosspostSpreadChannels: posInt(process.env.AUTOMOD_CROSSPOST_SPREAD_CHANNELS, 3),
  /** Sliding window (ms) for cross-channel detection. Default 2 minutes. */
  crosspostWindowMs: posInt(process.env.AUTOMOD_CROSSPOST_WINDOW_MS, 120_000),
  /**
   * Minimum trimmed length for a message to be considered a "question" worth
   * tracking — keeps greetings/reactions ("hi", "ok") from tripping the
   * detector. Default 12.
   */
  crosspostMinChars: posInt(process.env.AUTOMOD_CROSSPOST_MIN_CHARS, 12),
  /**
   * Token-overlap (Jaccard) percentage at which two messages count as the
   * "same" question. Higher = stricter. Default 80%.
   */
  crosspostSimilarityPct: posInt(process.env.AUTOMOD_CROSSPOST_SIMILARITY_PCT, 80),
};
