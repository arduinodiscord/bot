import { ApplicationCommandRegistry, Command } from '@sapphire/framework';
import {
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';
import { BOT_COMMANDS_CHANNEL_ID } from '../utils/config';
import tags from '../utils/tags';
import { resolveTag } from '../utils/resolveTag';
import universalEmbed from '../utils/embed';
import { Cooldown } from '../utils/cooldown';

/** Per-invoker cooldown so /tag can't be used to spam pings (staff exempt). */
const cooldown = new Cooldown(10_000);

/**
 * `/tag name` choices. Must list every key in the tags map (checked by
 * tags.test.ts); Discord allows at most 25.
 */
export const TAG_CHOICES = [
  { name: 'AI', value: 'ai' },
  { name: 'ask', value: 'ask' },
  { name: 'avrdude', value: 'avrdude' },
  { name: 'codeblock', value: 'codeblock' },
  { name: 'debounce', value: 'debounce' },
  { name: 'espcomm', value: 'espcomm' },
  { name: 'help', value: 'help' },
  { name: 'hid', value: 'hid' },
  { name: 'lab', value: 'lab' },
  { name: 'language', value: 'language' },
  { name: 'levelShifter', value: 'levelShifter' },
  { name: 'libmissing', value: 'libmissing' },
  { name: 'needinfo', value: 'needinfo' },
  { name: 'ninevolt', value: 'ninevolt' },
  { name: 'power', value: 'power' },
  { name: 'pullup', value: 'pullup' },
  { name: 'reinstall', value: 'reinstall' },
  { name: 'wiki', value: 'wiki' },
];

export class TagCommand extends Command {
  public constructor(context: Command.Context, options: Command.Options) {
    super(context, {
      ...options,
      name: 'tag',
      description:
        'Post a help tag (most tags are posted in the bot-commands channel).',
    });
  }

  public override registerApplicationCommands(
    registry: ApplicationCommandRegistry,
  ) {
    registry.registerChatInputCommand((builder) => {
      builder
        .setName(this.name)
        .setDescription(this.description)
        .setContexts(InteractionContextType.Guild)
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('Tag to post')
            .setRequired(true)
            .addChoices(...TAG_CHOICES),
        )
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('User to ping with the tag')
            .setRequired(false),
        );
    });
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction
  ) {
    const tagName = interaction.options.getString('name', true);
    const user = interaction.options.getUser('user');

    const tag = tags[tagName];
    const payload = resolveTag(tagName, user?.id);
    if (!tag || !payload)
      return interaction.reply({
        content: 'That tag does not exist.',
        flags: MessageFlags.Ephemeral,
      });

    const isStaff =
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages) ??
      false;
    const wait = isStaff ? 0 : cooldown.remaining(interaction.user.id);
    if (wait > 0)
      return interaction.reply({
        content: `Please wait ${Math.ceil(wait / 1000)}s before posting another tag.`,
        flags: MessageFlags.Ephemeral,
      });
    if (!isStaff) cooldown.record(interaction.user.id);

    // Always ping a requested user. Templated tags (e.g. needinfo) already
    // include the mention; everything else gets it prepended.
    if (user) {
      const mention = `<@${user.id}>`;
      if (!payload.content?.includes(mention))
        payload.content = payload.content
          ? `${mention}\n${payload.content}`
          : mention;
    }
    // Only ever ping the requested user, never anything embedded in tag text.
    const message = {
      ...payload,
      allowedMentions: { users: user ? [user.id] : [] },
    };

    // Tags default to bot-commands-channel-only unless they opt out.
    if (tag.botCommandsOnly === false) return interaction.reply(message);

    // Posting to another channel can be slow or fail; acknowledge within
    // Discord's 3s window first so the user never sees "did not respond".
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const botCommandsChannel = BOT_COMMANDS_CHANNEL_ID
      ? await interaction.client.channels
          .fetch(BOT_COMMANDS_CHANNEL_ID)
          .catch(() => null)
      : null;
    if (!botCommandsChannel?.isSendable())
      return interaction.editReply({
        content: 'The bot-commands channel is unavailable.',
      });

    try {
      await botCommandsChannel.send(message);
    } catch (error) {
      this.container.logger.error(
        `[tag] Failed to post "${tagName}" in bot-commands:`,
        error
      );
      return interaction.editReply({
        content: `I couldn't post that tag in <#${BOT_COMMANDS_CHANNEL_ID}> (I may be missing permissions there). Please let a moderator know.`,
      });
    }

    await interaction.editReply({
      embeds: [
        new EmbedBuilder(universalEmbed)
          .setTitle('Tag posted')
          .setDescription(`Posted in <#${BOT_COMMANDS_CHANNEL_ID}>.`),
      ],
    });

    // Point the tagged user at the info from the channel they're in (not
    // needed when they're already looking at bot-commands).
    if (user && interaction.channelId !== BOT_COMMANDS_CHANNEL_ID)
      await interaction
        .followUp({
          content: `<@${user.id}>`,
          embeds: [
            new EmbedBuilder(universalEmbed)
              .setTitle('Information for you')
              .setDescription(`A helper posted information for you in <#${BOT_COMMANDS_CHANNEL_ID}>.`),
          ],
          allowedMentions: { users: [user.id] },
        })
        .catch((error) =>
          this.container.logger.warn('[tag] Failed to post pointer:', error)
        );
    return undefined;
  }
}
