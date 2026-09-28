import { Precondition } from '@sapphire/framework';
import type {
  ChatInputCommandInteraction,
  ContextMenuCommandInteraction,
  Message,
} from 'discord.js';
import { HOME_GUILD_ONLY_MESSAGE, isHomeGuild } from '../utils/homeGuild';

/**
 * Global precondition (runs before every command): refuse anything used
 * outside SERVER_ID. The refusal is sent by the commandDenied listener.
 */
export class HomeGuildPrecondition extends Precondition {
  public constructor(
    context: Precondition.LoaderContext,
    options: Precondition.Options
  ) {
    super(context, { ...options, position: 20 });
  }

  public override chatInputRun(interaction: ChatInputCommandInteraction) {
    return this.check(interaction.guildId);
  }

  public override contextMenuRun(interaction: ContextMenuCommandInteraction) {
    return this.check(interaction.guildId);
  }

  public override messageRun(message: Message) {
    return this.check(message.guildId);
  }

  private check(guildId: string | null) {
    return isHomeGuild(guildId)
      ? this.ok()
      : this.error({ identifier: 'HomeGuild', message: HOME_GUILD_ONLY_MESSAGE });
  }
}
