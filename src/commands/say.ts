import { ApplicationCommandRegistry, Command } from '@sapphire/framework';
import {
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';
import universalEmbed from '../index';

const MAX_FIELDS = 25;

export class SayCommand extends Command {
  public constructor(context: Command.Context, options: Command.Options) {
    super(context, {
      ...options,
      name: 'say',
      description: 'Send a custom embed to a channel as the bot (staff only).',
    });
  }

  public override registerApplicationCommands(
    registry: ApplicationCommandRegistry
  ) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Channel to send the embed in')
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildAnnouncement
            )
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('title')
            .setDescription('Embed title')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('description')
            .setDescription('Embed description')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('fields')
            .setDescription('Optional fields, one per line as: name | value')
        )
        .addStringOption((option) =>
          option
            .setName('thumbnail')
            .setDescription('Optional thumbnail image URL')
        )
    );
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction
  ) {
    // Belt-and-braces: the command is also gated by default member permissions.
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild))
      return interaction.reply({
        content: 'You need the Manage Server permission to use this.',
        flags: MessageFlags.Ephemeral,
      });

    const picked = interaction.options.getChannel('channel', true);
    const channel = await interaction.client.channels
      .fetch(picked.id)
      .catch(() => null);
    if (!channel?.isSendable())
      return interaction.reply({
        content: 'I can\'t send messages in that channel.',
        flags: MessageFlags.Ephemeral,
      });

    const embed = new EmbedBuilder(universalEmbed)
      .setTitle(interaction.options.getString('title', true))
      .setDescription(interaction.options.getString('description', true))
      .setTimestamp();

    const thumbnail = interaction.options.getString('thumbnail');
    if (thumbnail) {
      if (!URL.canParse(thumbnail))
        return interaction.reply({
          content: 'The thumbnail must be a valid URL.',
          flags: MessageFlags.Ephemeral,
        });
      embed.setThumbnail(thumbnail);
    }

    const fields = this.parseFields(interaction.options.getString('fields'));
    if (fields.length > 0) embed.addFields(fields);

    try {
      await channel.send({ embeds: [embed] });
    } catch (error) {
      this.container.logger.error('/say failed to send:', error);
      return interaction.reply({
        content: 'Something went wrong sending the embed.',
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.reply({
      content: `✅ Sent to <#${picked.id}>.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  /** Parse newline-separated `name | value` pairs into embed fields. */
  private parseFields(raw: string | null): { name: string; value: string }[] {
    if (!raw) return [];
    return raw
      .split('\n')
      .map((line) => line.split('|'))
      .filter((parts) => parts.length >= 2 && parts[0].trim() && parts[1].trim())
      .slice(0, MAX_FIELDS)
      .map((parts) => ({
        name: parts[0].trim(),
        value: parts.slice(1).join('|').trim(),
      }));
  }
}
