import { Command } from '@sapphire/framework';
import { ApplicationCommandType } from 'discord-api-types/v9';
import { Formatters, GuildMember } from 'discord.js';

export class BoopCommand extends Command {
  public constructor(context: Command.Context, options: Command.Options) {
    super(context, {
      ...options,
      description: 'Boop user.',
    });
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerContextMenuCommand((builder) =>
      builder //
        .setName(this.name)
        .setType(ApplicationCommandType.User)
    );
  }

  public override async contextMenuRun(
    interaction: Command.ContextMenuInteraction
  ) {
    // Use isUserContextMenu() to ensure this command was executed as a User Context Menu Command
    if (
      interaction.isUserContextMenu() &&
      interaction.targetMember instanceof GuildMember
    ) {
      return interaction.reply({
        content: `BOOP`,
      });
    }
  }
}
