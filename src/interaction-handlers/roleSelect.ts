import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework';
import {
  EmbedBuilder,
  MessageFlags,
  type ButtonInteraction,
  type GuildMember,
} from 'discord.js';
import {
  EVENT_NOTIFS_ROLE_ID,
  ROLE_SELECT_MESSAGE_ID,
  SERVER_UPDATE_NOTIFS_ROLE_ID,
} from '../utils/config';
import universalEmbed from '../index';

interface RoleToggle {
  roleId: string;
  label: string;
}

/** Self-assignable opt-in roles, keyed by the button's custom id. */
function roleForButton(customId: string): RoleToggle | null {
  if (customId === 'events' && EVENT_NOTIFS_ROLE_ID)
    return { roleId: EVENT_NOTIFS_ROLE_ID, label: 'event notification' };
  if (customId === 'server_updates' && SERVER_UPDATE_NOTIFS_ROLE_ID)
    return {
      roleId: SERVER_UPDATE_NOTIFS_ROLE_ID,
      label: 'server update notification',
    };
  return null;
}

/**
 * Toggles opt-in notification roles when a member clicks a button on the
 * configured role-select message. Disabled unless ROLE_SELECT_MESSAGE_ID and
 * the corresponding role id are set.
 */
export class RoleSelectHandler extends InteractionHandler {
  public constructor(
    context: InteractionHandler.LoaderContext,
    options: InteractionHandler.Options
  ) {
    super(context, {
      ...options,
      interactionHandlerType: InteractionHandlerTypes.Button,
    });
  }

  public override parse(interaction: ButtonInteraction) {
    if (!ROLE_SELECT_MESSAGE_ID) return this.none();
    if (interaction.message.id !== ROLE_SELECT_MESSAGE_ID) return this.none();
    const toggle = roleForButton(interaction.customId);
    return toggle ? this.some(toggle) : this.none();
  }

  public async run(interaction: ButtonInteraction, toggle: RoleToggle) {
    const member = interaction.member as GuildMember | null;
    if (!member)
      return interaction.reply({
        content: 'This only works inside the server.',
        flags: MessageFlags.Ephemeral,
      });

    const had = member.roles.cache.has(toggle.roleId);
    try {
      if (had) await member.roles.remove(toggle.roleId);
      else await member.roles.add(toggle.roleId);
    } catch {
      return interaction.reply({
        content: `I couldn't update your roles — please check my permissions or ask a moderator.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const embed = new EmbedBuilder(universalEmbed).setTitle(
      `✅ The ${toggle.label} role was ${had ? 'removed' : 'added'}.`
    );
    return interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  }
}
