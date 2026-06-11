import { Jimp, intToRGBA } from 'jimp';
import type { Attachment, Message } from 'discord.js';
import { container } from '@sapphire/framework';
import { isImageAttachment } from './signature';

// dHash works on a (W+1) x H greyscale image, comparing each pixel to its right
// neighbour to produce W*H = 64 bits.
const HASH_W = 9;
const HASH_H = 8;

/** Max image attachments per message we will fetch + hash. */
const MAX_ATTACHMENTS = 4;
/** Skip attachments larger than this; the thumbnail proxy handles the rest. */
const MAX_BYTES = 12 * 1024 * 1024;
/** Per-fetch timeout. */
const FETCH_TIMEOUT_MS = 4000;

/**
 * Difference hash (dHash) of an image, as 16 hex chars (64 bits). Near-identical
 * images — including re-encoded, recompressed, or lightly resized copies —
 * produce hashes a small Hamming distance apart, which exact byte/metadata
 * signatures cannot detect.
 */
export async function dHashFromBuffer(buffer: Buffer): Promise<string> {
  const image = await Jimp.read(buffer);
  image.resize({ w: HASH_W, h: HASH_H }).greyscale();

  let bits = '';
  for (let y = 0; y < HASH_H; y++)
    for (let x = 0; x < HASH_W - 1; x++) {
      const left = intToRGBA(image.getPixelColor(x, y)).r;
      const right = intToRGBA(image.getPixelColor(x + 1, y)).r;
      bits += left < right ? '1' : '0';
    }

  // 64-bit string -> 16 hex chars
  let hex = '';
  for (let i = 0; i < bits.length; i += 4)
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

/** Hamming distance between two equal-length hex hashes (lower = more similar). */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Number.MAX_SAFE_INTEGER;
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    let nibble = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (nibble) {
      distance += nibble & 1;
      nibble >>= 1;
    }
  }
  return distance;
}

/**
 * A small thumbnail of the attachment via Discord's media proxy, so we transfer
 * and decode a few hundred bytes instead of the full image.
 */
function thumbnailUrl(attachment: Attachment): string {
  const base = attachment.proxyURL || attachment.url;
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}width=32&height=32`;
}

/**
 * Perceptual hashes for every image attachment on a message. Best-effort: any
 * attachment that fails to fetch or decode is skipped (the metadata signature
 * still covers it). Never throws.
 */
export async function perceptualHashes(message: Message): Promise<string[]> {
  const images = [...message.attachments.values()]
    .filter(isImageAttachment)
    .filter((attachment) => attachment.size <= MAX_BYTES)
    .slice(0, MAX_ATTACHMENTS);

  const hashes = await Promise.all(
    images.map(async (attachment) => {
      try {
        const response = await fetch(thumbnailUrl(attachment), {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!response.ok) return null;
        const buffer = Buffer.from(await response.arrayBuffer());
        return await dHashFromBuffer(buffer);
      } catch (error) {
        container.logger.debug(
          `Automod: could not perceptual-hash attachment ${attachment.id}:`,
          error
        );
        return null;
      }
    })
  );

  return hashes.filter((hash): hash is string => hash !== null);
}
