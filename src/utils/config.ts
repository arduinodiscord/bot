import 'dotenv/config';

// TODO: zod validation would be nicer to have here

// const requiredEnvironment = ['BOT_TOKEN', 'DATABASE_URL'];
const requiredEnvironment = ['BOT_TOKEN'];

const missingEnv = requiredEnvironment.filter((req) => !process.env[req]);

if (missingEnv.length > 0)
  throw new Error(
    'Missing required environment variables: \n- ' +
      missingEnv.join('\n- ')
  );
// This should be the server and the bot commands channel id's.
export const {
  BOT_TOKEN = '',
  SERVER_ID = '420594746990526466', // Arduino Official Server
  BOT_COMMANDS_CHANNEL_ID = '451158319361556491', // Arduino Official Bot Channel
} = process.env;
