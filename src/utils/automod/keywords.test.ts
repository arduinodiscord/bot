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

test('learned keywords are matched after learning', () => {
  __resetKeywords();
  assert.equal(matchKeywords('totallyuniquescamword here').length, 0);
  learnKeywords(['totallyuniquescamword'], 'modid');
  assert.deepEqual(matchKeywords('totallyuniquescamword here'), ['totallyuniquescamword']);
});
