import { ApplicationCommandRegistry, Command } from '@sapphire/framework';
import {
  EmbedBuilder,
  MessageFlags,
  TimestampStyles,
  time,
} from 'discord.js';
import { helpForumChannelIds } from '../utils/config';
import { fetchOpenHelpPosts } from '../utils/helpPosts';
import universalEmbed from '../utils/embed';

const MAX_LISTED = 15;

/**
 * `/openposts` — an ephemeral digest of currently-open (active, unsolved) help
 * posts, oldest activity first, so helpers can pick up whatever's been waiting
 * longest. Reuses the same open-post scan as the stale-post sweep.
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
        .setDMPermission(false)
    );
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction
  ) {
    if (helpForumChannelIds.length === 0)
      return interaction.reply({
        content: 'No help forums are configured.',
        flags: MessageFlags.Ephemeral,
      });

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const posts = (await fetchOpenHelpPosts(interaction.client)).sort(
      (a, b) => a.lastActivityAt - b.lastActivityAt
    );

    if (posts.length === 0)
      return interaction.editReply({
        content: '🎉 No open help posts right now — all caught up!',
      });

    const lines = posts.slice(0, MAX_LISTED).map(({ thread, lastActivityAt }) => {
      const url = `https://discord.com/channels/${thread.guildId}/${thread.id}`;
      const when = time(Math.floor(lastActivityAt / 1000), TimestampStyles.RelativeTime);
      return `• [${thread.name}](${url}) — last activity ${when}`;
    });

    if (posts.length > MAX_LISTED)
      lines.push(`…and ${posts.length - MAX_LISTED} more.`);

    const embed = new EmbedBuilder(universalEmbed)
      .setTitle(`🗂️ Open help posts (${posts.length})`)
      .setDescription(lines.join('\n'));

    return interaction.editReply({ embeds: [embed] });
  }
}
