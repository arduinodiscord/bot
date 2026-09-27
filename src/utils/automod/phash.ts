import { Jimp, intToRGBA } from 'jimp';
import type { Attachment, Message } from 'discord.js';
import { container } from '@sapphire/framework';
import { automodConfig } from '../config';
import { createHash } from 'node:crypto';
import { isRasterImage } from './signature';

// pHash parameters: resize to DCT_INPUT_SIZE×DCT_INPUT_SIZE, then keep the
// top-left DCT_COEFF_SIZE×DCT_COEFF_SIZE low-frequency block (64 bits).
const DCT_INPUT_SIZE = 32;
const DCT_COEFF_SIZE = 8;

/** Max image attachments per message we will fetch + hash. */
const MAX_ATTACHMENTS = 4;
/** Per-fetch timeout. */
const FETCH_TIMEOUT_MS = 4000;
/** Bound on the Jimp decode of a single image (a crafted image can hang). */
const DECODE_TIMEOUT_MS = 4000;
/** Cap on fetched image bytes, to bound memory / decompression-bomb risk. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

/** How long an attachment may wait for a free hashing slot before it is skipped. */
const SLOT_WAIT_MS = 8000;

/** In-flight fetch/decode count, to cap fan-out during a raid. */
let active = 0;
/** Callers waiting for a slot, released in FIFO order. */
const waiting: Array<() => void> = [];

/**
 * Wait (bounded) for a hashing slot. During a raid several messages arrive at
 * once; skipping outright used to drop most of their hashes, which blinded
 * cross-account matching of re-encoded copies. Resolves false on timeout.
 */
function acquireSlot(): Promise<boolean> {
  if (active < automodConfig.phashMaxConcurrency) {
    active++;
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const grant = () => {
      clearTimeout(timer);
      active++;
      resolve(true);
    };
    const timer = setTimeout(() => {
      const i = waiting.indexOf(grant);
      if (i >= 0) waiting.splice(i, 1);
      resolve(false);
    }, SLOT_WAIT_MS);
    waiting.push(grant);
  });
}

function releaseSlot(): void {
  active--;
  const next = waiting.shift();
  if (next) next();
}

/**
 * Race a promise against a timeout, resolving to `null` if the timeout wins.
 * Used to bound a potentially hanging Jimp decode.
 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let t: ReturnType<typeof setTimeout>;
  const timeout = new Promise<null>((res) => {
    t = setTimeout(() => res(null), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(t!)) as Promise<
    T | null
  >;
}

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
 * Minimum mean |AC coefficient| for an image to carry a usable fingerprint.
 * A flat or near-flat image (blank, solid colour, empty screenshot) has almost
 * no low-frequency structure, so its bits would be decided by noise and it
 * would "match" every other flat image. Such images get no pHash (a blank
 * canvas with one small 10px mark scores ~18; a real screenshot is in the
 * hundreds or thousands). Exact duplicates are still caught by signature.
 */
const MIN_AC_ENERGY = 50;

/**
 * Perceptual hash (pHash) of an image, as 16 hex chars (64 bits), or `null`
 * when the image is too flat to fingerprint meaningfully.
 *
 * 1. Resize to 32×32 and greyscale.
 * 2. Compute 2-D DCT.
 * 3. Extract the top-left 8×8 low-frequency block (64 coefficients).
 * 4. Take the median of the 63 AC coefficients. The DC term (index 0) is the
 *    overall brightness and is orders of magnitude larger than the rest; letting
 *    it into the threshold drove almost every bit to 0, so unrelated
 *    screenshots collided. It is excluded, and its bit is fixed at 0.
 * 5. Bit i = 1 if AC coefficient i > median, else 0.
 *
 * Near-identical images — re-encoded, recompressed, watermarked, or lightly
 * resized/brightened — produce hashes with a small Hamming distance, which
 * exact metadata signatures cannot detect. Rotation, perspective warps, and
 * crops of more than a few percent do NOT survive; other signals cover those.
 */
export async function pHashFromBuffer(buffer: Buffer): Promise<string | null> {
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

  const ac = low.slice(1);
  const energy = ac.reduce((s, v) => s + Math.abs(v), 0) / ac.length;
  if (energy < MIN_AC_ENERGY) return null;

  const sorted = [...ac].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const median =
    sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  // 64 bits → 16 hex chars (bit 0 = DC, always 0)
  let bits = '0';
  for (const v of ac) bits += v > median ? '1' : '0';
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
  // format=png: Jimp cannot decode WebP, so ask the proxy for PNG.
  return `${base}${separator}width=64&height=64&format=png`;
}

