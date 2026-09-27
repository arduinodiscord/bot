import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { APIEmbed, GuildMember } from 'discord.js';
import { buildAlertPayload } from './console';
import { createIncident, type IncidentLevel } from './incidents';
import { embedLimitProblems } from '../embedLimits';

/** Every alert variant must fit Discord's embed limits, or the send fails and the alert is lost. */
function worstCase(level: IncidentLevel) {
  const ids = Array.from({ length: 40 }, (_, i) => `${100000000000000000n + BigInt(i)}`);
  return createIncident({
    userId: ids[0],
    guildId: '420594746990526466',
    level,
    reason: 'Same image from 40 accounts in 40 channel(s) '.repeat(3),
    messages: ids.map((id, i) => ({ channelId: `${200000000000000000n + BigInt(i)}`, messageId: id })),
    contentIds: ['a'.repeat(64)],
    hashes: ['0123456789abcdef'],
    score: 100,
    tier: 'critical',
    matched: Array.from({ length: 12 }, (_, i) => ({ label: `Signal number ${i} with a long label`, points: 50 })),
    clusterUserIds: ids,
    raidUserIds: ids.slice(0, 20),
    ocrText: 'CLAIM YOUR FREE CRYPTO '.repeat(40),
    severity: 'scam',
    learning: true,
  });
}

const member = {
  user: { tag: 'someone#0', createdAt: new Date() },
  joinedAt: new Date(),
  displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png',
} as unknown as GuildMember;

for (const level of ['cluster', 'blocklist', 'fanout', 'flood', 'crosspost'] as IncidentLevel[]) {
  test(`${level} alert fits Discord embed limits in the worst case`, () => {
    const payload = buildAlertPayload(
      worstCase(level),
      member,
      { attempted: 25, deleted: 3, timedOut: false, banned: false },
      { image: Buffer.from('png'), previewUrl: 'https://media.discordapp.net/x.png' }
    );
    const embed = (payload.embeds![0] as { toJSON(): APIEmbed }).toJSON();
    assert.deepEqual(embedLimitProblems(embed), []);
  });
}
