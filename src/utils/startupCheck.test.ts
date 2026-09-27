import { test } from 'node:test';
import assert from 'node:assert/strict';
import { staleTimingProblems } from './startupCheck';

const HOUR = 3_600_000;

test('default stale-sweep timings raise no warning', () => {
  assert.deepEqual(staleTimingProblems(72 * HOUR, 168 * HOUR), []);
});

test('stale-sweep timings Discord would pre-empt are flagged', () => {
  assert.equal(staleTimingProblems(168 * HOUR, 24 * HOUR).length, 1);
  assert.equal(staleTimingProblems(72 * HOUR, 169 * HOUR).length, 1);
  assert.equal(staleTimingProblems(200 * HOUR, 200 * HOUR).length, 2);
});
