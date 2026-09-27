import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  TimestampStyles,
  time,
  type Client,
  type Guild,
  GuildMember,
  type MessageCreateOptions,
} from 'discord.js';
import { container } from '@sapphire/framework';
import { automodConfig } from '../config';
import { getPrisma } from '../db';
import type { Incident, IncidentLevel } from './incidents';

/** Embed color driven by confidence tier rather than incident level. */
function tierColor(tier: Incident['tier']): number {
  switch (tier) {
    case 'critical':
    case 'high':
      return 0xe03131; // red
    case 'medium':
      return 0xf08c00; // amber
    case 'low':
    default:
      return 0x868e96; // grey
  }
}

const LEVEL_LABEL: Record<IncidentLevel, string> = {
  fanout: 'Cross-channel fan-out',
  blocklist: 'Known spam image',
  burst: 'Image burst',
  suspect: 'Suspicious image',
  flood: 'Message flooding',
  crosspost: 'Cross-channel question spam',
};

/** Headline shown at the top of an alert, by incident kind. */
const LEVEL_TITLE: Record<IncidentLevel, string> = {
  fanout: 'Possible image spam',
  blocklist: 'Possible image spam',
  burst: 'Possible image spam',
  suspect: 'Possible image spam',
  flood: 'Possible message flooding',
  crosspost: 'Possible cross-channel question spam',
};

/**
 * What the bot actually did automatically before a human saw the alert. Each
 * field is only present when that action was attempted, so the alert can
 * report real outcomes instead of assuming success.
 */
export interface AutoActionResult {
  /** Messages deleted (or already gone) out of `attempted`. */
  deleted?: number;
  attempted?: number;
  timedOut?: boolean;
  banned?: boolean;
}

/** Alert field that reports what the bot already did (tests key off this). */
export const AUTO_ACTION_FIELD = 'Already done automatically';

const tick = (ok: boolean) => (ok ? '✅' : '❌');

/** Human-readable summary of an auto-action, flagging anything that failed. */
function describeAutoAction(result: AutoActionResult): string {
  const parts: string[] = [];
  if (result.attempted !== undefined)
    parts.push(
      `${tick(result.deleted === result.attempted)} Deleted ${result.deleted ?? 0}/${result.attempted} message(s)`
    );
  if (result.timedOut !== undefined)
    parts.push(`${tick(result.timedOut)} ${result.timedOut ? 'Timed out' : 'Timeout FAILED'}`);
  if (result.banned !== undefined)
    parts.push(`${tick(result.banned)} ${result.banned ? 'Banned' : 'Ban FAILED'}`);
  const failed =
    (result.attempted !== undefined && result.deleted !== result.attempted) ||
    result.timedOut === false ||
    result.banned === false;
  return (
    parts.join('\n') +
    (failed
      ? '\n**Some actions failed.** Check that the bot has Manage Messages, Moderate Members and Ban Members, and that its role is above the user\'s. Use the buttons below or act manually.'
      : '\nUse the buttons below to go further or undo.')
  );
}

/** Whether an auto-action result recorded any attempted action. */
export const attemptedAutoAction = (result: AutoActionResult | null): result is AutoActionResult =>
  result !== null &&
  (result.attempted !== undefined || result.timedOut !== undefined || result.banned !== undefined);

/** One moderation action button bound to an incident id. */
function actionButton(
  action: string,
  label: string,
  style: ButtonStyle,
  incidentId: string
): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(`automod:${action}:${incidentId}`)
    .setLabel(label)
    .setStyle(style);
}

/** Plain explanation of every alert button, shown on each alert. */
const BUTTON_GUIDE = [
  '**Confirm scam**: only for real scam graphics. Deletes the messages and bans the poster plus other accounts that posted the same image (up to 10 accounts). Blocklists the image, so anyone who posts it again is banned automatically. Also adds words from the image text to the scam filter.',
  '**Confirm spam**: deletes the messages, times out the user and blocklists the image as spam. Future posts of it are deleted and the poster is timed out automatically.',
  '**Time out only** / **Ban this user only** / **Delete messages only**: act on this user or these messages. Nothing is blocklisted. Ban also deletes their last 24 hours of messages.',
  '**Not spam**: permanently allowlists the image so it is never flagged again, and lifts the timeout the bot applied. Deleted messages cannot be restored.',
].join('\n');

