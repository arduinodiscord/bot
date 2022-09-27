import { SapphireClient } from '@sapphire/framework';
import { BOT_TOKEN } from './utils/config';

const client = new SapphireClient({ intents: ['GUILDS', 'GUILD_MESSAGES'] });

client.login(BOT_TOKEN);
