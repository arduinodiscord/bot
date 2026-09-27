import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Cooldown } from './cooldown';

test('cooldown blocks a user until it expires', () => {
  const cd = new Cooldown(10_000);
  assert.equal(cd.remaining('a', 0), 0);
  cd.record('a', 0);
  assert.equal(cd.remaining('a', 4_000), 6_000);
  assert.equal(cd.remaining('b', 4_000), 0);
  assert.equal(cd.remaining('a', 10_000), 0);
});

test('cooldown prunes expired entries', () => {
  const cd = new Cooldown(10_000);
  cd.record('a', 0);
  cd.record('b', 5_000);
  cd.record('c', 20_000);
  assert.equal(cd.size, 1);
});
