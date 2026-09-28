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
  fetchAskerIds,
  needsStarterLookup,
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

    const helper = interaction.options.getUser('helper');
    const embed = new EmbedBuilder(universalEmbed)
      .setTitle('✅ Marked solved')
      .setDescription(
        helper
          ? `Thanks to <@${helper.id}> for helping. Closing this post.`
          : 'Closing this post.'
      );

    if (needsStarterLookup(channel, interaction.user.id, isStaff)) {
      // Text-channel thread opened by someone else: the asker may be the
      // author of the starter message. Fetching it can be slow, so defer
      // (privately, in case the answer is no) before looking.
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const check = canMarkSolved(
        channel,
        interaction.user.id,
        isStaff,
        await fetchAskerIds(channel)
      );
      if (!check.ok) return interaction.editReply({ content: check.reason });

      embed.setDescription(
        helper
          ? `Marked solved by <@${interaction.user.id}>. Thanks to <@${helper.id}> for helping. Closing this post.`
          : `Marked solved by <@${interaction.user.id}>. Closing this post.`
      );
      await channel
        .send({ embeds: [embed], allowedMentions: { parse: [] } })
        .catch(() => null);
      await interaction.editReply({ content: 'Marked solved.' });
    } else {
      const check = canMarkSolved(channel, interaction.user.id, isStaff);
      if (!check.ok)
        return interaction.reply({
          content: check.reason,
          flags: MessageFlags.Ephemeral,
        });
      await interaction.reply({ embeds: [embed] });
    }

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
