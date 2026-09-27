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
import { claimIncident, restoreIncident, type Incident } from '../utils/automod/incidents';
import { addToBlocklist, addToAllowlist } from '../utils/automod/blocklist';
import { tokenizeOcr, learnKeywords } from '../utils/automod/keywords';
import {
  banMember,
  deleteIncidentMessages,
  logModerationAction,
  timeoutMember,
} from '../utils/automod/console';
import { clearUser } from '../utils/automod/tracker';
import { clearFloodUser } from '../utils/automod/flood';
import { clearCrosspostUser } from '../utils/automod/crosspost';

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
        content: 'You need the Manage Messages permission to use these buttons.',
        flags: MessageFlags.Ephemeral,
      });

    if (!interaction.guild)
      return interaction.reply({ content: 'This only works in a server.', flags: MessageFlags.Ephemeral });
    // Claim before any await so two moderators can't both run the action.
    const incident = claimIncident(parsed.incidentId);
    if (!incident)
      return interaction.reply({
        content:
          'This alert has already been handled by another moderator, or it has expired (older than 24 hours, or the bot restarted). Act on the user manually if needed.',
        flags: MessageFlags.Ephemeral,
      });

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const summary = await this.apply(interaction, parsed.action, incident);
      await logModerationAction(
        interaction.user.id,
        incident.userId,
        parsed.action,
        incident.reason
      );
      await this.resolveAlert(interaction, summary);
      return interaction.editReply({ content: summary });
    } catch (error) {
      container.logger.error(
        `Automod: moderation action "${parsed.action}" on incident ${incident.id} failed:`,
        error
      );
      // Let another click retry; actions are safe to repeat.
      restoreIncident(incident);
      const content =
        'Something went wrong while applying that action, and it stopped partway. Try the button again or act on the user manually.';
      return interaction.deferred || interaction.replied
        ? interaction.editReply({ content }).catch(() => null)
        : interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => null);
    }
  }

  /** Perform a moderation action and return a summary for the moderator. */
  private async apply(
    interaction: ButtonInteraction,
    action: string,
    incident: Incident
  ): Promise<string> {
    const guild = interaction.guild!;
    const moderator = interaction.user;
    let summary: string;

    switch (action) {
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
          incident.hashes,
          moderator.id,
          'confirmed image spam',
          'spam'
        );
        clearUser(incident.userId);
        clearFloodUser(incident.userId);
        clearCrosspostUser(incident.userId);
        const fingerprints = incident.signatures.length + incident.hashes.length;
        const blocklisted = fingerprints
          ? ` Blocklisted ${fingerprints} image fingerprint(s) as spam.`
          : '';
        summary = `Confirmed spam. Deleted ${deleted} message(s). ${
          timedOut ? 'Timed out the user.' : '**Could not** time out the user.'
        }${blocklisted}`;
        break;
      }
      case 'timeout': {
        const ok = await timeoutMember(
          guild,
          incident.userId,
          `Automod review by ${moderator.tag}`
        );
        summary = ok
          ? 'Timed out the user.'
          : 'Could not time out the user. Check the bot\'s role position and permissions.';
        break;
      }
      case 'ban': {
        const ok = await banMember(
          guild,
          incident.userId,
          `Automod review by ${moderator.tag}`
        );
        clearUser(incident.userId);
        clearFloodUser(incident.userId);
        clearCrosspostUser(incident.userId);
        summary = ok
          ? 'Banned the user and deleted their messages from the last 24 hours.'
          : 'Could not ban the user. Check the bot\'s role position and permissions.';
        break;
      }
      case 'delete': {
        const deleted = await deleteIncidentMessages(
          container.client,
          incident
        );
        summary = `Deleted ${deleted} message(s).`;
        break;
      }
      case 'confirmscam': {
        const deleted = await deleteIncidentMessages(container.client, incident);
        const targets = [...new Set([incident.userId, ...incident.clusterUserIds])].slice(0, 10);
        let banned = 0;
        for (const id of targets)
          if (await banMember(guild, id, `Confirmed scam by ${moderator.tag}`)) banned++;
        await addToBlocklist(incident.signatures, incident.hashes, moderator.id, 'confirmed scam', 'scam');
        if (incident.ocrText) await learnKeywords(tokenizeOcr(incident.ocrText), moderator.id);
        clearUser(incident.userId);
        clearFloodUser(incident.userId);
        clearCrosspostUser(incident.userId);
        summary = `Confirmed scam. Banned ${banned}/${targets.length} account(s) and deleted ${deleted} message(s). The image is blocklisted as a scam${
          incident.ocrText ? ' and its text was added to the scam filter' : ''
        }.`;
        break;
      }
      case 'dismiss': {
        await addToAllowlist(incident.signatures, incident.hashes, moderator.id, 'marked not spam');
        clearUser(incident.userId);
        clearFloodUser(incident.userId);
        clearCrosspostUser(incident.userId);
        // Undo the bot's own automatic timeout. Deleted messages cannot be
        // restored, so say so.
        let undo = '';
        if (incident.autoTimedOut) {
          const member = await guild.members.fetch(incident.userId).catch(() => null);
          const lifted = await member
            ?.timeout(null, `Automod false positive — marked not spam by ${moderator.tag}`)
            .then(() => true)
            .catch(() => false);
          undo = lifted
            ? ' Lifted the automatic timeout.'
            : ' **Could not** lift the automatic timeout. Remove it manually.';
        }
        if (incident.messages.length > 0 && incident.autoTimedOut)
          undo += ' The deleted messages cannot be restored, so you may want to let the user know.';
        summary = `Marked as not spam. The image(s) are allowlisted.${undo}`;
        break;
      }
      default:
        summary = 'Unknown action.';
    }
    return summary;
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
