import { ApplicationCommandRegistry, Command } from '@sapphire/framework';
import { TextChannel } from 'discord.js';
import { BOT_COMMANDS_CHANNEL_ID } from '../../utils/config';
import tags from '../utils/tags';


export class TagCommand extends Command {
  public constructor(context: Command.Context, options: Command.Options) {
    super(context, {
      ...options,
      name: 'tag',
      description: 'Send a tag ephemerally.',
    });
  }

  public override registerApplicationCommands(
    registry: ApplicationCommandRegistry
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
              // Keep existing choices
              { name: 'ask', value: 'ask' },
              { name: 'avrdude', value: 'avrdude' },
              { name: 'codeblock', value: 'codeblock' },
              { name: 'debounce', value: 'debounce' },
              { name: 'espcomm', value: 'espcomm' },
              { name: 'hid', value: 'hid' },
              { name: 'language', value: 'language' },
              { name: 'levelShifter', value: 'levelShifter' },
              { name: 'libmissing', value: 'libmissing' },
              { name: 'ninevolt', value: 'ninevolt' },
              { name: 'power', value: 'power' },
              { name: 'pullup', value: 'pullup' },
              { name: 'wiki', value: 'wiki' }
            )
        )
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('User to ping in the bot-commands channel')
            .setRequired(false)
        );
    });
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const tagName = interaction.options.getString('name', true) as keyof typeof tags;
    const user = interaction.options.getUser('user');
    const tag = tags[tagName];

    if (!tag) {
      return interaction.reply({ content: 'That tag does not exist.', ephemeral: true });
    }

    const botCommandsChannel = await interaction.guild?.channels.fetch(BOT_COMMANDS_CHANNEL_ID);

    if (!botCommandsChannel || !(botCommandsChannel instanceof TextChannel)) {
      return interaction.reply({
        content: 'Bot commands channel not found or is not a text channel.',
        ephemeral: true,
      });
    }

    let messagePayload: any = {};

    if (typeof tag === 'object') {
      messagePayload = { ...tag };
      if (user) {
        messagePayload.content = `<@${user.id}>`;
      }
    } else {
      messagePayload.content = user ? `<@${user.id}> ${tag}` : tag;
    }

    await botCommandsChannel.send(messagePayload);

    if (user) {
      // My goal is to  Notify the user in the original channel (not ephemeral)
      return interaction.reply({
        content: `Hey <@${user.id}>, check the <#${BOT_COMMANDS_CHANNEL_ID}> channel for info!`,
        ephemeral: false,
      });
    } else {
      // Ephemeral reply for normal tag
      return interaction.reply({
        content: 'Tag information posted to the #bot-commands channel.',
        ephemeral: true,
      });
    }
  }
}