/** Fingerprints for one image attachment. Either may be missing on failure. */
export interface ImageFingerprint {
  /**
   * SHA-256 of the thumbnail bytes Discord's media proxy served for this
   * image. This is the image's identity: it depends on the actual pixels, so
   * unlike the metadata signature (type, byte size, dimensions — all chosen by
   * the uploader) it cannot be forged to impersonate another image.
   */
  contentId: string | null;
  /** Perceptual hash, for near-duplicate (re-encoded / resized) matching. */
  hash: string | null;
}

export interface MessageFingerprints {
  images: ImageFingerprint[];
  contentIds: string[];
  hashes: string[];
}

/**
 * Content ids and perceptual hashes for every raster image on a message.
 * Best-effort: an attachment that fails to fetch or decode yields nulls.
 * Never throws.
 */
export async function imageFingerprints(message: Message): Promise<MessageFingerprints> {
  const attachments = [...message.attachments.values()]
    .filter(isRasterImage)
    .slice(0, MAX_ATTACHMENTS);

  const images = await Promise.all(
    attachments.map(async (attachment): Promise<ImageFingerprint> => {
      const none = { contentId: null, hash: null };
      if (!(await acquireSlot())) {
        container.logger.info(
          `Automod: skipped fingerprinting attachment ${attachment.id} (queue full).`
        );
        return none;
      }
      try {
        const response = await fetch(thumbnailUrl(attachment), {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!response.ok) return none;
        const len = Number(response.headers.get('content-length') ?? 0);
        if (len > MAX_IMAGE_BYTES) return none;
        const bytes = Buffer.from(await response.arrayBuffer());
        // content-length can be absent; enforce the cap on what we received.
        if (bytes.byteLength > MAX_IMAGE_BYTES) return none;
        const contentId = createHash('sha256').update(bytes).digest('hex');
        // Bound the decode: a crafted image can hang Jimp.read with no abort.
        const hash = await withTimeout(pHashFromBuffer(bytes), DECODE_TIMEOUT_MS).catch(
          () => null
        );
        return { contentId, hash };
      } catch (error) {
        container.logger.debug(
          `Automod: could not fingerprint attachment ${attachment.id}:`,
          error
        );
        return none;
      } finally {
        releaseSlot();
      }
    })
  );

  return {
    images,
    contentIds: images.flatMap((i) => (i.contentId ? [i.contentId] : [])),
    hashes: images.flatMap((i) => (i.hash ? [i.hash] : [])),
  };
}

/** Largest evidence image we attach to a mod alert. */
const MAX_EVIDENCE_BYTES = 4 * 1024 * 1024;
const EVIDENCE_TIMEOUT_MS = 3000;

/**
 * A moderate-size PNG copy of the message's first raster image, fetched before
 * the bot deletes the message so the alert still shows moderators what was
 * posted. Best-effort: resolves undefined on any failure, never throws.
 */
export async function fetchEvidence(message: Message): Promise<Buffer | undefined> {
  const first = [...message.attachments.values()].find(isRasterImage);
  if (!first) return undefined;
  try {
    const base = first.proxyURL || first.url;
    const url = `${base}${base.includes('?') ? '&' : '?'}width=512&height=512&format=png`;
    const response = await fetch(url, { signal: AbortSignal.timeout(EVIDENCE_TIMEOUT_MS) });
    if (!response.ok) return undefined;
    if (Number(response.headers.get('content-length') ?? 0) > MAX_EVIDENCE_BYTES) return undefined;
    const bytes = Buffer.from(await response.arrayBuffer());
    return bytes.byteLength <= MAX_EVIDENCE_BYTES ? bytes : undefined;
  } catch {
    return undefined;
  }
}

/** Perceptual hashes only (kept for callers that need nothing else). */
export async function perceptualHashes(message: Message): Promise<string[]> {
  return (await imageFingerprints(message)).hashes;
}

/** Test-only reset (no cached state remains; kept for test symmetry). */
export function __resetPhash(): void {}
