import { Events, Listener } from '@sapphire/framework';
import type { Invite } from 'discord.js';
import { setInviteUses } from '../utils/inviteCache';
import { isHomeGuild } from '../utils/homeGuild';

/** Seed newly-created invites into the cache so join attribution stays accurate. */
export class InviteCreateListener extends Listener {
  public constructor(context: Listener.Context, options: Listener.Options) {
    super(context, { ...options, event: Events.InviteCreate });
  }

  public run(invite: Invite) {
    if (!isHomeGuild(invite.guild?.id)) return;
    setInviteUses(invite.code, invite.uses ?? 0);
  }
}
