import {
  Events,
  Listener,
  type ContextMenuCommandDeniedPayload,
  type UserError,
} from '@sapphire/framework';
import { MessageFlags } from 'discord.js';

/** Tell the user why a context-menu command was refused by a precondition. */
export class ContextMenuCommandDeniedListener extends Listener {
  public constructor(context: Listener.Context, options: Listener.Options) {
    super(context, { ...options, event: Events.ContextMenuCommandDenied });
  }

  public async run(error: UserError, { interaction }: ContextMenuCommandDeniedPayload) {
    const reply = { content: error.message, flags: MessageFlags.Ephemeral } as const;
    await (interaction.deferred || interaction.replied
      ? interaction.followUp(reply)
      : interaction.reply(reply)
    ).catch(() => null);
  }
}
