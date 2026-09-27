import { ApplicationCommandRegistry, Command } from '@sapphire/framework';
import {
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  TimestampStyles,
  escapeMarkdown,
  time,
} from 'discord.js';
import { helpChannelIds } from '../utils/config';
import { fetchOpenHelpPosts } from '../utils/helpPosts';
import universalEmbed from '../utils/embed';

const MAX_LISTED = 15;

/**
 * Make a thread title safe to use as masked-link text: no formatting, and no
 * brackets that could close the link early and inject one of its own.
 */
export function linkLabel(name: string): string {
  const safe = escapeMarkdown(name.replace(/\s+/g, ' ').trim()).replace(
    /[[\]()]/g,
    '\\$&'
  );
  return safe || 'Untitled post';
}

/**
 * `/openposts` — an ephemeral digest of currently-open (active, unsolved) help
 * posts, oldest activity first, so helpers can pick up whatever's been waiting
 * longest. Reuses the same open-post scan as the stale-post sweep (public
 * threads only).
 */
export class OpenPostsCommand extends Command {
  public constructor(context: Command.Context, options: Command.Options) {
    super(context, {
      ...options,
      name: 'openposts',
      description: 'List open help posts waiting for an answer.',
    });
  }

  public override registerApplicationCommands(
    registry: ApplicationCommandRegistry
  ) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .setContexts(InteractionContextType.Guild)
    );
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction
  ) {
    if (helpChannelIds.length === 0)
      return interaction.reply({
        content: 'No help channels are configured.',
        flags: MessageFlags.Ephemeral,
      });

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const posts = (await fetchOpenHelpPosts(interaction.client)).sort(
      (a, b) => a.lastActivityAt - b.lastActivityAt
    );

    if (posts.length === 0)
      return interaction.editReply({
        content: 'There are no open help posts right now.',
      });

    const lines = posts.slice(0, MAX_LISTED).map(({ thread, lastActivityAt }) => {
      const url = `https://discord.com/channels/${thread.guildId}/${thread.id}`;
      const when = time(Math.floor(lastActivityAt / 1000), TimestampStyles.RelativeTime);
      return `• [${linkLabel(thread.name)}](${url}) · last activity ${when}`;
    });

    if (posts.length > MAX_LISTED)
      lines.push(`…and ${posts.length - MAX_LISTED} more.`);

    const embed = new EmbedBuilder(universalEmbed)
      .setTitle(`Open help posts (${posts.length})`)
      .setDescription(lines.join('\n'));

    return interaction.editReply({ embeds: [embed] });
  }
}
