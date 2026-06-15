import { Jimp, intToRGBA } from 'jimp';
import type { Attachment, Message } from 'discord.js';
import { container } from '@sapphire/framework';
import { isImageAttachment } from './signature';

// pHash parameters: resize to DCT_INPUT_SIZE×DCT_INPUT_SIZE, then keep the
// top-left DCT_COEFF_SIZE×DCT_COEFF_SIZE low-frequency block (64 bits).
const DCT_INPUT_SIZE = 32;
const DCT_COEFF_SIZE = 8;

/** Max image attachments per message we will fetch + hash. */
const MAX_ATTACHMENTS = 4;
/** Per-fetch timeout. */
const FETCH_TIMEOUT_MS = 4000;

/**
 * Pre-computed cosine table for the 1-D DCT:
 *   cosTable[k][n] = cos(π/N * (n + 0.5) * k)  for N = DCT_INPUT_SIZE
 * Computed once at module load so per-image cost is multiplications only.
 */
const cosTable: number[][] = Array.from({ length: DCT_INPUT_SIZE }, (_, k) =>
  Array.from({ length: DCT_INPUT_SIZE }, (__, n) =>
    Math.cos((Math.PI / DCT_INPUT_SIZE) * (n + 0.5) * k)
  )
);

/** 1-D DCT-II applied to a signal of length DCT_INPUT_SIZE. */
function dct1d(signal: number[]): number[] {
  return Array.from({ length: DCT_INPUT_SIZE }, (_, k) => {
    let sum = 0;
    for (let n = 0; n < DCT_INPUT_SIZE; n++) sum += signal[n] * cosTable[k][n];
    return sum;
  });
}

/**
 * 2-D DCT via two separable passes of the 1-D DCT: first across rows, then
 * down columns. Input/output are row-major flat arrays of DCT_INPUT_SIZE².
 */
function dct2d(pixels: number[]): number[] {
  const N = DCT_INPUT_SIZE;

  // Pass 1: DCT each row
  const tmp = new Array<number>(N * N);
  for (let r = 0; r < N; r++) {
    const row = pixels.slice(r * N, r * N + N);
    const t = dct1d(row);
    for (let c = 0; c < N; c++) tmp[r * N + c] = t[c];
  }

  // Pass 2: DCT each column
  const out = new Array<number>(N * N);
  for (let c = 0; c < N; c++) {
    const col = Array.from({ length: N }, (_, r) => tmp[r * N + c]);
    const t = dct1d(col);
    for (let r = 0; r < N; r++) out[r * N + c] = t[r];
  }

  return out;
}

/**
 * Perceptual hash (pHash) of an image, as 16 hex chars (64 bits).
 *
 * 1. Resize to 32×32 and greyscale.
 * 2. Compute 2-D DCT.
 * 3. Extract the top-left 8×8 low-frequency block (64 coefficients).
 * 4. Compute the mean of those values.
 * 5. Bit i = 1 if coefficient i > mean, else 0.
 *
 * Near-identical images — re-encoded, recompressed, watermarked, or lightly
 * resized/cropped — produce hashes with a small Hamming distance, which exact
 * metadata signatures cannot detect.
 */
export async function pHashFromBuffer(buffer: Buffer): Promise<string> {
  const image = await Jimp.read(buffer);
  image.resize({ w: DCT_INPUT_SIZE, h: DCT_INPUT_SIZE }).greyscale();

  const pixels: number[] = [];
  for (let y = 0; y < DCT_INPUT_SIZE; y++)
    for (let x = 0; x < DCT_INPUT_SIZE; x++)
      pixels.push(intToRGBA(image.getPixelColor(x, y)).r);

  const dct = dct2d(pixels);

  // Top-left 8×8 low-frequency block
  const low: number[] = [];
  for (let r = 0; r < DCT_COEFF_SIZE; r++)
    for (let c = 0; c < DCT_COEFF_SIZE; c++)
      low.push(dct[r * DCT_INPUT_SIZE + c]);

  const mean = low.reduce((s, v) => s + v, 0) / low.length;

  // 64 bits → 16 hex chars
  let bits = '';
  for (const v of low) bits += v > mean ? '1' : '0';
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
 * Discord thumbnail proxy URL for an attachment. We request 64×64 so Discord
 * handles the expensive initial downscale and we receive a small buffer; Jimp
 * then resizes it further to 32×32 with better antialiasing than starting from
 * a 32×32 proxy directly.
 */
function thumbnailUrl(attachment: Attachment): string {
  const base = attachment.proxyURL || attachment.url;
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}width=64&height=64`;
}

/**
 * Perceptual hashes for every image attachment on a message. Best-effort: any
 * attachment that fails to fetch or decode is skipped (the metadata signature
 * still covers it). Never throws.
 */
export async function perceptualHashes(message: Message): Promise<string[]> {
  const images = [...message.attachments.values()]
    .filter(isImageAttachment)
    .slice(0, MAX_ATTACHMENTS);

  const hashes = await Promise.all(
    images.map(async (attachment) => {
      try {
        const response = await fetch(thumbnailUrl(attachment), {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!response.ok) return null;
        const buffer = Buffer.from(await response.arrayBuffer());
        return await pHashFromBuffer(buffer);
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
