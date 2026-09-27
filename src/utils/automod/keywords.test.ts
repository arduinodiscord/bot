import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchKeywords, tokenizeOcr, learnKeywords, __resetKeywords } from './keywords';

test('tokenize lowercases and strips punctuation', () => {
  assert.deepEqual(tokenizeOcr('Free CRYPTO!! withdraw$$'), ['free', 'crypto', 'withdraw']);
});

test('matches distinct seed keywords', () => {
  __resetKeywords();
  const m = matchKeywords('claim your free crypto wallet airdrop now');
  assert.ok(m.length >= 4); // free, crypto, wallet, airdrop
});

test('a learned keyword activates only after a second confirmed scam', () => {
  __resetKeywords();
  learnKeywords(['totallyuniquescamword'], 'modid');
  assert.equal(matchKeywords('totallyuniquescamword here').length, 0);
  learnKeywords(['totallyuniquescamword'], 'modid');
  assert.deepEqual(matchKeywords('totallyuniquescamword here'), ['totallyuniquescamword']);
});

test('one scam image counts once even if a word repeats in it', () => {
  __resetKeywords();
  learnKeywords(['zzscamword', 'zzscamword', 'zzscamword'], 'modid');
  assert.equal(matchKeywords('zzscamword').length, 0);
});

test('common words and Arduino help vocabulary are never learned', () => {
  __resetKeywords();
  for (let i = 0; i < 3; i++) learnKeywords(['arduino', 'upload', 'click', 'balance', 'today'], 'modid');
  assert.deepEqual(matchKeywords('arduino upload click balance today'), []);
});
