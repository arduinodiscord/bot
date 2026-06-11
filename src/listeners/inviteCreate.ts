import { Events, Listener } from '@sapphire/framework';
import type { Invite } from 'discord.js';
import { setInviteUses } from '../utils/inviteCache';

/** Seed newly-created invites into the cache so join attribution stays accurate. */
export class InviteCreateListener extends Listener {
  public constructor(context: Listener.Context, options: Listener.Options) {
    super(context, { ...options, event: Events.InviteCreate });
  }

  public run(invite: Invite) {
    setInviteUses(invite.code, invite.uses ?? 0);
  }
}
