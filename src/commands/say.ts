import { ApplicationCommandRegistry, Command } from '@sapphire/framework';
import {
  ChannelType,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  type APIEmbed,
} from 'discord.js';
import universalEmbed from '../utils/embed';
import { embedLimitProblems } from '../utils/embedLimits';

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
        .setContexts(InteractionContextType.Guild)
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
            .setDescription('Embed description (type \\n for a line break)')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('fields')
            .setDescription('Optional fields: Name::Value | Name::Value (\\n = line break)')
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

    const thumbnail = interaction.options.getString('thumbnail');
    if (thumbnail && !/^https?:\/\//i.test(thumbnail))
      return interaction.reply({
        content: 'The thumbnail must be an http(s) URL.',
        flags: MessageFlags.Ephemeral,
      });

    const parsed = parseFields(interaction.options.getString('fields'));
    if ('error' in parsed)
      return interaction.reply({
        content: parsed.error,
        flags: MessageFlags.Ephemeral,
      });

    // Build plain data and validate it ourselves: the EmbedBuilder setters
    // throw on over-long input, which would leave the interaction unanswered.
    const embed: APIEmbed = {
      ...universalEmbed,
      title: interaction.options.getString('title', true),
      description: withLineBreaks(
        interaction.options.getString('description', true)
      ),
      timestamp: new Date().toISOString(),
    };
    if (thumbnail) embed.thumbnail = { url: thumbnail };
    if (parsed.fields.length > 0) embed.fields = parsed.fields;

    const problems = embedLimitProblems(embed);
    if (problems.length > 0)
      return interaction.reply({
        content: `That embed cannot be sent:\n- ${problems.join('\n- ')}`,
        flags: MessageFlags.Ephemeral,
      });

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
    } catch (error) {
      this.container.logger.error('/say failed to send:', error);
      return interaction.editReply({
        content: 'Could not send the embed. Check my permissions in that channel and the thumbnail URL.',
      });
    }

    return interaction.editReply({ content: `Sent to <#${picked.id}>.` });
  }
}

/** Slash-command strings can't contain newlines; let staff type a literal \\n instead. */
function withLineBreaks(text: string): string {
  return text.replace(/\\n/g, '\n');
}

type ParsedFields =
  | { fields: { name: string; value: string }[] }
  | { error: string };

/**
 * Parse `Name::Value | Name::Value` into embed fields. `|` separates fields
 * and the first `::` in each separates its name from its value. Malformed
 * input is reported rather than silently dropped.
 */
function parseFields(raw: string | null): ParsedFields {
  if (!raw?.trim()) return { fields: [] };
  const fields: { name: string; value: string }[] = [];
  const segments = raw.split('|').map((s) => s.trim()).filter(Boolean);
  for (const [i, segment] of segments.entries()) {
    const sep = segment.indexOf('::');
    if (sep === -1)
      return {
        error: `Field ${i + 1} ("${segment.slice(0, 50)}") is missing \`::\` between its name and value. Format: \`Name::Value | Name::Value\``,
      };
    fields.push({
      name: segment.slice(0, sep).trim(),
      value: withLineBreaks(segment.slice(sep + 2).trim()),
    });
  }
  return { fields };
}
