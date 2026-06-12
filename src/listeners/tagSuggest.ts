import { Events, Listener } from '@sapphire/framework';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Message,
} from 'discord.js';
import { SERVER_ID, tagSuggestEnabled } from '../utils/config';
import universalEmbed from '../utils/embed';

interface Suggestion {
  pattern: RegExp;
  tag: string;
  prompt: string;
}

// High-precision signatures for the most-repeated questions. Kept conservative
// to avoid false positives; the suggestion is a single button, never the full
// answer dumped into the channel.
const SUGGESTIONS: Suggestion[] = [
  {
    pattern: /stk500|avrdude[:\s]|not in sync/i,
    tag: 'avrdude',
    prompt: 'Looks like an **AVRDUDE upload error**.',
  },
  {
    pattern:
      /no such file or directory|fatal error:.*\.h|\.h: No such file|library.*(not found|is not installed|missing)/i,
    tag: 'libmissing',
    prompt: 'Looks like a **missing library / header** error.',
  },
  {
    pattern:
      /espcomm|esptool|failed to connect to esp|wrong boot mode|a fatal error occurred.*(packet|connect|timed out)/i,
    tag: 'espcomm',
    prompt: 'Looks like an **ESP upload / connection** problem.',
  },
];

const COOLDOWN_MS = 5 * 60_000;
const lastSuggested = new Map<string, number>();

export class TagSuggestListener extends Listener {
  public constructor(context: Listener.Context, options: Listener.Options) {
    super(context, { ...options, event: Events.MessageCreate });
  }

  public async run(message: Message) {
    if (!tagSuggestEnabled) return;
    if (!message.inGuild() || message.author.bot) return;
    if (message.guildId !== SERVER_ID) return;
    if (message.content.length < 10) return;

    const match = SUGGESTIONS.find((s) => s.pattern.test(message.content));
    if (!match) return;

    const now = Date.now();
    const last = lastSuggested.get(message.author.id);
    if (last && now - last < COOLDOWN_MS) return;
    lastSuggested.set(message.author.id, now);

    const embed = new EmbedBuilder(universalEmbed).setDescription(
      `💡 ${match.prompt} Tap below for troubleshooting steps.`
    );
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`tag:${match.tag}`)
        .setLabel('Show steps')
        .setStyle(ButtonStyle.Primary)
    );

    await message
      .reply({
        embeds: [embed],
        components: [row],
        allowedMentions: { repliedUser: false },
      })
      .catch(() => null);
  }
}

// Drop stale cooldown entries so the map can't grow unbounded.
const sweep = setInterval(() => {
  const horizon = Date.now() - COOLDOWN_MS;
  for (const [userId, at] of lastSuggested)
    if (at < horizon) lastSuggested.delete(userId);
}, 10 * 60_000);
sweep.unref();
