import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  TimestampStyles,
  time,
  type Client,
  type Guild,
  type GuildMember,
  type MessageCreateOptions,
} from 'discord.js';
import { container } from '@sapphire/framework';
import { automodConfig } from '../config';
import { getPrisma } from '../db';
import type { Incident, IncidentLevel } from './incidents';

const LEVEL_COLOR: Record<IncidentLevel, number> = {
  fanout: 0xe03131, // high confidence — red
  blocklist: 0xe03131,
  burst: 0xf08c00, // needs review — amber
  flood: 0xf08c00, // needs review — amber
  crosspost: 0xe03131, // cross-channel — red
};

const LEVEL_LABEL: Record<IncidentLevel, string> = {
  fanout: 'Cross-channel fan-out',
  blocklist: 'Known spam image',
  burst: 'Image burst',
  flood: 'Message flooding',
  crosspost: 'Cross-channel question spam',
};

/** Headline shown at the top of an alert, by incident kind. */
const LEVEL_TITLE: Record<IncidentLevel, string> = {
  fanout: '🚨 Possible image spam',
  blocklist: '🚨 Possible image spam',
  burst: '🚨 Possible image spam',
  flood: '🚨 Possible message flooding',
  crosspost: '🚨 Possible cross-channel question spam',
};

/** What an automatic action did, shown when the bot acted before a human. */
const HIGH_CONFIDENCE_NOTE =
  'High-confidence signal: the messages were deleted and the user was timed out automatically. Review and escalate or reverse below.';
const AUTO_ACTION_NOTE: Record<IncidentLevel, string> = {
  fanout: HIGH_CONFIDENCE_NOTE,
  blocklist: HIGH_CONFIDENCE_NOTE,
  burst: HIGH_CONFIDENCE_NOTE,
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
  autoActed: boolean
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

  const embed = new EmbedBuilder()
    .setColor(LEVEL_COLOR[incident.level])
    .setTitle(LEVEL_TITLE[incident.level])
    .setDescription(`<@${incident.userId}> \`${incident.userId}\``)
    .addFields(
      {
        name: 'Signal',
        value: `**${LEVEL_LABEL[incident.level]}** — ${incident.reason}`,
      },
      { name: 'Channels', value: channelMentions, inline: true },
      { name: 'Messages', value: String(incident.messages.length), inline: true }
    );

  if (member) {
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

  if (autoActed)
    embed.addFields({
      name: '🔒 Auto-action taken',
      value: AUTO_ACTION_NOTE[incident.level],
    });

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
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

/** Ban a member and scrub their last day of messages. */
export async function banMember(
  guild: Guild,
  userId: string,
  reason: string
): Promise<boolean> {
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
