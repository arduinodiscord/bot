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
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addStringOption((option) => 
          option
            .setName('name')
            .setDescription('Tag to see')
            .setRequired(true)
            .addChoices(
              { name: 'ask', value: 'ask' },
              { name: 'avrdude', value: 'avrdude' },
              { name: 'codeblock', value: 'codeblock' },
              { name: 'espcomm', value: 'espcomm' },
              { name: 'hid', value: 'hid' },
              { name: 'language', value: 'language' },
              { name: 'libmissing', value: 'libmissing' },
              { name: 'power', value: 'power' },
              { name: 'pullup', value: 'pullup' },
              //{ name: 'template', value: 'template' }
            )
        );
    });
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const option = interaction.options.get('name');
    const tagRequested = option?.value as keyof typeof tags;
    const tag = tags[tagRequested];

    if (!tag) {
      return interaction.reply({ content: 'That tag does not exist.', ephemeral: true });
    }

    // If the tag is an object (with embeds/components), spread it; otherwise, send as content
    if (typeof tag === 'object') {
      return interaction.reply({ ...tag,});
    } else {
      return interaction.reply({ content: tag,});
    }
  }
}