/** Build the alert message moderators see in the console channel. */
export function buildAlertPayload(
  incident: Incident,
  member: GuildMember | null,
  autoAction: AutoActionResult | null,
  previewUrl?: string
): MessageCreateOptions {
  const channelMentions =
    [...new Set(incident.messages.map((m) => `<#${m.channelId}>`))].join(' ') ||
    '—';

  const jumpLinks =
    incident.messages
      .slice(0, 5)
      .map(
        (m, i) =>
          `[#${i + 1}](https://discord.com/channels/${incident.guildId}/${m.channelId}/${m.messageId})`
      )
      .join(' • ') || '—';

  // Confidence tier drives the embed color.
  const embed = new EmbedBuilder()
    .setColor(tierColor(incident.tier))
    .setTitle(LEVEL_TITLE[incident.level])
    .setDescription(`<@${incident.userId}> \`${incident.userId}\``)
    .addFields(
      {
        name: 'Signal',
        value: `**${LEVEL_LABEL[incident.level]}**: ${incident.reason}`,
      },
      {
        name: 'Confidence',
        value: `${incident.tier.toUpperCase()} (${incident.score}/100)`,
        inline: true,
      },
      { name: 'Channels', value: channelMentions, inline: true },
      { name: 'Messages', value: String(incident.messages.length), inline: true }
    );

  // Signal breakdown — note: points are indicative weights, not addends.
  const signalsValue =
    incident.matched.length > 0
      ? incident.matched.map((m) => `• ${m.label} (+${m.points})`).join('\n')
      : '—';
  embed.addFields({ name: 'Signals (indicative weights)', value: signalsValue });

  // Cross-user cluster accounts (cap at 10).
  if (incident.clusterUserIds.length > 1) {
    const cap = 10;
    const shown = incident.clusterUserIds.slice(0, cap);
    const overflow = incident.clusterUserIds.length - shown.length;
    const accountsValue =
      shown.map((id) => `<@${id}>`).join(' ') + (overflow > 0 ? ` +${overflow} more` : '');
    embed.addFields({ name: 'Accounts', value: accountsValue });
  }

  // OCR detected text (untrusted — hard-capped at 200 chars, newlines collapsed).
  if (incident.ocrText.length > 0) {
    const MAX_OCR = 180;
    let ocrDisplay = incident.ocrText.replace(/\s*\n\s*/g, ' ').trim();
    if (ocrDisplay.length > MAX_OCR) {
      ocrDisplay = ocrDisplay.slice(0, MAX_OCR) + '…';
    }
    embed.addFields({ name: 'Detected text', value: ocrDisplay });
  }

  // Thumbnail: prefer the offending image preview; fall back to member avatar.
  if (previewUrl) {
    embed.setThumbnail(previewUrl);
    if (member) {
      embed
        .setAuthor({ name: member.user.tag, iconURL: member.displayAvatarURL() })
        .addFields(
          {
            name: 'Account created',
            value: time(member.user.createdAt, TimestampStyles.RelativeTime),
            inline: true,
          },
          {
            name: 'Joined server',
            value: member.joinedAt
              ? time(member.joinedAt, TimestampStyles.RelativeTime)
              : 'unknown',
            inline: true,
          }
        );
    }
  } else if (member) {
    embed
      .setThumbnail(member.displayAvatarURL())
      .setFooter({ text: member.user.tag })
      .addFields(
        {
          name: 'Account created',
          value: time(member.user.createdAt, TimestampStyles.RelativeTime),
          inline: true,
        },
        {
          name: 'Joined server',
          value: member.joinedAt
            ? time(member.joinedAt, TimestampStyles.RelativeTime)
            : 'unknown',
          inline: true,
        }
      );
  }

  embed.addFields({ name: 'Jump to messages', value: jumpLinks });

  if (attemptedAutoAction(autoAction)) {
    embed.addFields({ name: AUTO_ACTION_FIELD, value: describeAutoAction(autoAction) });
  }

  if (incident.learning) {
    embed.addFields({
      name: 'Learning mode',
      value:
        'The filter is still collecting examples, so it posts images it is unsure about. ' +
        'This one may be fine. Your choice of Confirm scam, Confirm spam or Not spam trains it. ' +
        'Learning mode turns itself off once enough images have been confirmed.',
    });
  }

  embed.addFields({
    name: 'What the buttons do',
    value: BUTTON_GUIDE,
  });

  // Row 1: confirmscam, confirm, timeout, ban  (4 buttons)
  // Row 2: delete, dismiss                     (2 buttons)
  // Total: 6 buttons across 2 rows — no row exceeds the Discord limit of 5.
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    actionButton('confirmscam', 'Confirm scam: ban all posters, auto-ban image', ButtonStyle.Danger, incident.id),
    actionButton('confirm', 'Confirm spam: delete, time out, auto-delete image', ButtonStyle.Danger, incident.id),
    actionButton('timeout', 'Time out only', ButtonStyle.Secondary, incident.id),
    actionButton('ban', 'Ban this user only', ButtonStyle.Danger, incident.id)
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    actionButton('delete', 'Delete messages only', ButtonStyle.Secondary, incident.id),
    actionButton('dismiss', 'Not spam: allowlist image, lift timeout', ButtonStyle.Success, incident.id)
  );

  return { embeds: [embed], components: [row1, row2] };
}

