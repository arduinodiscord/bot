import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreSignals, type Signals } from './score';

const base: Signals = {
  scamBlocklist: false, spamBlocklist: false,
  clusterUsers: 0, fanoutChannels: 0,
  keywordMatches: 0, newAccount: false, hasLinkOrMention: false,
  imageOnlyPair: false, burst: false,
};

test('scam blocklist forces critical', () => {
  const r = scoreSignals({ ...base, scamBlocklist: true });
  assert.equal(r.tier, 'critical');
});

test('two-user cluster reaches high (auto-action) alone', () => {
  const r = scoreSignals({ ...base, clusterUsers: 2 });
  assert.equal(r.tier, 'high');
});

test('corroborating signals alone never exceed medium', () => {
  const r = scoreSignals({
    ...base, keywordMatches: 5, newAccount: true,
    hasLinkOrMention: true, imageOnlyPair: true, burst: true,
  });
  assert.equal(r.tier, 'medium');
});

test('no signals is none', () => {
  assert.equal(scoreSignals(base).tier, 'none');
});
