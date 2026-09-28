import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChannelType } from 'discord.js';
import { SOLVED_PREFIX, canMarkSolved, needsStarterLookup } from './solveThread';

const thread = (parentType: ChannelType, name = 'LED not blinking') => ({
  name,
  ownerId: 'helper',
  parent: { type: parentType },
});

test('owner and staff can mark solved; others cannot by default', () => {
  const t = thread(ChannelType.GuildForum);
  assert.equal(canMarkSolved(t, 'helper', false).ok, true);
  assert.equal(canMarkSolved(t, 'someone', true).ok, true);
  assert.equal(canMarkSolved(t, 'someone', false).ok, false);
});

test('starter message author counts as the asker when passed in', () => {
  const t = thread(ChannelType.GuildText);
  assert.equal(canMarkSolved(t, 'asker', false, ['helper', 'asker']).ok, true);
  assert.equal(canMarkSolved(t, 'other', false, ['helper', 'asker']).ok, false);
});

test('already-solved posts are refused even for staff', () => {
  const t = thread(ChannelType.GuildText, `${SOLVED_PREFIX}LED not blinking`);
  assert.equal(canMarkSolved(t, 'helper', true).ok, false);
});

test('starter lookup only for non-owner, non-staff users in text-channel threads', () => {
  assert.equal(needsStarterLookup(thread(ChannelType.GuildText), 'asker', false), true);
  assert.equal(needsStarterLookup(thread(ChannelType.GuildText), 'helper', false), false);
  assert.equal(needsStarterLookup(thread(ChannelType.GuildText), 'asker', true), false);
  assert.equal(needsStarterLookup(thread(ChannelType.GuildForum), 'asker', false), false);
  assert.equal(
    needsStarterLookup(thread(ChannelType.GuildText, `${SOLVED_PREFIX}x`), 'asker', false),
    false
  );
});
