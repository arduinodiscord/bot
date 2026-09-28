import { SapphireClient, Logger, LogLevel } from '@sapphire/framework';
import { ActivityType, GatewayIntentBits, Partials } from 'discord.js';
import { BOT_TOKEN } from './utils/config';
import { version } from '../package.json';

const logger = new Logger(LogLevel.Info);

const client = new SapphireClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.MessageContent,
  ],
  // Leave events for members not in the cache (most of a 41k-member server)
  // are only emitted as partials; without these they are silently dropped.
  partials: [Partials.GuildMember, Partials.User],
  presence: {
    activities: [{ name: `/tag • v${version}`, type: ActivityType.Watching }],
  },
});

logger.info('Attempting to connect to discord client...');
void client.login(BOT_TOKEN);
