import { SapphireClient, Logger, LogLevel } from '@sapphire/framework';
import { EmbedBuilder, GatewayIntentBits } from 'discord.js';
import { BOT_TOKEN } from './utils/config';
import { version } from '../package.json';
// import './utils/db';

const logger = new Logger(LogLevel.Info);

const client = new SapphireClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  presence: {
    activities: [{
      name: `/help | v${version}`,
      type: 3
    }]
  }
})

logger.info('Attempting to connect to discord client...')
client.login(BOT_TOKEN)

export default (new EmbedBuilder().setFooter({ text: 'Arduino Bot • GPL-3.0 • /tag' }).setColor('#dc5b05').toJSON())