import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SnowflakeUtil } from 'discord.js';
import { staleAction } from './staleHelpSweep';
import { estimateLastActivity } from './helpPosts';

const HOUR = 60 * 60 * 1000;
const base = {
  lastMessageKnown: true,
  lastIsNudge: false,
  now: 1_000 * HOUR,
  nudgeMs: 72 * HOUR,
  archiveMs: 168 * HOUR,
};

test('stale sweep nudges a known, idle post', () => {
  assert.equal(staleAction({ ...base, lastActivityAt: base.now - 73 * HOUR }), 'nudge');
  assert.equal(staleAction({ ...base, lastActivityAt: base.now - 71 * HOUR }), 'none');
});

test('stale sweep never acts when the last message is unknown', () => {
  for (const idle of [0, 100 * HOUR, 1000 * HOUR])
    assert.equal(
      staleAction({ ...base, lastMessageKnown: false, lastActivityAt: base.now - idle }),
      'none'
    );
});

test('stale sweep archives only after the archive window following a nudge', () => {
  const nudged = { ...base, lastIsNudge: true };
  assert.equal(staleAction({ ...nudged, lastActivityAt: base.now - 100 * HOUR }), 'none');
  assert.equal(staleAction({ ...nudged, lastActivityAt: base.now - 169 * HOUR }), 'archive');
});

test('last-activity estimate uses the last message id, then creation', () => {
  const at = Date.UTC(2026, 0, 1);
  const id = SnowflakeUtil.generate({ timestamp: at }).toString();
  assert.equal(estimateLastActivity(id, 5), at);
  assert.equal(estimateLastActivity(null, 5), 5);
  assert.equal(estimateLastActivity(null, null), 0);
});
