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
  fanout: '🚨 Possible image spam',
  blocklist: '🚨 Possible image spam',
  burst: '🚨 Possible image spam',
  suspect: '🚨 Possible image spam',
  flood: '🚨 Possible message flooding',
  crosspost: '🚨 Possible cross-channel question spam',
};

/** What an automatic action did, shown when the bot acted before a human. */
const HIGH_CONFIDENCE_NOTE =
  'High-confidence signal: the messages were deleted and the user was timed out automatically. Review and escalate or reverse below.';
const CRITICAL_NOTE =
  'Known scam image: the messages were deleted and the user was banned automatically. Review and reverse below if needed.';
const AUTO_ACTION_NOTE: Record<IncidentLevel, string> = {
  fanout: HIGH_CONFIDENCE_NOTE,
  blocklist: HIGH_CONFIDENCE_NOTE,
  burst: HIGH_CONFIDENCE_NOTE,
  suspect: HIGH_CONFIDENCE_NOTE,
  flood: 'The user was timed out automatically. Review and escalate or reverse below.',
  crosspost:
    'The duplicate crossposts were deleted automatically (the first copy was kept). Review and escalate or reverse below.',
};

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

/** Build the alert message moderators see in the console channel. */
export function buildAlertPayload(
  incident: Incident,
  member: GuildMember | null,
  autoActed: boolean,
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
        value: `**${LEVEL_LABEL[incident.level]}** — ${incident.reason}`,
      },
      {
        name: 'Confidence',
        value: `${incident.tier.toUpperCase()} — ${incident.score}/100`,
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

  if (autoActed) {
    const autoNote =
      incident.tier === 'critical' ? CRITICAL_NOTE : AUTO_ACTION_NOTE[incident.level];
    embed.addFields({ name: '🔒 Auto-action taken', value: autoNote });
  }

  if (incident.learning) {
    embed.addFields({
      name: '📚 Learning mode',
      value:
        'Posted because the spam corpus is still training — this may well be legit. ' +
        'Use **Confirm spam / Confirm scam → ban / Not spam** to teach the filter; ' +
        'learning mode retires itself once enough images are confirmed.',
    });
  }

  // Row 1: confirmscam, confirm, timeout, ban  (4 buttons)
  // Row 2: delete, dismiss                     (2 buttons)
  // Total: 6 buttons across 2 rows — no row exceeds the Discord limit of 5.
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    actionButton('confirmscam', '⛔ Confirm scam → ban', ButtonStyle.Danger, incident.id),
    actionButton('confirm', '✅ Confirm spam', ButtonStyle.Danger, incident.id),
    actionButton('timeout', '⏳ Timeout', ButtonStyle.Secondary, incident.id),
    actionButton('ban', '🔨 Ban', ButtonStyle.Danger, incident.id)
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    actionButton('delete', '🗑️ Delete msgs', ButtonStyle.Secondary, incident.id),
    actionButton('dismiss', '👌 Not spam', ButtonStyle.Success, incident.id)
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
  if (!member || !member.moderatable) return false;
  return member
    .timeout(automodConfig.timeoutMs, reason)
    .then(() => true)
    .catch(() => false);
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
  if (member && (!member.bannable || isAutomodImmune(member))) return false;
  return guild.members
    .ban(userId, { reason, deleteMessageSeconds: 24 * 60 * 60 })
    .then(() => true)
    .catch(() => false);
}

/** Delete every message recorded on an incident. Returns the count deleted. */
export async function deleteIncidentMessages(
  client: Client,
  incident: Incident
): Promise<number> {
  let deleted = 0;
  for (const { channelId, messageId } of incident.messages) {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased() || channel.isDMBased()) continue;
    const ok = await channel.messages
      .delete(messageId)
      .then(() => true)
      .catch(() => false);
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
