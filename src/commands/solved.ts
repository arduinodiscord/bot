import { ApplicationCommandRegistry, Command } from '@sapphire/framework';
import {
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';
import universalEmbed from '../utils/embed';
import {
  applySolved,
  canMarkSolved,
  describeSolveFailure,
} from '../utils/solveThread';

export class SolvedCommand extends Command {
  public constructor(context: Command.Context, options: Command.Options) {
    super(context, {
      ...options,
      name: 'solved',
      description: 'Mark this help post as solved and close it.',
    });
  }

  public override registerApplicationCommands(
    registry: ApplicationCommandRegistry
  ) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .setContexts(InteractionContextType.Guild)
        .addUserOption((option) =>
          option
            .setName('helper')
            .setDescription('Credit the member who helped you')
        )
    );
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction
  ) {
    const channel = interaction.channel;
    if (!channel?.isThread())
      return interaction.reply({
        content: 'Use this inside a help post or thread.',
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

    const helper = interaction.options.getUser('helper');
    const embed = new EmbedBuilder(universalEmbed)
      .setTitle('✅ Marked solved')
      .setDescription(
        helper
          ? `Thanks to <@${helper.id}> for helping. Closing this post.`
          : 'Closing this post.'
      );

    await interaction.reply({ embeds: [embed] });
    const result = await applySolved(channel);
    const failure = describeSolveFailure(result);
    if (failure) {
      this.container.logger.warn(
        `[solved] Failed to fully close thread ${channel.id} (renamed=${result.renamed}, archived=${result.archived}):`,
        result.error
      );
      await interaction
        .followUp({ content: failure, flags: MessageFlags.Ephemeral })
        .catch(() => null);
    }
    return undefined;
  }
}
