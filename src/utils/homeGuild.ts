import { SERVER_ID } from './config';

/**
 * Whether an event or interaction comes from the server this bot runs for.
 * Commands are registered globally, so without this check anyone who adds
 * the bot elsewhere (or uses it in DMs) could trigger its features.
 */
export const isHomeGuild = (guildId: string | null | undefined): boolean =>
  !!guildId && guildId === SERVER_ID;

/** Shown when a command is used outside SERVER_ID. */
export const HOME_GUILD_ONLY_MESSAGE =
  'This bot only works in the Arduino Discord server.';
