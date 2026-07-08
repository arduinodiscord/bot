import Tesseract from 'tesseract.js';
import type { Attachment, Message } from 'discord.js';
import { container } from '@sapphire/framework';
import { automodConfig } from '../config';
import { isImageAttachment, attachmentSignature } from './signature';

// tesseract.js v7: createWorker(langs) auto-loads and initializes the language model.
// No manual load() / loadLanguage() / initialize() calls needed.
let workerPromise: Promise<Tesseract.Worker> | null = null;
function getWorker(): Promise<Tesseract.Worker> {
  if (!workerPromise) workerPromise = Tesseract.createWorker('eng');
  return workerPromise;
}

// Cache OCR text by attachment signature so a raid's repeated image is read
// once. Only genuine completions are cached (see ocrAttachment) — a transient
// timeout or fetch error must never poison the cache and permanently suppress
// OCR for that fingerprint. Bounded so it cannot grow without limit.
const cache = new Map<string, string>();
const MAX_CACHE = 500;
let active = 0;

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

/** OCR all image attachments on a message; returns concatenated text (may be ''). */
export async function ocrMessage(message: Message): Promise<string> {
  if (!automodConfig.ocrEnabled) return '';
  const images = [...message.attachments.values()].filter(isImageAttachment).slice(0, 4);
  const texts = await Promise.all(images.map((a) => ocrAttachment(a)));
  return texts.filter(Boolean).join('\n');
}

async function ocrAttachment(a: Attachment): Promise<string> {
  const key = attachmentSignature(a);
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  // Best-effort concurrency guard: under load we skip rather than queue
  // unboundedly. A skip is deliberately NOT cached, so it can be retried later.
  if (active >= automodConfig.ocrMaxConcurrency) return '';
  active++;
  try {
    // withTimeout yields null on timeout; runOcr throws on fetch/decode failure.
    // Only a genuine completion (a string — possibly '' for a text-free image)
    // is cached. Transient timeouts/errors return '' WITHOUT caching so they
    // can't poison the cache and blind OCR for this fingerprint on later posts.
    const text = await withTimeout(runOcr(a), automodConfig.ocrTimeoutMs);
    if (text === null) return '';
    const result = text.trim();
    if (cache.size >= MAX_CACHE) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, result);
    return result;
  } catch (e) {
    container.logger.debug(`Automod: OCR failed for ${a.id}:`, e);
    return '';
  } finally { active--; }
}

/** Cap on fetched image bytes, to bound memory / decompression-bomb risk. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

async function runOcr(a: Attachment): Promise<string> {
  const res = await fetch(readableUrl(a), { signal: AbortSignal.timeout(automodConfig.ocrTimeoutMs) });
  if (!res.ok) throw new Error(`OCR fetch failed with status ${res.status}`);
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > MAX_IMAGE_BYTES) throw new Error('image too large');
  const buffer = Buffer.from(await res.arrayBuffer());
  const worker = await getWorker();
  const { data } = await worker.recognize(buffer);
  return data.text ?? '';
}
