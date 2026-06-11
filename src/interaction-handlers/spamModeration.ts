import {
  InteractionHandler,
  InteractionHandlerTypes,
  container,
} from '@sapphire/framework';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  type ButtonComponent,
  type ButtonInteraction,
} from 'discord.js';
import { deleteIncident, getIncident } from '../utils/automod/incidents';
import { addToBlocklist } from '../utils/automod/blocklist';
import {
  banMember,
  deleteIncidentMessages,
  logModerationAction,
  timeoutMember,
} from '../utils/automod/console';
import { clearUser } from '../utils/automod/tracker';

interface ParsedButton {
  action: string;
  incidentId: string;
}

export class SpamModerationHandler extends InteractionHandler {
  public constructor(
    context: InteractionHandler.LoaderContext,
    options: InteractionHandler.Options
  ) {
    super(context, {
      ...options,
      interactionHandlerType: InteractionHandlerTypes.Button,
    });
  }

  public override parse(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith('automod:')) return this.none();
    const [, action, incidentId] = interaction.customId.split(':');
    return this.some({ action, incidentId });
  }

  public async run(interaction: ButtonInteraction, parsed: ParsedButton) {
    // Only staff (anyone who can delete messages) may action alerts.
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages))
      return interaction.reply({
        content: 'You need the Manage Messages permission to action spam alerts.',
        flags: MessageFlags.Ephemeral,
      });

    const incident = getIncident(parsed.incidentId);
    if (!incident || !interaction.guild)
      return interaction.reply({
        content:
          'This alert has expired (the incident is no longer tracked, likely due to a bot restart). Please action the user manually.',
        flags: MessageFlags.Ephemeral,
      });

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const { guild } = interaction;
    const moderator = interaction.user;
    let summary: string;

    switch (parsed.action) {
      case 'confirm': {
        const deleted = await deleteIncidentMessages(
          container.client,
          incident
        );
        const timedOut = await timeoutMember(
          guild,
          incident.userId,
          `Confirmed image spam by ${moderator.tag}`
        );
        await addToBlocklist(
          incident.signatures,
          moderator.id,
          'confirmed image spam'
        );
        clearUser(incident.userId);
        summary = `✅ Confirmed spam — deleted ${deleted} message(s), ${
          timedOut ? 'timed out the user' : '**could not** time out the user'
        }, and blocklisted ${incident.signatures.length} image signature(s).`;
        break;
      }
      case 'timeout': {
        const ok = await timeoutMember(
          guild,
          incident.userId,
          `Automod review by ${moderator.tag}`
        );
        summary = ok
          ? '⏳ User timed out.'
          : '⚠️ Could not time out the user (check role hierarchy and permissions).';
        break;
      }
      case 'ban': {
        const ok = await banMember(
          guild,
          incident.userId,
          `Automod review by ${moderator.tag}`
        );
        clearUser(incident.userId);
        summary = ok
          ? '🔨 User banned and recent messages purged.'
          : '⚠️ Could not ban the user (check role hierarchy and permissions).';
        break;
      }
      case 'delete': {
        const deleted = await deleteIncidentMessages(
          container.client,
          incident
        );
        summary = `🗑️ Deleted ${deleted} message(s).`;
        break;
      }
      case 'dismiss': {
        clearUser(incident.userId);
        summary =
          '👌 Marked as not spam. Cleared tracking for this user; no action taken.';
        break;
      }
      default:
        summary = 'Unknown action.';
    }

    await logModerationAction(
      moderator.id,
      incident.userId,
      parsed.action,
      incident.reason
    );
    deleteIncident(parsed.incidentId);
    await this.resolveAlert(interaction, summary);
    return interaction.editReply({ content: summary });
  }

  /** Disable the alert's buttons and stamp it with the resolution. */
  private async resolveAlert(
    interaction: ButtonInteraction,
    summary: string
  ): Promise<void> {
    const disabledRows = interaction.message.components
      .filter((row) => row.type === ComponentType.ActionRow)
      .map((row) => {
        const rebuilt = new ActionRowBuilder<ButtonBuilder>();
        for (const component of row.components)
          if (component.type === ComponentType.Button)
            rebuilt.addComponents(
              ButtonBuilder.from(component as ButtonComponent).setDisabled(true)
            );
        return rebuilt;
      });

    const original = interaction.message.embeds[0];
    const embed = (original ? EmbedBuilder.from(original) : new EmbedBuilder())
      .setColor(0x868e96)
      .addFields({
        name: 'Resolution',
        value: `${summary}\nActioned by <@${interaction.user.id}>`,
      });

    await interaction.message
      .edit({ embeds: [embed], components: disabledRows })
      .catch(() => null);
  }
}
