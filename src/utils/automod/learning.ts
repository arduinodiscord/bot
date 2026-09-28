import { automodConfig } from '../config';
import { blocklistSize } from './blocklist';

/**
 * Whether learning (ramp-up) mode is currently active.
 *
 * The confidence scorer's strong signals — blocklist hits and learned
 * keywords — only exist after moderators have confirmed alerts, but on a cold
 * start nothing scores high enough to BE alerted, so the corpus can never
 * grow. Learning mode breaks that deadlock: while active, every image message
 * with any nonzero suspicion signal is posted to the mod log (alert-only
 * below the usual auto-action thresholds) so moderators can click
 * Confirm spam / Confirm scam / Not spam and train the filter.
 *
 * 'auto' (the default) keeps learning mode on until the blocklist holds
 * `learningCorpusTarget` confirmed fingerprints; 'on' and 'off' force it.
 */
export function learningModeActive(): boolean {
  if (automodConfig.learningMode === 'on') return true;
  if (automodConfig.learningMode === 'off') return false;
  return blocklistSize() < automodConfig.learningCorpusTarget;
}
