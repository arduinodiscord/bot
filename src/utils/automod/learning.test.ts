import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { automodConfig } from '../config';
import { learningModeActive } from './learning';
import { addToBlocklist, __resetBlocklist } from './blocklist';

afterEach(() => {
  __resetBlocklist();
  automodConfig.learningMode = 'auto';
});

test('auto: active while the corpus is below the target', () => {
  assert.equal(learningModeActive(), true);
});

test('auto: retires once the corpus reaches the target', async () => {
  const signatures = Array.from(
    { length: automodConfig.learningCorpusTarget },
    (_, i) => `sig-${i}`
  );
  await addToBlocklist(signatures, [], 'test-mod', 'test');
  assert.equal(learningModeActive(), false);
});

test('forced on stays active regardless of corpus size', async () => {
  automodConfig.learningMode = 'on';
  const signatures = Array.from(
    { length: automodConfig.learningCorpusTarget },
    (_, i) => `sig-${i}`
  );
  await addToBlocklist(signatures, [], 'test-mod', 'test');
  assert.equal(learningModeActive(), true);
});

test('forced off is inactive even with an empty corpus', () => {
  automodConfig.learningMode = 'off';
  assert.equal(learningModeActive(), false);
});
