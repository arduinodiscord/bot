import { container } from '@sapphire/framework';
import {
  ChannelType,
  PermissionFlagsBits,
  type Client,
  type Guild,
  type GuildBasedChannel,
} from 'discord.js';
import {
  BOT_COMMANDS_CHANNEL_ID,
  MOD_LOG_CHANNEL_ID,
  SERVER_ID,
  helpAssistConfig,
  helpChannelIds,
} from './config';

const P = PermissionFlagsBits;

/** Guild-wide permissions each feature needs; missing ones are logged by name. */
const GUILD_PERMISSIONS: Array<[string, bigint]> = [
  ['ManageMessages (automod delete)', P.ManageMessages],
  ['ModerateMembers (automod timeout)', P.ModerateMembers],
  ['BanMembers (automod ban)', P.BanMembers],
];

const SEND_PERMISSIONS: Array<[string, bigint]> = [
  ['ViewChannel', P.ViewChannel],
  ['SendMessages', P.SendMessages],
  ['EmbedLinks', P.EmbedLinks],
];

const HELP_PERMISSIONS: Array<[string, bigint]> = [
  ['ViewChannel', P.ViewChannel],
  ['ReadMessageHistory (stale-post sweep)', P.ReadMessageHistory],
  ['SendMessagesInThreads', P.SendMessagesInThreads],
  ['ManageThreads (solve/archive)', P.ManageThreads],
];

/** Discord's longest auto-archive duration: idle threads close after 7 days. */
const MAX_THREAD_IDLE_HOURS = 168;

/**
 * Stale-sweep timings that can never fire. Discord archives an idle thread
 * after at most 7 days, and archived threads drop out of the sweep, so a nudge
 * at 168h or later (or an archive wait over 168h after the nudge) never happens.
 */
export function staleTimingProblems(nudgeMs: number, archiveMs: number): string[] {
  const nudgeHours = nudgeMs / 3_600_000;
  const archiveHours = archiveMs / 3_600_000;
  const problems: string[] = [];
  if (nudgeHours >= MAX_THREAD_IDLE_HOURS)
    problems.push(
      `HELP_STALE_NUDGE_HOURS=${nudgeHours} is not below ${MAX_THREAD_IDLE_HOURS}: Discord archives idle threads after 7 days, so posts will never be nudged`
    );
  if (archiveHours > MAX_THREAD_IDLE_HOURS)
    problems.push(
      `HELP_STALE_ARCHIVE_HOURS=${archiveHours} is over ${MAX_THREAD_IDLE_HOURS}: Discord archives idle threads after 7 days, so this wait never finishes`
    );
  return problems;
}

function missing(
  channel: GuildBasedChannel,
  guild: Guild,
  required: Array<[string, bigint]>
): string[] {
  const me = guild.members.me;
  if (!me) return ['(bot member not cached)'];
  const perms = channel.permissionsFor(me);
  return required.filter(([, flag]) => !perms?.has(flag)).map(([name]) => name);
}

/**
 * Verify at startup that the configured guild, channels, and permissions line
 * up, and log every problem loudly. The bot keeps running regardless — this
 * exists so a misconfiguration shows up in the first screen of logs instead of
 * as months of silent inaction.
 *
 * Returns the number of problems found.
 */
export async function runStartupCheck(client: Client<true>): Promise<number> {
  const { logger } = container;
  const problems: string[] = [];

  const guild = await client.guilds.fetch(SERVER_ID).catch(() => null);
  if (!guild) {
    logger.error(
      `Startup check: bot is not in SERVER_ID=${SERVER_ID}. Automod, tags, suggestions and help features will do NOTHING. Guilds the bot is in: ${
        client.guilds.cache.map((g) => `${g.name} (${g.id})`).join(', ') || 'none'
      }`
    );
    return 1;
  }
  await guild.members.fetchMe().catch(() => null);

  const checkChannel = async (
    label: string,
    id: string,
    required: Array<[string, bigint]>
  ) => {
    const channel = await guild.channels.fetch(id).catch(() => null);
    if (!channel) {
      problems.push(`${label} ${id} not found in ${guild.name}`);
      return;
    }
    const gaps = missing(channel, guild, required);
    if (gaps.length > 0)
      problems.push(`${label} #${channel.name}: missing ${gaps.join(', ')}`);
  };

  await checkChannel('BOT_COMMANDS_CHANNEL_ID', BOT_COMMANDS_CHANNEL_ID, SEND_PERMISSIONS);

  if (MOD_LOG_CHANNEL_ID) {
    // Alerts attach a copy of the offending image (the original gets deleted).
    await checkChannel('MOD_LOG_CHANNEL_ID', MOD_LOG_CHANNEL_ID, [
      ...SEND_PERMISSIONS,
      ['AttachFiles (alert evidence image)', P.AttachFiles],
    ]);
    const me = guild.members.me;
    const gaps = GUILD_PERMISSIONS.filter(([, flag]) => !me?.permissions.has(flag)).map(
      ([name]) => name
    );
    if (gaps.length > 0) problems.push(`automod guild permissions missing: ${gaps.join(', ')}`);
    if (me && me.roles.highest.position <= 1)
      problems.push(
        `bot's highest role (${me.roles.highest.name}) is at the bottom of the role list — it cannot time out or ban anyone with a role`
      );
  }

  for (const id of helpChannelIds) {
    const channel = await guild.channels.fetch(id).catch(() => null);
    if (!channel) {
      problems.push(`HELP_CHANNEL_IDS entry ${id} not found`);
      continue;
    }
    if (channel.type !== ChannelType.GuildForum && channel.type !== ChannelType.GuildText)
      problems.push(`HELP_CHANNEL_IDS entry #${channel.name} is not a forum or text channel`);
    const gaps = missing(channel, guild, HELP_PERMISSIONS);
    if (gaps.length > 0) problems.push(`help channel #${channel.name}: missing ${gaps.join(', ')}`);
  }

  if (helpChannelIds.length > 0 && helpAssistConfig.staleSweepEnabled)
    problems.push(
      ...staleTimingProblems(helpAssistConfig.staleNudgeMs, helpAssistConfig.staleArchiveMs)
    );

  if (problems.length === 0) {
    logger.info(`Startup check: OK (guild ${guild.name}, all configured channels and permissions present).`);
  } else {
    for (const p of problems) logger.warn(`Startup check: ${p}`);
  }
  return problems.length;
}
