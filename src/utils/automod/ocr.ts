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

// Cache OCR text by attachment signature so a raid's repeated image is read once.
const cache = new Map<string, string>();
let active = 0;

function readableUrl(a: Attachment): string {
  const base = a.proxyURL || a.url;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}width=${automodConfig.ocrImageWidth}&height=${automodConfig.ocrImageWidth}`;
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((res) => setTimeout(() => res(null), ms)),
  ]);
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
  if (active >= automodConfig.ocrMaxConcurrency) return '';
  active++;
  try {
    const text = await withTimeout(runOcr(a), automodConfig.ocrTimeoutMs);
    const result = (text ?? '').trim();
    cache.set(key, result);
    return result;
  } catch (e) {
    container.logger.debug(`Automod: OCR failed for ${a.id}:`, e);
    return '';
  } finally { active--; }
}

async function runOcr(a: Attachment): Promise<string> {
  const res = await fetch(readableUrl(a), { signal: AbortSignal.timeout(automodConfig.ocrTimeoutMs) });
  if (!res.ok) return '';
  const buffer = Buffer.from(await res.arrayBuffer());
  const worker = await getWorker();
  const { data } = await worker.recognize(buffer);
  return data.text ?? '';
}
