import { SapphireClient } from '@sapphire/framework';
import { MessageEmbed } from 'discord.js';
import { BOT_TOKEN } from './utils/config';
import './utils/db';

const client = new SapphireClient({
  intents: [
    'GUILDS',
    'GUILD_MESSAGES',
    'GUILD_MEMBERS',
    'GUILD_PRESENCES',
    'MESSAGE_CONTENT',
    'DIRECT_MESSAGES',
  ],
})

client.login(BOT_TOKEN)

export default (new MessageEmbed().setFooter({ text: 'Arduino Bot • Submit bugs on GitHub!' }).setColor('#2f3136'))