/** Apply a timeout to a member. Returns false if blocked by hierarchy/perms. */
export async function timeoutMember(
  guild: Guild,
  userId: string,
  reason: string
): Promise<boolean> {
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) {
    container.logger.warn(`Automod: cannot time out ${userId}: not in the guild.`);
    return false;
  }
  if (!member.moderatable) {
    container.logger.warn(
      `Automod: cannot time out ${userId}: missing Moderate Members or their role is above the bot's.`
    );
    return false;
  }
  return member
    .timeout(automodConfig.timeoutMs, reason)
    .then(() => true)
    .catch((error) => {
      container.logger.warn(`Automod: timing out ${userId} failed:`, error);
      return false;
    });
}

/**
 * Whether a member is exempt from automod enforcement: staff (Manage Messages)
 * or any configured immune role.
 */
function isAutomodImmune(member: GuildMember): boolean {
  if (member.permissions.has(PermissionFlagsBits.ManageMessages)) return true;
  return automodConfig.immuneRoleIds.some((id) => member.roles.cache.has(id));
}

/**
 * Ban a member and scrub their last day of messages. Guards every ban path
 * (auto and manual): if the target is still in the guild and is either
 * automod-immune or not bannable (hierarchy/perms), the ban is skipped and
 * `false` is returned. A user who has already left the guild is banned by id
 * (departed raid accounts are intended targets).
 */
export async function banMember(
  guild: Guild,
  userId: string,
  reason: string
): Promise<boolean> {
  const member = await guild.members.fetch(userId).catch(() => null);
  if (member && isAutomodImmune(member)) {
    container.logger.warn(`Automod: refusing to ban ${userId}: member is automod-immune.`);
    return false;
  }
  if (member && !member.bannable) {
    container.logger.warn(
      `Automod: cannot ban ${userId}: missing Ban Members or their role is above the bot's.`
    );
    return false;
  }
  return guild.members
    .ban(userId, { reason, deleteMessageSeconds: 24 * 60 * 60 })
    .then(() => true)
    .catch((error) => {
      container.logger.warn(`Automod: banning ${userId} failed:`, error);
      return false;
    });
}

/** Discord error code for a message that no longer exists. */
const UNKNOWN_MESSAGE = 10008;

/**
 * Delete every message recorded on an incident. Returns how many are gone —
 * a message that was already deleted (by its author, a mod, or an earlier
 * pass) counts as gone, since the goal is achieved.
 */
export async function deleteIncidentMessages(
  client: Client,
  incident: Pick<Incident, 'messages'>
): Promise<number> {
  let deleted = 0;
  for (const { channelId, messageId } of incident.messages) {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased() || channel.isDMBased()) {
      container.logger.warn(`Automod: cannot delete ${messageId}: channel ${channelId} unavailable.`);
      continue;
    }
    const ok = await channel.messages
      .delete(messageId)
      .then(() => true)
      .catch((error: { code?: number }) => {
        if (error?.code === UNKNOWN_MESSAGE) return true;
        container.logger.warn(`Automod: deleting ${messageId} in ${channelId} failed:`, error);
        return false;
      });
    if (ok) deleted++;
  }
  return deleted;
}

/** Best-effort audit log of a moderation action (no-op without a database). */
export async function logModerationAction(
  moderatorId: string,
  targetId: string,
  action: string,
  reason: string
): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;
  try {
    await prisma.moderationAction.create({
      data: { moderatorId, targetId, action, reason },
    });
  } catch (error) {
    container.logger.error('Logging moderation action failed:', error);
  }
}
