import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework';
import { MessageFlags, type ButtonInteraction } from 'discord.js';
import { resolveTag } from '../utils/resolveTag';

/**
 * Replies (ephemerally) with a tag when a `tag:<name>` button is clicked — e.g.
 * the "Learn How to Share Code" button on the `ask` tag opens the `codeblock`
 * tag. This restores the legacy per-tag button-reply behaviour.
 */
export class TagButtonHandler extends InteractionHandler {
  public constructor(
    context: InteractionHandler.LoaderContext,
    options: InteractionHandler.Options
  ) {
    super(context, {
      ...options,
      interactionHandlerType: InteractionHandlerTypes.Button,
    });
  }

  public override parse(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith('tag:')) return this.none();
    return this.some(interaction.customId.slice('tag:'.length));
  }

  public async run(interaction: ButtonInteraction, tagName: string) {
    const payload = resolveTag(tagName);
    if (!payload)
      return interaction.reply({
        content: 'That tag no longer exists.',
        flags: MessageFlags.Ephemeral,
      });

    return interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
  }
}
