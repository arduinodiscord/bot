import { ApplicationCommandRegistry, Command } from '@sapphire/framework';
import { ApplicationCommandType, MessageFlags } from 'discord.js';
import { resolveTag } from '../utils/resolveTag';

/**
 * Right-click a message → "Request more info" posts the `needinfo` checklist as
 * a reply to that message, pinging its author. Saves helpers from typing out
 * (or remembering) `/tag needinfo` for the most common ask.
 */
export class RequestInfoCommand extends Command {
  public constructor(context: Command.Context, options: Command.Options) {
    super(context, { ...options, name: 'Request more info' });
  }

  public override registerApplicationCommands(
    registry: ApplicationCommandRegistry
  ) {
    registry.registerContextMenuCommand((builder) =>
      builder
        .setName('Request more info')
        .setType(ApplicationCommandType.Message)
        .setDMPermission(false)
    );
  }

  public override async contextMenuRun(
    interaction: Command.ContextMenuCommandInteraction
  ) {
    if (!interaction.isMessageContextMenuCommand()) return;

    const target = interaction.targetMessage;
    const payload = resolveTag('needinfo', target.author.id);
    if (!payload?.content)
      return interaction.reply({
        content: 'The needinfo tag is unavailable.',
        flags: MessageFlags.Ephemeral,
      });

    const sent = await target
      .reply({
        content: payload.content,
        allowedMentions: { users: [target.author.id] },
      })
      .catch(() => null);

    // If replying to the original message failed (e.g. it was deleted), fall
    // back to a normal channel message.
    if (!sent && interaction.channel?.isSendable())
      await interaction.channel
        .send({
          content: payload.content,
          allowedMentions: { users: [target.author.id] },
        })
        .catch(() => null);

    return interaction.reply({
      content: '✅ Requested more info from the user.',
      flags: MessageFlags.Ephemeral,
    });
  }
}
