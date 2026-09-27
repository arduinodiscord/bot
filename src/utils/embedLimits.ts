import type { APIEmbed } from 'discord.js';

/** Discord's hard limits for message embeds and components. */
export const EMBED_LIMITS = {
  title: 256,
  description: 4096,
  fieldName: 256,
  fieldValue: 1024,
  fields: 25,
  footerText: 2048,
  authorName: 256,
  /** Combined title + description + field names/values + footer + author. */
  total: 6000,
  buttonLabel: 80,
  choices: 25,
} as const;

/** Total character count Discord applies the 6000-char limit to. */
export function embedTotalLength(embed: APIEmbed): number {
  return (
    (embed.title?.length ?? 0) +
    (embed.description?.length ?? 0) +
    (embed.fields ?? []).reduce(
      (sum, field) => sum + field.name.length + field.value.length,
      0
    ) +
    (embed.footer?.text.length ?? 0) +
    (embed.author?.name.length ?? 0)
  );
}

/**
 * Check an embed against Discord's limits. Returns human-readable problems
 * (empty when valid) so callers can report them instead of throwing.
 */
export function embedLimitProblems(embed: APIEmbed): string[] {
  const problems: string[] = [];
  const over = (what: string, length: number, max: number) => {
    if (length > max)
      problems.push(`${what} is ${length} characters (max ${max}).`);
  };

  over('Title', embed.title?.length ?? 0, EMBED_LIMITS.title);
  over('Description', embed.description?.length ?? 0, EMBED_LIMITS.description);
  over('Footer', embed.footer?.text.length ?? 0, EMBED_LIMITS.footerText);
  over('Author name', embed.author?.name.length ?? 0, EMBED_LIMITS.authorName);

  const fields = embed.fields ?? [];
  if (fields.length > EMBED_LIMITS.fields)
    problems.push(
      `There are ${fields.length} fields (max ${EMBED_LIMITS.fields}).`
    );
  fields.forEach((field, i) => {
    if (!field.name.trim()) problems.push(`Field ${i + 1} has an empty name.`);
    if (!field.value.trim())
      problems.push(`Field ${i + 1} has an empty value.`);
    over(`Field ${i + 1} name`, field.name.length, EMBED_LIMITS.fieldName);
    over(`Field ${i + 1} value`, field.value.length, EMBED_LIMITS.fieldValue);
  });

  over('The embed in total', embedTotalLength(embed), EMBED_LIMITS.total);
  return problems;
}
