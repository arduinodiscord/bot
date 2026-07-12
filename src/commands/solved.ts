import { ApplicationCommandRegistry, Command } from '@sapphire/framework';
import { EmbedBuilder, MessageFlags, PermissionFlagsBits } from 'discord.js';
import universalEmbed from '../utils/embed';
import { applySolved, canMarkSolved } from '../utils/solveThread';

export class SolvedCommand extends Command {
  public constructor(context: Command.Context, options: Command.Options) {
    super(context, {
      ...options,
      name: 'solved',
      description: 'Mark the current help post/thread as solved.',
    });
  }

  public override registerApplicationCommands(
    registry: ApplicationCommandRegistry
  ) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .setDMPermission(false)
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
          ? `Thanks for the help, <@${helper.id}>! 🎉`
          : 'Glad it’s sorted! Closing this post.'
      );

    await interaction.reply({ embeds: [embed] });
    await applySolved(channel);
    return undefined;
  }
}
