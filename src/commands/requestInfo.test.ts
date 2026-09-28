import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mayRequestInfo } from './requestInfo';

test('staff can always request info', () => {
  assert.equal(mayRequestInfo(true, [], []), true);
});

test('with no helper roles configured, only staff can', () => {
  assert.equal(mayRequestInfo(false, ['123'], []), false);
});

test('holders of a configured helper role can', () => {
  assert.equal(mayRequestInfo(false, ['111', '222'], ['222']), true);
});

test('other members cannot', () => {
  assert.equal(mayRequestInfo(false, ['111'], ['222']), false);
});
