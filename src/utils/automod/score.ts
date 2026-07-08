import { automodConfig } from '../config';

export interface Signals {
  scamBlocklist: boolean;
  spamBlocklist: boolean;
  clusterUsers: number;   // distinct accounts sharing this image (incl. author)
  fanoutChannels: number; // distinct channels one user posted the image in
  keywordMatches: number; // distinct OCR scam keywords matched
  newAccount: boolean;
  hasLinkOrMention: boolean;
  imageOnlyPair: boolean; // image-only message with exactly 2 images
  burst: boolean;
}

export type Tier = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface MatchedSignal { label: string; points: number; }
export interface ScoreResult { score: number; tier: Tier; matched: MatchedSignal[]; }

// Corroborating contribution is capped below scoreHigh so weak signals alone
// can never reach the auto-action tier.
const CORROBORATING_CAP = 45;

export function scoreSignals(s: Signals): ScoreResult {
  if (s.scamBlocklist)
    return { score: 100, tier: 'critical', matched: [{ label: 'Known scam image (mod-confirmed)', points: 100 }] };

  const strong: MatchedSignal[] = [];
  if (s.spamBlocklist) strong.push({ label: 'Known spam image (mod-confirmed)', points: automodConfig.scoreHigh });
  if (s.clusterUsers >= automodConfig.clusterMinUsers) {
    const extra = Math.min((s.clusterUsers - 2) * 12, 30);
    strong.push({ label: `Same image from ${s.clusterUsers} accounts`, points: 50 + Math.max(0, extra) });
  }
  if (s.fanoutChannels >= automodConfig.fanoutChannels)
    strong.push({ label: `Image fanned across ${s.fanoutChannels} channels`, points: 50 });

  const corrob: MatchedSignal[] = [];
  if (s.keywordMatches > 0)
    corrob.push({ label: `OCR scam keywords x${s.keywordMatches}`, points: Math.min(s.keywordMatches * 12, 30) });
  if (s.newAccount) corrob.push({ label: 'New / low-tenure account', points: 18 });
  if (s.hasLinkOrMention) corrob.push({ label: 'Contains link or @everyone/@here', points: 18 });
  if (s.imageOnlyPair) corrob.push({ label: 'Image-only, exactly 2 images', points: 8 });
  if (s.burst) corrob.push({ label: 'Image burst', points: 12 });

  const strongTotal = strong.reduce((n, m) => n + m.points, 0);
  const corrobTotal = Math.min(corrob.reduce((n, m) => n + m.points, 0), CORROBORATING_CAP);
  const score = Math.min(strongTotal + corrobTotal, 100);

  let tier: Tier = 'none';
  if (score >= automodConfig.scoreHigh) tier = 'high';
  else if (score >= automodConfig.scoreMedium) tier = 'medium';
  else if (score >= automodConfig.scoreLow) tier = 'low';

  return { score, tier, matched: [...strong, ...corrob] };
}
