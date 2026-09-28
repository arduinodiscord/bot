#!/usr/bin/env node
// Checks that Discord's media proxy returns byte-identical thumbnails for two
// separate uploads of the same file. The automod's exact image identity (its
// "content id") depends on this.
//
// Usage: upload the same image file twice (two separate messages), right-click
// each image > Copy Link, then:
//   node scripts/check-proxy-determinism.mjs <link-1> <link-2>
import { createHash } from 'node:crypto';

const links = process.argv.slice(2);
if (links.length !== 2) {
  console.error('Usage: node scripts/check-proxy-determinism.mjs <image-link-1> <image-link-2>');
  process.exit(2);
}

async function thumbnailSha(link) {
  // Same URL shape the bot uses (see proxyPngUrl in src/utils/automod/signature.ts).
  const url = new URL(link.replace('cdn.discordapp.com', 'media.discordapp.net'));
  url.searchParams.set('width', '64');
  url.searchParams.set('height', '64');
  url.searchParams.set('format', 'png');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
  return createHash('sha256').update(Buffer.from(await res.arrayBuffer())).digest('hex');
}

const [a, b] = await Promise.all(links.map(thumbnailSha));
console.log(`upload 1: ${a}\nupload 2: ${b}`);
if (a === b) {
  console.log('OK: identical. Exact image matching will work across re-uploads.');
} else {
  console.log('DIFFERENT: exact matching of re-uploads will not work; tell the maintainer before releasing.');
  process.exit(1);
}
