import { EmbedBuilder } from 'discord.js';

/**
 * Shared base embed (brand colour + footer) reused across the bot. Spread it
 * into a fresh builder rather than mutating it:
 *
 * ```ts
 * new EmbedBuilder(universalEmbed).setTitle('…')
 * ```
 */
export const universalEmbed = new EmbedBuilder()
  .setFooter({ text: 'Arduino Bot • GPL-3.0 • /tag' })
  .setColor('#dc5b05')
  .toJSON();

export default universalEmbed;
