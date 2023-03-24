import { ApplicationCommandRegistry, Command } from '@sapphire/framework';
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
      builder //
        .setName(this.name)
        .setDescription(this.description)
        .addStringOption((option): any => {
          option //
            .setName('name')
            .setDescription('Tag to see')
            .setRequired(true)
            .addChoices(
              { name: 'ask', value: 'ask' },
              { name: 'avrdude', value: 'avrdude' },
              { name: 'codeblock', value: 'codeblock' },
              // { name: 'espcomm', value: 'espcomm' },
              // { name: 'hid', value: 'hid' },
              // { name: 'language', value: 'language' },
              // { name: 'libmissing', value: 'libmissing' },
              // { name: 'pin', value: 'pin' },
              // { name: 'pullup', value: 'pullup' },
              // { name: 'template', value: 'template' }
            )
            return option
        })
    })
  }

  public override chatInputRun(interaction: Command.ChatInputInteraction) {
    let tagRequested = interaction.options.getString('name')! as keyof typeof tags
    return interaction.reply(tags[tagRequested])
  }
}
