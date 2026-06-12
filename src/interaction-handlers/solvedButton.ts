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
import { applySolved, canMarkSolved } from '../utils/solveThread';

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
    const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('solved')
        .setLabel('✅ Solved')
        .setStyle(ButtonStyle.Success)
        .setDisabled(true)
    );
    await interaction.message
      .edit({ components: [disabledRow] })
      .catch(() => null);
    await applySolved(channel);
    return undefined;
  }
}
