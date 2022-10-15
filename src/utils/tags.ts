import { MessageEmbed } from 'discord.js';
import universalEmbed from '../index'
export default {
  ask: {
    embeds: [
      new MessageEmbed(universalEmbed).setTitle('Dont ask to ask - Just ask!').addFields({
        // TODO: Turn slash command reference into a button
        name: 'Describe what your code/hardware does and what you want it to do instead. Sharing is caring! Share your code, use /tag `name: codeblock` to learn how.',
        value:
          'Keep in mind: no one here is paid to help you, so the least you can do is to refine your question in a proper language.',
      }),
    ],
  },
};
