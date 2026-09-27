import {
  Events,
  Listener,
  type ChatInputCommandDeniedPayload,
  type UserError,
} from '@sapphire/framework';
import { MessageFlags } from 'discord.js';

/** Tell the user why a slash command was refused by a precondition. */
export class ChatInputCommandDeniedListener extends Listener {
  public constructor(context: Listener.Context, options: Listener.Options) {
    super(context, { ...options, event: Events.ChatInputCommandDenied });
  }

  public async run(error: UserError, { interaction }: ChatInputCommandDeniedPayload) {
    const reply = { content: error.message, flags: MessageFlags.Ephemeral } as const;
    await (interaction.deferred || interaction.replied
      ? interaction.followUp(reply)
      : interaction.reply(reply)
    ).catch(() => null);
  }
}
