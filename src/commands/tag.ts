import { ApplicationCommandRegistry, Command } from '@sapphire/framework';
import { MessageEmbed } from 'discord.js';
import { version } from './../../package.json';

export class TagCommand extends Command {
  public constructor(context: Command.Context, options: Command.Options) {
    super(context, {
      ...options,
      description: 'Send a tag ephemerally.',
    });
  }
  public override registerApplicationCommands(
    registry: ApplicationCommandRegistry
  ) {
    registry.registerChatInputCommand((builder) => {
      builder //
      .setName(this.name).setDescription(this.description)
      .addUserOption((option): any => {
        option //
        .setName('tag')
        .setDescription('Tag to send')
        .setRequired(true)
      })
    });
  }

  public override chatInputRun(interaction: Command.ChatInputInteraction) {
    return interaction.reply({
      embeds: [
        new MessageEmbed().setTitle('About Arduino Bot').addFields([
          { name: 'Bot Version', value: version, inline: true },
          { name: 'Node Version', value: process.version, inline: true },
          {
            name: 'Contributing',
            value: '[GitHub](https://github.com/BluLightShow/arduino-bot)',
            inline: true
          },
        ]),
      ],
      ephemeral: true
    });
  }
}
