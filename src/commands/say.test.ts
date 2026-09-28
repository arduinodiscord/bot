import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFields } from './say';

test('/say fields split on a pipe surrounded by spaces', () => {
  assert.deepEqual(parseFields('Rules::Be nice | Help::Ask in #help'), {
    fields: [
      { name: 'Rules', value: 'Be nice' },
      { name: 'Help', value: 'Ask in #help' },
    ],
  });
});

test('/say fields keep spoilers and bare pipes intact', () => {
  assert.deepEqual(parseFields('Answer::||42|| | Logic::a|b'), {
    fields: [
      { name: 'Answer', value: '||42||' },
      { name: 'Logic', value: 'a|b' },
    ],
  });
});

test('/say fields report a missing separator', () => {
  assert.ok('error' in parseFields('no separator here'));
  assert.deepEqual(parseFields('  '), { fields: [] });
});
