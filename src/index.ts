import { SapphireClient, Logger, LogLevel } from '@sapphire/framework';
import { ActivityType, GatewayIntentBits } from 'discord.js';
import { BOT_TOKEN } from './utils/config';
import { version } from '../package.json';

const logger = new Logger(LogLevel.Info);

const client = new SapphireClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  presence: {
    activities: [{ name: `/tag • v${version}`, type: ActivityType.Watching }],
  },
});

logger.info('Attempting to connect to discord client...');
void client.login(BOT_TOKEN);
