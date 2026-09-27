import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  type ButtonInteraction,
} from 'discord.js';
import universalEmbed from '../utils/embed';
import {
  applySolved,
  canMarkSolved,
  describeSolveFailure,
  fetchAskerIds,
  needsStarterLookup,
} from '../utils/solveThread';
import { isHomeGuild } from '../utils/homeGuild';

/** Handles the "Mark Solved" button posted in help threads (forum or text). */
export class SolvedButtonHandler extends InteractionHandler {
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
    if (interaction.customId !== 'solved') return this.none();
    return isHomeGuild(interaction.guildId) ? this.some() : this.none();
  }

  public async run(interaction: ButtonInteraction) {
    const channel = interaction.channel;
    if (!channel?.isThread())
      return interaction.reply({
        content: 'This button only works inside a help post.',
        flags: MessageFlags.Ephemeral,
      });

    const isStaff =
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages) ??
      false;

    // Checking a text-channel thread's starter message can be slow; acknowledge
    // the click first so Discord's 3s window is never missed.
    const slow = needsStarterLookup(channel, interaction.user.id, isStaff);
    if (slow) await interaction.deferUpdate();
    const check = canMarkSolved(
      channel,
      interaction.user.id,
      isStaff,
      slow ? await fetchAskerIds(channel) : undefined
    );
    if (!check.ok) {
      const refusal = { content: check.reason, flags: MessageFlags.Ephemeral } as const;
      return slow ? interaction.followUp(refusal) : interaction.reply(refusal);
    }

    const embed = new EmbedBuilder(universalEmbed)
      .setTitle('✅ Marked solved')
      .setDescription(`Closed by <@${interaction.user.id}>.`);
    if (slow) await interaction.followUp({ embeds: [embed] });
    else await interaction.reply({ embeds: [embed] });

    // Disable the button so it can't be clicked again, then close the thread.
    const originalComponents = interaction.message.components;
    const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('solved')
        .setLabel('Solved')
        .setStyle(ButtonStyle.Success)
        .setDisabled(true)
    );
    await interaction.message
      .edit({ components: [disabledRow] })
      .catch(() => null);
    const result = await applySolved(channel);
    const failure = describeSolveFailure(result);
    if (failure) {
      this.container.logger.warn(
        `[solved] Failed to fully close thread ${channel.id} (renamed=${result.renamed}, archived=${result.archived}):`,
        result.error
      );
      // Thread is still open: put the original button back so it can be retried.
      if (!result.archived)
        await interaction.message
          .edit({ components: originalComponents })
          .catch(() => null);
      await interaction
        .followUp({ content: failure, flags: MessageFlags.Ephemeral })
        .catch(() => null);
    }
    return undefined;
  }
}
