import { ApplicationCommandRegistry, Command } from '@sapphire/framework';
import { TextChannel, EmbedBuilder } from 'discord.js';
import { BOT_COMMANDS_CHANNEL_ID } from '../utils/config';
import tags from '../utils/tags';
import universalEmbed from '../index'


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
              { name: 'AI', value: 'ai' },
              { name: 'ask', value: 'ask' },
              { name: 'avrdude', value: 'avrdude' },
              { name: 'codeblock', value: 'codeblock' },
              { name: 'debounce', value: 'debounce' },
              { name: 'espcomm', value: 'espcomm' },
              { name: 'hid', value: 'hid' },
              { name: 'language', value: 'language' },
              { name: 'levelShifter', value: 'levelShifter' },
              { name: 'libmissing', value: 'libmissing' },
              { name: 'needinfo', value: 'needinfo' },
              { name: 'ninevolt', value: 'ninevolt' },
              { name: 'power', value: 'power' },
              { name: 'pullup', value: 'pullup' },
              { name: 'wiki', value: 'wiki' }
            )
        )
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('User to ping in the bot commands channel.')
            .setRequired(false)
        );
    });
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const option = interaction.options.get('name');
    const tagName = option?.value as keyof typeof tags;
    const user = interaction.options.getUser('user');
    const tag = tags[tagName];
    const botCommandsOnly = tag.botCommandsOnly !== false; // Defaults to true if missing

    // Role restriction check (uncomment and use if needed)
    // if (tag.requiredRoles) {
    //   const member = await interaction.guild?.members.fetch(interaction.user.id);
    //   const hasRole = member?.roles.cache.some(role =>
    //     tag.requiredRoles.includes(role.name) || tag.requiredRoles.includes(role.id)
    //   );
    //   if (!hasRole) {
    //     return interaction.reply({
    //       content: "You do not have permission to use this tag.",
    //       ephemeral: true,
    //     });
    //   }
    // }

    // If tag is allowed in any channel, reply there
    if (!botCommandsOnly) {
      if (typeof tag === 'object' && tag.content) {
        return interaction.reply({ content: typeof tag.content === 'function' ? tag.content(user?.id) : tag.content, ephemeral: false });
      } else if (typeof tag === 'string') {
        return interaction.reply({ content: tag, ephemeral: false });
      }
    }


    // Tag not found
    if (!tag) {
      return interaction.reply({ content: 'That tag does not exist.', ephemeral: true });
    }

    // Fetch bot-commands channel


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
      // If tag.content is a function, call it with user id
      if (tag.content) {
        messagePayload.content = typeof tag.content === 'function'
          ? tag.content(user?.id)
          : tag.content;
      }
      if (user && !messagePayload.content) {
        messagePayload.content = `<@${user.id}>`;
      }
    } else {
      messagePayload.content = user ? `<@${user.id}> ${tag}` : tag;
    }

    await botCommandsChannel.send(messagePayload);

    if (user) {
      // Notify the user in the original channel (not ephemeral)
      return interaction.reply({
        content: `<@${user.id}>`,
        ephemeral: false,
        embeds: [
          new EmbedBuilder(universalEmbed)
          .setTitle("Tag Sent")
          .setDescription(`See <#${BOT_COMMANDS_CHANNEL_ID}>`)
        ],
      });
    } else {
      // Ephemeral reply for normal tag
      return interaction.reply({
        content: ``,
        ephemeral: true,
        embeds: [
          new EmbedBuilder(universalEmbed)
          .setTitle("Tag Sent")
          .setDescription(`See <#${BOT_COMMANDS_CHANNEL_ID}>`)
        ],
      });
    }
  }
}
