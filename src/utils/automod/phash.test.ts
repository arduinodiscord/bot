import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Jimp } from 'jimp';
import { hammingDistance, pHashFromBuffer } from './phash';

const THRESHOLD = 6;

/** Deterministic PRNG so the corpus is identical on every run. */
function rng(seed: number) {
  let s = seed >>> 0;
  return (lo: number, hi: number) => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return lo + (s % (hi - lo));
  };
}

const rgba = (r: number, g: number, b: number) => ((r << 24) | (g << 16) | (b << 8) | 255) >>> 0;

/**
 * A screenshot-like image: flat light (or dark-mode) background with blocks of
 * "text" and UI chrome. This is the common case on a maker help server and the
 * one that collapsed the old mean-including-DC hash to near-all-zero bits.
 */
function screenshot(seed: number) {
  const r = rng(seed);
  const dark = seed % 3 === 0;
  const bg = dark ? r(20, 50) : r(225, 256);
  const img = new Jimp({ width: 800, height: 600, color: rgba(bg, bg, bg) });
  const blocks = r(8, 40);
  for (let i = 0; i < blocks; i++) {
    const x = r(0, 760), y = r(0, 580);
    const w = Math.min(r(30, 400), 800 - x), h = Math.min(r(6, 50), 600 - y);
    const c = r(0, 256);
    for (let py = y; py < y + h; py++)
      for (let px = x; px < x + w; px++) img.setPixelColor(rgba(c, (c + 60) % 256, c), px, py);
  }
  return img;
}

/** Hash via the same path production uses: Discord hands us a 64×64 thumbnail. */
async function hashOf(buffer: Buffer): Promise<string | null> {
  const thumb = (await Jimp.read(buffer)).resize({ w: 64, h: 64 });
  return pHashFromBuffer(await thumb.getBuffer('image/png'));
}

const png = (img: { getBuffer(mime: 'image/png'): Promise<Buffer> }) => img.getBuffer('image/png');

test('unrelated screenshots do not collide', async () => {
  const hashes: string[] = [];
  for (let seed = 1; seed <= 30; seed++) {
    const h = await hashOf(await png(screenshot(seed)));
    if (h) hashes.push(h);
  }
  assert.ok(hashes.length >= 25, `too many screenshots rejected as low-information (${hashes.length}/30)`);
  let collisions = 0;
  let pairs = 0;
  for (let i = 0; i < hashes.length; i++)
    for (let j = i + 1; j < hashes.length; j++) {
      pairs++;
      if (hammingDistance(hashes[i], hashes[j]) <= THRESHOLD) collisions++;
    }
  assert.equal(collisions, 0, `${collisions}/${pairs} unrelated pairs within threshold ${THRESHOLD}`);
});

test('re-encoded and lightly altered copies still match', async () => {
  for (const seed of [2, 5, 9]) {
    const original = screenshot(seed);
    const base = await hashOf(await png(original));
    assert.ok(base);
    const variants = [
      await original.getBuffer('image/jpeg', { quality: 60 }),
      await png(original.clone().resize({ w: 640, h: 480 })),
      await png(original.clone().brightness(1.1)),
    ];
    for (const v of variants) {
      const h = await hashOf(v);
      assert.ok(h);
      assert.ok(hammingDistance(base, h) <= THRESHOLD, `variant distance ${hammingDistance(base, h)}`);
    }
  }
});

test('a flat image carries no fingerprint', async () => {
  const blank = new Jimp({ width: 400, height: 300, color: rgba(240, 240, 240) });
  assert.equal(await hashOf(await png(blank)), null);
});
