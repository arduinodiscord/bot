import { PrismaClient } from '@prisma/client';
import { Logger, LogLevel } from '@sapphire/framework';

const logger = new Logger(LogLevel.Info);

// export const prisma = new PrismaClient();

// prisma
//   .$connect()
//   .catch((error: Error) => {
//     logger.fatal(error.message);
//     process.exit(1);
//   })
//   .then(() => logger.info('Database connection success'));
