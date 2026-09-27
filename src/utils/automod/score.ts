import { automodConfig } from '../config';

export interface Signals {
  /** Exact content match to an image a moderator confirmed as a scam. */
  scamExact: boolean;
  /** Exact content match to an image a moderator confirmed as spam. */
  spamExact: boolean;
  /** Perceptual near match to any blocklisted image (evidence, not proof). */
  nearBlocklist: boolean;
  clusterUsers: number;   // distinct accounts sharing this image (incl. author)
  fanoutChannels: number; // distinct channels one user posted the image in
  keywordMatches: number; // distinct OCR scam keywords matched (seed + learned)
  seedKeywordMatches: number; // of which built-in seed keywords
  newAccount: boolean;
  hasLinkOrMention: boolean; // a URL in the message, or @everyone/@here
  massMention: boolean;      // @everyone / @here written in the message
  ocrHasLink: boolean;    // a URL / invite link inside the image text itself
  imageOnlyPair: boolean; // image-only message with exactly 2 images
  /** Images with no text, or only a short caption (no question): the raid shape. */
  raidShaped: boolean;
  burst: boolean;
}

export type Tier = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface MatchedSignal { label: string; points: number; }
export interface ScoreResult {
  score: number;
  tier: Tier;
  matched: MatchedSignal[];
  /** True when being a new member is the only thing that matched. */
  newAccountOnly: boolean;
}

// Corroborating contribution is capped below scoreHigh so weak signals alone
// can never reach the auto-action tier.
const CORROBORATING_CAP = 45;

/** Accounts / channels at which a spread alone justifies auto-action. */
export const WIDE_SPREAD = 4;

export function scoreSignals(s: Signals): ScoreResult {
  // Only an exact, mod-confirmed scam image can auto-ban, and only when the
  // post looks like the raid itself (no real text) or comes from a new
  // member. An established member posting it with text is usually warning
  // others ("is this a scam?"): that goes to a moderator instead.
  if (s.scamExact) {
    const raid = s.raidShaped || s.newAccount;
    return {
      score: raid ? 100 : 40,
      tier: raid ? 'critical' : 'medium',
      matched: [
        {
          label: raid
            ? 'Known scam image (mod-confirmed)'
            : 'Known scam image, posted with text by an established member (maybe a warning)',
          points: raid ? 100 : 40,
        },
      ],
      newAccountOnly: false,
    };
  }

  const strong: MatchedSignal[] = [];
  // Same idea for a confirmed spam image: an established member posting it
  // with a real message is not treated as the spam itself.
  const spamRepost = s.spamExact && (s.raidShaped || s.newAccount);
  if (spamRepost) strong.push({ label: 'Known spam image (mod-confirmed)', points: automodConfig.scoreHigh });
  else if (s.spamExact)
    strong.push({ label: 'Known spam image, posted with text by an established member', points: 40 });
  else if (s.nearBlocklist)
    strong.push({ label: 'Looks like a blocklisted image', points: 50 });
  if (s.clusterUsers >= automodConfig.clusterMinUsers) {
    const extra = Math.min((s.clusterUsers - 2) * 12, 30);
    strong.push({ label: `Same image from ${s.clusterUsers} accounts`, points: 50 + Math.max(0, extra) });
  }
  if (s.fanoutChannels >= automodConfig.fanoutChannels)
    strong.push({ label: `Image posted in ${s.fanoutChannels} channels`, points: 50 });

  const corrob: MatchedSignal[] = [];
  if (s.keywordMatches > 0)
    corrob.push({ label: `Scam words in image x${s.keywordMatches}`, points: Math.min(s.keywordMatches * 12, 30) });
  if (s.newAccount) corrob.push({ label: 'New member', points: 18 });
  if (s.hasLinkOrMention) corrob.push({ label: 'Link or @everyone/@here in message', points: 18 });
  if (s.ocrHasLink) corrob.push({ label: 'Link inside image text', points: 12 });
  if (s.imageOnlyPair) corrob.push({ label: 'Two images, no text', points: 8 });
  if (s.burst) corrob.push({ label: 'Many images in a short time', points: 12 });

  const strongTotal = strong.reduce((n, m) => n + m.points, 0);
  const corrobTotal = Math.min(corrob.reduce((n, m) => n + m.points, 0), CORROBORATING_CAP);
  const score = Math.min(strongTotal + corrobTotal, 100);

  let tier: Tier = 'none';
  if (score >= automodConfig.scoreHigh) tier = 'high';
  else if (score >= automodConfig.scoreMedium) tier = 'medium';
  else if (score >= automodConfig.scoreLow) tier = 'low';
  // A fired burst detection is always worth at least a low-confidence alert:
  // its weight alone sits below scoreLow, and without this floor a burst from
  // an established member is computed and then silently discarded.
  else if (s.burst) tier = 'low';

  // Being new is not suspicious by itself. Without this, every image a new
  // member posts in their first days would raise an alert.
  const newAccountOnly = strong.length === 0 && corrob.length === 1 && s.newAccount;
  if (newAccountOnly) tier = 'none';

  // Auto-action guard. A strong signal on its own is ambiguous in a help
  // server: members share the same popular diagram, and a newcomer often posts
  // one screenshot in a few channels. Unless the exact image was already
  // confirmed as spam, auto-action also needs scam-shaped content or a spread
  // no ordinary member produces. What counts as scam content is deliberately
  // narrow: a tutorial link in the message or "www.arduino.cc" in a diagram is
  // not; learned keywords are not (mods could be tricked into teaching common
  // words); only built-in scam words, a link in an image that also has scam
  // words, @everyone/@here, or the two-images-no-text shape the raids use.
  const scamContent =
    s.imageOnlyPair ||
    (s.raidShaped && s.clusterUsers >= 3) ||
    s.massMention ||
    s.seedKeywordMatches >= 2 ||
    (s.ocrHasLink && s.seedKeywordMatches >= 1);
  const wideSpread = s.clusterUsers >= WIDE_SPREAD || s.fanoutChannels >= WIDE_SPREAD;
  if (tier === 'high' && !spamRepost && !scamContent && !wideSpread) tier = 'medium';

  return { score, tier, matched: [...strong, ...corrob], newAccountOnly };
}
