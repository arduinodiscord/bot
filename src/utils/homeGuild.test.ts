import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SERVER_ID } from './config';
import { isHomeGuild } from './homeGuild';

test('only SERVER_ID counts as the home guild', () => {
  assert.equal(isHomeGuild(SERVER_ID), true);
  assert.equal(isHomeGuild('1'), false);
  assert.equal(isHomeGuild(null), false);
  assert.equal(isHomeGuild(undefined), false);
});
