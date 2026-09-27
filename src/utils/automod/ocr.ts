import path from 'node:path';
import Tesseract from 'tesseract.js';
import type { Attachment, Message } from 'discord.js';
import { container } from '@sapphire/framework';
import { automodConfig } from '../config';
import { isRasterImage } from './signature';

// The English model ships inside the image (@tesseract.js-data/eng), so OCR
// never downloads from a CDN at runtime: a blocked or flaky CDN used to leave
// OCR dead, and without the errorHandler below it crashed the whole process.
const LANG_PATH = path.join(
  path.dirname(require.resolve('@tesseract.js-data/eng/package.json')),
  '4.0.0_best_int'
);

// tesseract.js v7: createWorker(langs) auto-loads and initializes the language model.
// No manual load() / loadLanguage() / initialize() calls needed.
let workerPromise: Promise<Tesseract.Worker> | null = null;
function getWorker(): Promise<Tesseract.Worker> {
  if (!workerPromise) {
    workerPromise = Tesseract.createWorker('eng', Tesseract.OEM.LSTM_ONLY, {
      langPath: LANG_PATH,
      cacheMethod: 'none',
      // REQUIRED: without an errorHandler, tesseract.js rethrows every failed
      // job (e.g. an image it cannot decode) from inside an event listener,
      // which is an uncaught exception that kills the bot. The failed job's
      // promise still rejects, so callers see the error normally.
      // It must never throw itself, or it reintroduces the crash.
      errorHandler: (error: unknown) => {
        try {
          container.logger?.debug('Automod: OCR job failed:', error);
        } catch {
          /* ignore */
        }
      },
    });
    // A failed init (e.g. a transient error) must not be cached forever, or
    // OCR would stay dead until a restart.
    workerPromise.catch(() => {
      workerPromise = null;
    });
  }
  return workerPromise;
}

/**
 * Pre-initialize the OCR worker at startup. The first createWorker() call
 * spawns the worker and downloads the language model, which easily blows the
 * per-image OCR budget — without warming, the keyword signal silently reads
 * '' for every image until the worker finishes initializing.
 */
export async function warmOcr(): Promise<void> {
  if (!automodConfig.ocrEnabled) return;
  try {
    await getWorker();
    container.logger.info('Automod: OCR worker ready.');
  } catch (error) {
    container.logger.warn(
      'Automod: OCR worker failed to initialize (keyword signal degraded; will retry on demand):',
      error
    );
  }
}

// Cache OCR text by attachment signature so a raid's repeated image is read
// once. Only genuine completions are cached (see ocrAttachment) — a transient
// timeout or fetch error must never poison the cache and permanently suppress
// OCR for that fingerprint. Bounded so it cannot grow without limit.
const cache = new Map<string, string>();
const MAX_CACHE = 500;
let active = 0;
const waiting: Array<() => void> = [];

function acquireOcrSlot(): Promise<boolean> {
  if (active < automodConfig.ocrMaxConcurrency) {
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
    }, automodConfig.ocrTimeoutMs);
    waiting.push(grant);
  });
}

function releaseOcrSlot(): void {
  active--;
  waiting.shift()?.();
}

function readableUrl(a: Attachment): string {
  const base = a.proxyURL || a.url;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}width=${automodConfig.ocrImageWidth}&height=${automodConfig.ocrImageWidth}`;
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<null>((res) => {
    timer = setTimeout(() => res(null), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

/**
 * OCR all raster image attachments on a message; returns concatenated text
 * (may be ''). `contentIds` are the per-attachment content ids from
 * imageFingerprints (same order); they key the cache. The metadata signature
 * must not be used as a key: an uploader controls it, so a benign image could
 * poison the cached text of a scam image with the same metadata.
 */
export async function ocrMessage(
  message: Message,
  contentIds: Array<string | null> = []
): Promise<string> {
  if (!automodConfig.ocrEnabled) return '';
  const images = [...message.attachments.values()].filter(isRasterImage).slice(0, 4);
  const texts = await Promise.all(images.map((a, i) => ocrAttachment(a, contentIds[i] ?? null)));
  return texts.filter(Boolean).join('\n');
}

async function ocrAttachment(a: Attachment, key: string | null): Promise<string> {
  const cached = key ? cache.get(key) : undefined;
  if (cached !== undefined) return cached;
  // Wait (bounded) for a slot rather than skipping outright, so a burst of
  // slow images can't trivially blind OCR for the raid images behind it. A
  // skip is deliberately NOT cached, so it can be retried later. Raid
  // detection itself does not depend on OCR (cross-account matching and the
  // image-only shape carry it); OCR only adds corroboration.
  if (!(await acquireOcrSlot())) return '';
  // The slot is released when the OCR job actually settles, NOT when our
  // timeout fires: a timed-out recognize() keeps running in the worker, and
  // releasing early would let new jobs pile up behind it during a raid. While
  // a slow job holds a slot, new images are skipped instead.
  const job = runOcr(a)
    .then((text) => {
      // Cache genuine completions, even ones that finish after our timeout, so
      // the next copy of a raid image is read instantly.
      const result = text.trim();
      if (!key) return result;
      if (cache.size >= MAX_CACHE) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
      cache.set(key, result);
      return result;
    })
    .finally(releaseOcrSlot);
  try {
    // withTimeout yields null on timeout; runOcr throws on fetch/decode failure.
    // Transient timeouts/errors return '' WITHOUT caching so they can't poison
    // the cache and blind OCR for this fingerprint on later posts.
    const text = await withTimeout(job, automodConfig.ocrTimeoutMs);
    return text ?? '';
  } catch (e) {
    container.logger.debug(`Automod: OCR failed for ${a.id}:`, e);
    return '';
  }
}

/** Cap on fetched image bytes, to bound memory / decompression-bomb risk. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

async function runOcr(a: Attachment): Promise<string> {
  const res = await fetch(readableUrl(a), { signal: AbortSignal.timeout(automodConfig.ocrTimeoutMs) });
  if (!res.ok) throw new Error(`OCR fetch failed with status ${res.status}`);
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > MAX_IMAGE_BYTES) throw new Error('image too large');
  const bytes = await res.arrayBuffer();
  // content-length can be absent; enforce the cap on what we received.
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error('image too large');
  return recognizeImage(Buffer.from(bytes));
}

/** Run OCR on raw image bytes. Rejects (never crashes) on undecodable input. */
export async function recognizeImage(buffer: Buffer): Promise<string> {
  const worker = await getWorker();
  const { data } = await worker.recognize(buffer);
  return data.text ?? '';
}

/** Shut the OCR worker down (tests, graceful shutdown). */
export async function stopOcr(): Promise<void> {
  const pending = workerPromise;
  workerPromise = null;
  if (pending) await (await pending.catch(() => null))?.terminate();
}
