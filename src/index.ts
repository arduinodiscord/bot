import * as dotenv from 'dotenv'
dotenv.config()
import { SapphireClient } from '@sapphire/framework';

const client = new SapphireClient({ intents: ['GUILDS', 'GUILD_MESSAGES'] });

client.login(process.env.BOT_TOKEN);