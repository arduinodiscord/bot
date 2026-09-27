import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreSignals, type Signals } from './score';

const base: Signals = {
  scamBlocklist: false, spamBlocklist: false,
  clusterUsers: 0, fanoutChannels: 0,
  keywordMatches: 0, newAccount: false, hasLinkOrMention: false,
  ocrHasLink: false, imageOnlyPair: false, burst: false,
};

test('scam blocklist forces critical', () => {
  const r = scoreSignals({ ...base, scamBlocklist: true });
  assert.equal(r.tier, 'critical');
});

test('two users sharing an image with no scam content is only medium', () => {
  // e.g. two members posting the same popular pinout diagram with a question.
  const r = scoreSignals({ ...base, clusterUsers: 2 });
  assert.equal(r.tier, 'medium');
});

test('two-user cluster of an image-only pair reaches high', () => {
  // The raid shape: same two images, no text, from two accounts.
  const r = scoreSignals({ ...base, clusterUsers: 2, imageOnlyPair: true });
  assert.equal(r.tier, 'high');
});

test('two-user cluster with scam words in the image reaches high', () => {
  const r = scoreSignals({ ...base, clusterUsers: 2, keywordMatches: 2 });
  assert.equal(r.tier, 'high');
});

test('three or more accounts sharing an image reaches high on its own', () => {
  const r = scoreSignals({ ...base, clusterUsers: 3 });
  assert.equal(r.tier, 'high');
});

test('a new member posting the same image in two channels is only medium', () => {
  // The common newcomer "ask everywhere" pattern: tenure is not scam content.
  const r = scoreSignals({ ...base, fanoutChannels: 2, newAccount: true });
  assert.equal(r.tier, 'medium');
});

test('fan-out across three channels reaches high on its own', () => {
  const r = scoreSignals({ ...base, fanoutChannels: 3 });
  assert.equal(r.tier, 'high');
});

test('a mod-confirmed spam image stays high without corroboration', () => {
  const r = scoreSignals({ ...base, spamBlocklist: true });
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

test('a fired burst detection is always at least low', () => {
  const r = scoreSignals({ ...base, burst: true });
  assert.equal(r.tier, 'low');
});

test('a link inside the image text contributes to the score', () => {
  const r = scoreSignals({ ...base, ocrHasLink: true });
  assert.equal(r.score, 12);
});
