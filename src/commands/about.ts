import { ApplicationCommandRegistry, Command } from '@sapphire/framework';
import { MessageEmbed } from 'discord.js';
import { version } from './../../package.json';
import universalEmbed from '../index'

export class AboutCommand extends Command {
  public constructor(context: Command.Context, options: Command.Options) {
    super(context, {
      ...options,
      name: 'about',
      description: 'Retrieve information about this bot.',
    });
  }
  public override registerApplicationCommands(
    registry: ApplicationCommandRegistry
  ) {
    registry.registerChatInputCommand((builder) => {
      builder.setName(this.name).setDescription(this.description);
    });
  }

  public override chatInputRun(interaction: Command.ChatInputInteraction) {
    return interaction.reply({
      embeds: [
        new MessageEmbed(universalEmbed).setTitle('About Arduino Bot').addFields([
          { name: 'Bot Version', value: version, inline: true },
          { name: 'Node Version', value: process.version, inline: true },
          {
            name: 'Contributing',
            value: '[GitHub](https://github.com/BluLightShow/arduino-bot)',
            inline: true
          },
        ]),
      ],
    });
  }
}
