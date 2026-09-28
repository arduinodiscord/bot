/**
 * Environment for the automod simulation tests. Must be imported BEFORE
 * anything that pulls in `utils/config`, which reads the environment once at
 * module load.
 */
export const SIM_GUILD_ID = 'guild-1';
export const SIM_MOD_LOG_ID = 'modlog-1';

process.env.BOT_TOKEN ||= 'test';
process.env.SERVER_ID = SIM_GUILD_ID;
process.env.MOD_LOG_CHANNEL_ID = SIM_MOD_LOG_ID;
// Matches production: low-confidence alerts are posted, not suppressed.
process.env.AUTOMOD_LOG_LOW_CONFIDENCE = 'true';
// No tesseract in tests; the keyword/OCR-link signals read ''.
process.env.OCR_ENABLED = 'false';
// In-memory only: no Postgres.
delete process.env.DATABASE_URL;
