import { container } from '@sapphire/framework';
import { seedScamKeywords } from '../config';
import { getPrisma } from '../db';

const STOP = new Set(['the','and','you','your','for','with','this','that','have','from','are','now','get','all']);
const learned = new Set<string>();

/** Split OCR text into lowercase alphabetic tokens (length >= 3). */
export function tokenizeOcr(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]+/g) ?? []).filter((t) => t.length >= 3);
}

/** Distinct scam keywords (seed + learned) present in the text. */
export function matchKeywords(text: string): string[] {
  const tokens = new Set(tokenizeOcr(text));
  const active = new Set<string>([...seedScamKeywords, ...learned]);
  const hits = new Set<string>();
  for (const kw of active) {
    if (kw.includes(' ')) { if (text.toLowerCase().includes(kw)) hits.add(kw); }
    else if (tokens.has(kw)) hits.add(kw);
  }
  return [...hits];
}

/** Add distinctive tokens to the learned store (memory + DB). */
export async function learnKeywords(tokens: string[], addedBy: string): Promise<void> {
  const fresh = tokens.filter((t) => t.length >= 4 && !STOP.has(t) && !learned.has(t));
  for (const t of fresh) learned.add(t);
  const prisma = getPrisma();
  if (!prisma || fresh.length === 0) return;
  try {
    await prisma.$transaction(fresh.map((keyword) =>
      prisma.scamKeyword.upsert({
        where: { keyword }, create: { keyword, addedBy },
        update: { hits: { increment: 1 } },
      })));
  } catch (e) { container.logger.error('Learning keywords failed:', e); }
}

/** Load learned keywords on startup. Safe without a database. */
export async function loadKeywords(): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;
  try {
    const rows = await prisma.scamKeyword.findMany({ select: { keyword: true } });
    for (const { keyword } of rows) learned.add(keyword);
    container.logger.info(`Automod: loaded ${learned.size} learned scam keyword(s).`);
  } catch (e) { container.logger.error('Loading keywords failed:', e); }
}

export function __resetKeywords(): void { learned.clear(); }
