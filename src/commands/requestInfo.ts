import { ApplicationCommandRegistry, Command } from '@sapphire/framework';
import {
  ApplicationCommandType,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  type Message,
} from 'discord.js';
import { resolveTag } from '../utils/resolveTag';

/** Per-invoker cooldown so the long checklist can't be spammed at people. */
const COOLDOWN_MS = 30_000;
/** Don't resurrect old conversations by pinging their authors. */
const MAX_MESSAGE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const lastUsed = new Map<string, number>();

/**
 * Right-click a message → "Request more info" posts the `needinfo` checklist as
 * a reply to that message, pinging its author. Saves helpers from typing out
 * (or remembering) `/tag needinfo` for the most common ask. Refuses bot and
 * week-old messages, with a short per-invoker cooldown (staff exempt).
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
        .setContexts(InteractionContextType.Guild)
    );
  }

  public override async contextMenuRun(
    interaction: Command.ContextMenuCommandInteraction
  ) {
    if (!interaction.isMessageContextMenuCommand()) return;

    const target = interaction.targetMessage;
    if (target.author.bot || target.system)
      return interaction.reply({
        content: 'You can only request more info on a member\'s message.',
        flags: MessageFlags.Ephemeral,
      });
    if (Date.now() - target.createdTimestamp > MAX_MESSAGE_AGE_MS)
      return interaction.reply({
        content: 'That message is too old (over 7 days) to request more info on.',
        flags: MessageFlags.Ephemeral,
      });

    const isStaff =
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages) ??
      false;
    const now = Date.now();
    const last = lastUsed.get(interaction.user.id);
    if (!isStaff && last && now - last < COOLDOWN_MS)
      return interaction.reply({
        content: `Please wait ${Math.ceil((COOLDOWN_MS - (now - last)) / 1000)}s before requesting info again.`,
        flags: MessageFlags.Ephemeral,
      });

    const payload = resolveTag('needinfo', target.author.id);
    if (!payload?.content)
      return interaction.reply({
        content: 'The needinfo tag is unavailable.',
        flags: MessageFlags.Ephemeral,
      });

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let sent: Message | null = await target
      .reply({
        content: payload.content,
        allowedMentions: { users: [target.author.id] },
      })
      .catch(() => null);

    // If replying to the original message failed (e.g. it was deleted), fall
    // back to a normal channel message.
    if (!sent && interaction.channel?.isSendable())
      sent = await interaction.channel
        .send({
          content: payload.content,
          allowedMentions: { users: [target.author.id] },
        })
        .catch((error) => {
          this.container.logger.warn('[requestInfo] Failed to post:', error);
          return null;
        });

    if (!sent)
      return interaction.editReply({
        content: "I couldn't post the checklist here. I may be missing permissions in this channel.",
      });

    lastUsed.set(interaction.user.id, now);
    return interaction.editReply({
      content: 'Posted the checklist asking for more info.',
    });
  }
}

// Drop expired cooldown entries so the map can't grow unbounded.
setInterval(() => {
  const horizon = Date.now() - COOLDOWN_MS;
  for (const [userId, at] of lastUsed) if (at < horizon) lastUsed.delete(userId);
}, 10 * 60_000).unref();
