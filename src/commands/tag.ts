import { ApplicationCommandRegistry, Command } from '@sapphire/framework';
import { EmbedBuilder, MessageFlags } from 'discord.js';
import { BOT_COMMANDS_CHANNEL_ID } from '../utils/config';
import tags from '../utils/tags';
import { resolveTag } from '../utils/resolveTag';
import universalEmbed from '../index';

export class TagCommand extends Command {
  public constructor(context: Command.Context, options: Command.Options) {
    super(context, {
      ...options,
      name: 'tag',
      description: 'Send a tag ephemerally.',
    });
  }

  public override registerApplicationCommands(
    registry: ApplicationCommandRegistry,
  ) {
    registry.registerChatInputCommand((builder) => {
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('Tag to see')
            .setRequired(true)
            .addChoices(
              { name: 'AI', value: 'ai' },
              { name: 'ask', value: 'ask' },
              { name: 'avrdude', value: 'avrdude' },
              { name: 'codeblock', value: 'codeblock' },
              { name: 'debounce', value: 'debounce' },
              { name: 'espcomm', value: 'espcomm' },
              { name: 'help', value: 'help' },
              { name: 'hid', value: 'hid' },
              { name: 'lab', value: 'lab' },
              { name: 'language', value: 'language' },
              { name: 'levelShifter', value: 'levelShifter' },
              { name: 'libmissing', value: 'libmissing' },
              { name: 'needinfo', value: 'needinfo' },
              { name: 'ninevolt', value: 'ninevolt' },
              { name: 'power', value: 'power' },
              { name: 'pullup', value: 'pullup' },
              { name: 'reinstall', value: 'reinstall' },
              { name: 'wiki', value: 'wiki' },
            ),
        )
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('User to ping in the bot commands channel.')
            .setRequired(false),
        );
    });
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction
  ) {
    const tagName = interaction.options.getString('name', true);
    const user = interaction.options.getUser('user');

    const tag = tags[tagName];
    const payload = resolveTag(tagName, user?.id);
    if (!tag || !payload)
      return interaction.reply({
        content: 'That tag does not exist.',
        flags: MessageFlags.Ephemeral,
      });

    // Ping the requested user when the tag didn't already include a mention.
    if (user && !payload.content) payload.content = `<@${user.id}>`;

    // Tags default to bot-commands-channel-only unless they opt out.
    if (tag.botCommandsOnly === false) return interaction.reply(payload);

    const botCommandsChannel = await interaction.client.channels
      .fetch(BOT_COMMANDS_CHANNEL_ID)
      .catch(() => null);
    if (!botCommandsChannel?.isSendable())
      return interaction.reply({
        content: 'The bot-commands channel is unavailable.',
        flags: MessageFlags.Ephemeral,
      });

    await botCommandsChannel.send(payload);

    if (user)
      return interaction.reply({
        content: `<@${user.id}> you've been tagged with standard helpful info.`,
        embeds: [
          new EmbedBuilder(universalEmbed)
            .setTitle('Your answer is in the Bot-Commands Channel...')
            .setDescription(`See <#${BOT_COMMANDS_CHANNEL_ID}> for your info!`),
        ],
      });
    return interaction.reply({
      embeds: [
        new EmbedBuilder(universalEmbed)
          .setTitle('Requested info was sent in the Bot-Commands Channel')
          .setDescription(`See <#${BOT_COMMANDS_CHANNEL_ID}> for your info!`),
      ],
      flags: MessageFlags.Ephemeral,
    });
  }
}
