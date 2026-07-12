import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordAndCluster, __resetGlobalIndex } from './globalIndex';

test('same signature from two users clusters', () => {
  __resetGlobalIndex();
  const now = Date.now();
  recordAndCluster({ userId: 'a', channelId: 'c1', messageId: 'm1', at: now, signatures: ['sig1'], hashes: [] });
  const r = recordAndCluster({ userId: 'b', channelId: 'c2', messageId: 'm2', at: now + 1000, signatures: ['sig1'], hashes: [] });
  assert.equal(r.userIds.length, 2);
  assert.ok(r.userIds.includes('a') && r.userIds.includes('b'));
});

test('same user does not count as a cross-user cluster', () => {
  __resetGlobalIndex();
  const now = Date.now();
  recordAndCluster({ userId: 'a', channelId: 'c1', messageId: 'm1', at: now, signatures: ['sig1'], hashes: [] });
  const r = recordAndCluster({ userId: 'a', channelId: 'c2', messageId: 'm2', at: now + 1000, signatures: ['sig1'], hashes: [] });
  assert.equal(r.userIds.length, 1);
});

test('stale entries outside the window are pruned', () => {
  __resetGlobalIndex();
  const now = Date.now();
  recordAndCluster({ userId: 'a', channelId: 'c1', messageId: 'm1', at: now - 10 * 60_000, signatures: ['sig1'], hashes: [] });
  const r = recordAndCluster({ userId: 'b', channelId: 'c2', messageId: 'm2', at: now, signatures: ['sig1'], hashes: [] });
  assert.equal(r.userIds.length, 1);
});
