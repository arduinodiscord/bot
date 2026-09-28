import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkLabel } from './openPosts';

/** A label is safe when no unescaped `[`, `]`, `(` or `)` survives. */
const hasUnescapedBracket = (label: string): boolean =>
  /(^|[^\\])(\\\\)*[[\]()]/.test(label);

test('thread titles cannot break out of the masked link', () => {
  for (const name of [
    'help](https://evil.example) [click',
    'a\\](https://evil.example)',
    '[free nitro](https://evil.example)',
    'servo (SG90) jitters',
  ])
    assert.equal(hasUnescapedBracket(linkLabel(name)), false, name);
});

test('thread titles lose markdown formatting', () => {
  assert.equal(linkLabel('**urgent** help'), '\\*\\*urgent\\*\\* help');
});

test('blank titles get a placeholder', () => {
  assert.equal(linkLabel('   '), 'Untitled post');
});
