import { container } from '@sapphire/framework';
import { seedScamKeywords } from '../config';
import { getPrisma } from '../db';

/**
 * Words never learned from scam images. Learning takes every token of a
 * mod-confirmed scam image's OCR text, so without this filter ordinary English
 * and everyday Arduino help vocabulary would creep into the store and start
 * matching legitimate screenshots. Keep it generous: a missed scam word only
 * costs a few corroborating points; a learned common word costs false alerts.
 */
const STOP = new Set(
  (
    // Common English
    'the and you your yours for with this that these those have has had from are was were ' +
    'now get got all any not but can will just only also more most some such than then them ' +
    'they their there here what when where which who whom why how into onto over under about ' +
    'after before again once very much many each every other same both few own out off our ours ' +
    'its his her him she hers yes one two three four five first last next new old good best ' +
    'make made take took give gave come came know like want need look see seen use used using ' +
    'time today day days week month year years people person thing things way ways work works ' +
    'said says say tell told call called back well even still really right left long little ' +
    'great high low big small full free ' +
    // Chat / UI chrome that appears in screenshots of apps and websites
    'click here link page home menu settings account login sign profile message messages send ' +
    'sent reply share post posts online followers follow like likes view views video watch ' +
    'download app open close cancel next done save search share balance total amount ' +
    // Arduino / electronics help vocabulary
    'arduino uno nano mega esp esp32 esp8266 board boards code sketch library libraries error ' +
    'errors compile upload uploading port serial monitor pin pins wire wires wiring sensor ' +
    'sensors led leds motor motors servo power voltage volt volts current resistor resistors ' +
    'ground gnd vcc usb cable breadboard module modules void setup loop int float digital ' +
    'analog read write include define help project projects circuit schematic'
  ).split(/\s+/)
);

/**
 * A learned keyword only becomes active once it has appeared in this many
 * separate mod-confirmed scam images. One misclick, or one scam image that
 * happens to contain an unusual word, cannot add a keyword by itself.
 * Seed keywords are always active.
 */
export const LEARNED_ACTIVATION_HITS = 2;

/** Learned keyword -> number of confirmed scam images it appeared in. */
const learned = new Map<string, number>();

const activeLearned = (): string[] =>
  [...learned].filter(([, hits]) => hits >= LEARNED_ACTIVATION_HITS).map(([k]) => k);

/** Split OCR text into lowercase alphabetic tokens (length >= 3). */
export function tokenizeOcr(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]+/g) ?? []).filter((t) => t.length >= 3);
}

/** Distinct scam keywords (seed + active learned) present in the text. */
export function matchKeywords(text: string): string[] {
  const tokens = new Set(tokenizeOcr(text));
  const active = new Set<string>([...seedScamKeywords, ...activeLearned()]);
  const hits = new Set<string>();
  for (const kw of active) {
    if (kw.includes(' ')) { if (text.toLowerCase().includes(kw)) hits.add(kw); }
    else if (tokens.has(kw)) hits.add(kw);
  }
  return [...hits];
}

/**
 * Record the distinctive tokens of one confirmed scam image (memory + DB).
 * Each call counts as one sighting per distinct token.
 */
export async function learnKeywords(tokens: string[], addedBy: string): Promise<void> {
  const distinct = [...new Set(tokens)].filter(
    (t) => t.length >= 4 && !STOP.has(t) && !seedScamKeywords.includes(t)
  );
  for (const t of distinct) learned.set(t, (learned.get(t) ?? 0) + 1);
  const prisma = getPrisma();
  if (!prisma || distinct.length === 0) return;
  try {
    await prisma.$transaction(distinct.map((keyword) =>
      prisma.scamKeyword.upsert({
        where: { keyword }, create: { keyword, addedBy },
        update: { hits: { increment: 1 } },
      })));
  } catch (e) { container.logger.error('Learning keywords failed:', e); }
}

/** Load learned keywords on startup. Safe without a database. */
export async function loadKeywords(): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;
  try {
    const rows = await prisma.scamKeyword.findMany({ select: { keyword: true, hits: true } });
    let skipped = 0;
    for (const { keyword, hits } of rows) {
      // Rows learned before the stopword list grew are ignored, not deleted,
      // so a moderator can still review them.
      if (STOP.has(keyword)) { skipped++; continue; }
      learned.set(keyword, hits);
    }
    container.logger.info(
      `Automod: loaded ${learned.size} learned scam keyword(s), ${activeLearned().length} active (seen in ${LEARNED_ACTIVATION_HITS}+ confirmed scams)${skipped ? `; ignored ${skipped} stopword(s)` : ''}.`
    );
  } catch (e) { container.logger.error('Loading keywords failed:', e); }
}

export function __resetKeywords(): void { learned.clear(); }
