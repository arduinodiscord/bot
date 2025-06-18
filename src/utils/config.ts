import 'dotenv/config';

// TODO: zod validation would be nicer to have here

// const requiredEnvironment = ['BOT_TOKEN', 'DATABASE_URL'];
const requiredEnvironment = ['BOT_TOKEN', 'BOT_COMMANDS_CHANNEL_ID'];

const missingEnv = requiredEnvironment.filter((req) => !process.env[req]);

if (missingEnv.length > 0)
  throw new Error(
    'Missing required environment variables: \n- ' +
      missingEnv.reduce((a, b) => (b += `\n- ${a}`))
  );

export const {
  BOT_TOKEN = '',
  SERVER_ID = '420594746990526466', // default: Arduino Official
  BOT_COMMANDS_CHANNEL_ID = 'YOUR_BOT_COMMANDS_CHANNEL_ID',
} = process.env;
