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
} from '../utils/solveThread';

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
    return interaction.customId === 'solved' ? this.some() : this.none();
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
    const check = canMarkSolved(channel, interaction.user.id, isStaff);
    if (!check.ok)
      return interaction.reply({
        content: check.reason,
        flags: MessageFlags.Ephemeral,
      });

    const embed = new EmbedBuilder(universalEmbed)
      .setTitle('✅ Marked solved')
      .setDescription(`Closed by <@${interaction.user.id}>.`);
    await interaction.reply({ embeds: [embed] });

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
