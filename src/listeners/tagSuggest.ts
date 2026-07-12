import { Events, Listener } from '@sapphire/framework';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Message,
} from 'discord.js';
import {
  SERVER_ID,
  tagSuggestEnabled,
  codeFormatSuggestEnabled,
  askSuggestEnabled,
  suggestIgnoreChannelIds,
  suggestImmuneRoleIds,
} from '../utils/config';
import tags, { type Tag, type TagSuggestion } from '../utils/tags';
import universalEmbed from '../utils/embed';

interface Suggestion {
  tag: string;
  prompt: string;
  /** Label for the button that reveals the tag. */
  label: string;
}

// Keyword -> tag signatures, collected from the tags that declare a `suggest`
// rule. Co-locating the trigger with the tag keeps adding one a single edit.
const keywordSuggestions = Object.entries(tags)
  .filter(
    (entry): entry is [string, Tag & { suggest: TagSuggestion }] =>
      Boolean(entry[1].suggest)
  )
  .map(([tag, t]) => ({ tag, pattern: t.suggest.pattern, prompt: t.suggest.prompt }));

const COOLDOWN_MS = 5 * 60_000;
const lastSuggested = new Map<string, number>();

const ARDUINO_CODE =
  /\b(void\s+setup\s*\(|void\s+loop\s*\(|#include\s*[<"]|pinMode\s*\(|digital(Write|Read)\s*\(|analog(Write|Read)\s*\(|Serial\.(begin|print))/;

/**
 * Heuristic for code pasted as plain text. Conservative: an unmistakable
 * Arduino signature in a multi-line paste, or a sizeable multi-line blob dense
 * with code punctuation. Anything already in a code fence is left alone.
 */
function looksLikeUnformattedCode(content: string): boolean {
  if (content.includes('```')) return false;
  const lines = content.split('\n').length;
  const semicolons = (content.match(/;/g) ?? []).length;
  const braces = (content.match(/[{}]/g) ?? []).length;
  if (ARDUINO_CODE.test(content) && (lines >= 4 || semicolons >= 2)) return true;
  return lines >= 5 && semicolons >= 3 && braces >= 2;
}

// Short messages that are a request to ask / a ping for attention rather than
// an actual question. Anchored and length-bounded to limit false positives.
const LOW_EFFORT_ASK = [
  /^(can|could|may) (i|someone|anyone|u|you)\b.{0,20}\b(help|ask)\b/i,
  /^(can|may) i ask( a)?( quick)?( question)?\s*\??$/i,
  /^(is\s+)?(any\s?(one|body)|some\s?(one|body))\s+(here|around|online|there|available)\s*\??$/i,
  /\b(any\s?(one|body)|some\s?(one|body))\b.{0,30}\b(good with|know about|help with)\b/i,
  /^(help|help me|need help|i need help|pls help|please help)\b[!.\s]*$/i,
];

function looksLikeLowEffortAsk(content: string): boolean {
  const text = content.trim();
  if (text.length > 80) return false;
  return LOW_EFFORT_ASK.some((p) => p.test(text));
}

/** Pick at most one suggestion, in priority order, honouring per-type toggles. */
function detect(content: string): Suggestion | null {
  if (tagSuggestEnabled) {
    const match = keywordSuggestions.find((s) => s.pattern.test(content));
    if (match)
      return { tag: match.tag, prompt: match.prompt, label: 'Show steps' };
  }
  if (codeFormatSuggestEnabled && looksLikeUnformattedCode(content))
    return {
      tag: 'codeblock',
      prompt: 'That looks like **unformatted code**.',
      label: 'How to format code',
    };
  if (askSuggestEnabled && looksLikeLowEffortAsk(content))
    return {
      tag: 'ask',
      prompt:
        'No need to ask to ask — just **post your question with details** and someone will help.',
      label: 'How to ask',
    };
  return null;
}

/**
 * Watches messages and, when one matches a high-precision signature, offers the
 * relevant tag via a single button (never the full answer). Three detectors —
 * keyword/error signatures, unformatted code, and low-effort "can I ask" pings —
 * share one reply, one priority order, and one per-user cooldown.
 */
export class TagSuggestListener extends Listener {
  public constructor(context: Listener.Context, options: Listener.Options) {
    super(context, { ...options, event: Events.MessageCreate });
  }

  public async run(message: Message) {
    if (!tagSuggestEnabled && !codeFormatSuggestEnabled && !askSuggestEnabled)
      return;
    if (!message.inGuild() || message.author.bot) return;
    if (message.guildId !== SERVER_ID) return;
    if (message.content.length < 10) return;

    // Members holding a recognised role (Trusted and above) don't need suggestions.
    // Self-assignable notification roles are intentionally excluded from
    // SUGGEST_IMMUNE_ROLE_IDS so those members are still served suggestions.
    if (
      suggestImmuneRoleIds.length > 0 &&
      suggestImmuneRoleIds.some((id) => message.member?.roles.cache.has(id))
    )
      return;

    // Respect the ignore-channel list. Check both the message's channel and,
    // for threads, the parent channel so an entire forum can be suppressed.
    if (suggestIgnoreChannelIds.length > 0) {
      if (suggestIgnoreChannelIds.includes(message.channelId)) return;
      const parentId = message.channel.isThread()
        ? message.channel.parentId
        : null;
      if (parentId && suggestIgnoreChannelIds.includes(parentId)) return;
    }

    const suggestion = detect(message.content);
    if (!suggestion) return;

    const now = Date.now();
    const last = lastSuggested.get(message.author.id);
    if (last && now - last < COOLDOWN_MS) return;
    lastSuggested.set(message.author.id, now);

    const embed = new EmbedBuilder(universalEmbed).setDescription(
      `💡 ${suggestion.prompt} Tap below for the details.`
    );
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`tag:${suggestion.tag}`)
        .setLabel(suggestion.label)
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
