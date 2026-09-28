/**
 * In-memory snapshot of each invite's use count, used to work out which invite
 * a new member joined with (by diffing against the live counts on join).
 * Filled on ready, kept current by the inviteCreate and guildMemberAdd
 * listeners. Not persisted — it is rebuilt from Discord on every startup.
 */
const inviteUses = new Map<string, number>();

export const setInviteUses = (code: string, uses: number): void => {
  inviteUses.set(code, uses);
};

export const getInviteUses = (code: string): number | undefined =>
  inviteUses.get(code);

export const seedInviteCache = (
  invites: Iterable<{ code: string; uses: number | null }>
): void => {
  for (const invite of invites) inviteUses.set(invite.code, invite.uses ?? 0);
};
