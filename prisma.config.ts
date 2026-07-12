import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7 moved the migration/introspection connection URL out of the schema
// and into this config file. The datasource is only required for CLI commands
// that touch the database (migrate, db pull); `prisma generate` does not need
// it, so we omit it entirely when DATABASE_URL is unset to keep offline
// generation (e.g. the postinstall hook) working.
const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  ...(url ? { datasource: { url } } : {}),
});
