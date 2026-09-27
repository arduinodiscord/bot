import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreSignals, type Signals } from './score';

const base: Signals = {
  scamExact: false, spamExact: false, nearBlocklist: false,
  clusterUsers: 0, fanoutChannels: 0,
  keywordMatches: 0, seedKeywordMatches: 0, newAccount: false,
  hasLinkOrMention: false, massMention: false,
  ocrHasLink: false, imageOnlyPair: false, burst: false,
};
const tier = (s: Partial<Signals>) => scoreSignals({ ...base, ...s }).tier;

test('an exact mod-confirmed scam image is critical', () => {
  assert.equal(tier({ scamExact: true }), 'critical');
});

test('a near match to a scam image is never critical', () => {
  // Could be the innocent original a confirmed scam was built on.
  assert.notEqual(tier({ nearBlocklist: true, imageOnlyPair: true }), 'critical');
});

test('a near blocklist match with a text question is only medium', () => {
  assert.equal(tier({ nearBlocklist: true }), 'medium');
});

test('an exact mod-confirmed spam image is high without corroboration', () => {
  assert.equal(tier({ spamExact: true }), 'high');
});

test('the raid shape (same two images, no text, two accounts) is high', () => {
  assert.equal(tier({ clusterUsers: 2, imageOnlyPair: true }), 'high');
});

test('two members sharing a diagram with a question is medium', () => {
  assert.equal(tier({ clusterUsers: 2 }), 'medium');
});

test('a tutorial link in the message is not scam content', () => {
  assert.equal(tier({ clusterUsers: 2, hasLinkOrMention: true }), 'medium');
});

test('"www." in a diagram is not scam content', () => {
  assert.equal(tier({ clusterUsers: 2, ocrHasLink: true }), 'medium');
});

test('learned keywords alone are not scam content', () => {
  assert.equal(tier({ clusterUsers: 2, keywordMatches: 3, seedKeywordMatches: 0 }), 'medium');
});

test('one generic seed keyword is not scam content', () => {
  assert.equal(tier({ clusterUsers: 2, keywordMatches: 1, seedKeywordMatches: 1 }), 'medium');
});

test('two built-in scam words in the image make a cluster high', () => {
  assert.equal(tier({ clusterUsers: 2, keywordMatches: 2, seedKeywordMatches: 2 }), 'high');
});

test('a link plus a scam word inside the image makes a cluster high', () => {
  assert.equal(tier({ clusterUsers: 2, ocrHasLink: true, keywordMatches: 1, seedKeywordMatches: 1 }), 'high');
});

test('@everyone makes a cluster high', () => {
  assert.equal(tier({ clusterUsers: 2, hasLinkOrMention: true, massMention: true }), 'high');
});

test('three members sharing a popular image is still only medium', () => {
  assert.equal(tier({ clusterUsers: 3 }), 'medium');
});

test('four or more accounts sharing an image is high on its own', () => {
  assert.equal(tier({ clusterUsers: 4 }), 'high');
});

test('a new member posting a screenshot in three channels is medium', () => {
  assert.equal(tier({ fanoutChannels: 3, newAccount: true }), 'medium');
});

test('one image in four channels is high on its own', () => {
  assert.equal(tier({ fanoutChannels: 4 }), 'high');
});

test('corroborating signals alone never exceed medium', () => {
  assert.equal(
    tier({ keywordMatches: 5, seedKeywordMatches: 5, newAccount: true, hasLinkOrMention: true, imageOnlyPair: true, burst: true }),
    'medium'
  );
});

test('being a new member alone raises nothing', () => {
  const r = scoreSignals({ ...base, newAccount: true });
  assert.equal(r.tier, 'none');
  assert.equal(r.newAccountOnly, true);
});

test('a new member posting a confirmed scam image is still critical', () => {
  const r = scoreSignals({ ...base, scamExact: true, newAccount: true });
  assert.equal(r.tier, 'critical');
  assert.equal(r.newAccountOnly, false);
});

test('no signals is none', () => {
  assert.equal(tier({}), 'none');
});

test('a fired burst detection is always at least low', () => {
  assert.equal(tier({ burst: true }), 'low');
});

test('a link inside the image text contributes to the score', () => {
  assert.equal(scoreSignals({ ...base, ocrHasLink: true }).score, 12);
});
