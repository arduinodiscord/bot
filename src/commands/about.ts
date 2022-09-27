import { ApplicationCommandRegistry, Command } from '@sapphire/framework';
import { MessageEmbed } from 'discord.js';
import fs from 'fs'
const packageJSON = JSON.parse(fs.readFileSync('../../package.json'))

export class AboutCommand extends Command {
  public constructor(context: Command.Context, options: Command.Options) {
    super(context, {
      ...options,
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
      embeds: [new MessageEmbed()
        .setTitle('About Arduino Bot')
        .addFields([
          { name: 'Bot Version', value: packageJSON.version},
          { name: 'Node Version', value: process.version}
        ])
      ]
    });
  }
}
