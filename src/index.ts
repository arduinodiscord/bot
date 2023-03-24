import { SapphireClient, Logger, LogLevel } from '@sapphire/framework';
import { MessageEmbed } from 'discord.js';
import { BOT_TOKEN } from './utils/config';
import { version } from '../package.json';
import './utils/db';

const logger = new Logger(LogLevel.Info);

const client = new SapphireClient({
  intents: [
    'GUILDS',
    'GUILD_MESSAGES',
    'GUILD_MEMBERS',
    'GUILD_PRESENCES',
    'MESSAGE_CONTENT',
    'DIRECT_MESSAGES',
  ],
  presence: {
    activities: [{
      name: `slash commands! | v${version}`,
      type: 'WATCHING'
    }]
  }
})

logger.info('Attempting to connect to discord client...')
client.login(BOT_TOKEN)

export default (new MessageEmbed().setFooter({ text: 'Arduino Bot • Submit bugs on GitHub!' }).setColor('#2f3136'))