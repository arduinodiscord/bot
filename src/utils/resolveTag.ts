import type { ActionRowBuilder, ButtonBuilder, EmbedBuilder } from 'discord.js';
import tags from './tags';

export interface TagPayload {
  content?: string;
  embeds?: EmbedBuilder[];
  components?: ActionRowBuilder<ButtonBuilder>[];
}

/**
 * Resolve a tag name into a sendable message payload, evaluating templated
 * (function) content with the optional user id. Returns null for unknown tags.
 * Shared by the `/tag` command and the tag-button interaction handler.
 */
export function resolveTag(name: string, userId?: string): TagPayload | null {
  const tag = tags[name];
  if (!tag) return null;

  const payload: TagPayload = {};
  if (tag.embeds) payload.embeds = tag.embeds;
  if (tag.components) payload.components = tag.components;
  if (tag.content)
    payload.content =
      typeof tag.content === 'function' ? tag.content(userId) : tag.content;
  return payload;
}
