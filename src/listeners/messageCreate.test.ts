/**
 * End-to-end simulation of the image-spam automod: the real
 * MessageCreateListener.run (and SpamModerationHandler.run for moderator
 * buttons) driven with fake discord.js objects. Network is stubbed (pHash
 * fetches get real generated PNGs); OCR is off.
 */
import '../test/simEnv';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { Message, ButtonInteraction } from 'discord.js';
import { MessageCreateListener } from './messageCreate';
import { SpamModerationHandler } from '../interaction-handlers/spamModeration';
import { __resetTracker } from '../utils/automod/tracker';
import { __resetFlood } from '../utils/automod/flood';
import { __resetCrosspost } from '../utils/automod/crosspost';
import { __resetGlobalIndex } from '../utils/automod/globalIndex';
import { __resetBlocklist, addToBlocklist } from '../utils/automod/blocklist';
import { __resetIncidents } from '../utils/automod/incidents';
import { __resetKeywords } from '../utils/automod/keywords';
import { automodConfig } from '../utils/config';
import { perceptualHashes } from '../utils/automod/phash';
import {
  resetWorld,
  world,
  addMember,
  addNewMember,
  makeImage,
  makeMessage,
  imageAlerts,
  alertText,
  field,
  tierOf,
  incidentIdOf,
  makeButtonInteraction,
  type FakeMember,
  type PostOptions,
  type SimImage,
} from '../test/automodSim';

const listener = Object.create(MessageCreateListener.prototype) as MessageCreateListener;
const handler = Object.create(SpamModerationHandler.prototype) as SpamModerationHandler;

async function post(member: FakeMember, opts: PostOptions) {
  const message = makeMessage(member, opts);
  await listener.run(message as unknown as Message);
  return message;
}

async function click(action: string, incidentId: string, modId = 'mod-1') {
  const interaction = makeButtonInteraction(action, incidentId, modId);
  await handler.run(interaction as unknown as ButtonInteraction, { action, incidentId });
  return interaction;
}

const deletedIds = () => world.deletes.map((d) => d.messageId).sort();
const timedOut = (id: string) => world.timeouts.filter((t) => t.userId === id && t.duration !== null);

let raidA: SimImage;
let raidB: SimImage;
let diagram: SimImage;
let screenshot: SimImage;

beforeEach(async () => {
  __resetTracker();
  __resetFlood();
  __resetCrosspost();
  __resetGlobalIndex();
  __resetBlocklist();
  __resetIncidents();
  __resetKeywords();
  automodConfig.learningMode = 'auto';
  resetWorld();
  raidA ??= await makeImage(11);
  raidB ??= await makeImage(12);
  diagram ??= await makeImage(21);
  screenshot ??= await makeImage(31);
});

const QUESTION = 'Why does my servo jitter when I power it from the 5V pin of my board?';

test('sanity: generated images carry perceptual hashes', async () => {
  const m = makeMessage(addMember('u'), { images: [raidA, raidB] });
  const hashes = await perceptualHashes(m as unknown as Message);
  assert.equal(hashes.length, 2);
  assert.notEqual(hashes[0], hashes[1]);
});

test('1: two established accounts post the identical 2-image message -> high: delete both, time out the second', async () => {
  const a = addMember('alice');
  const b = addMember('bob');
  const m1 = await post(a, { images: [raidA, raidB], channelId: 'general' });
  const m2 = await post(b, { images: [raidA, raidB], channelId: 'projects' });

  assert.deepEqual(deletedIds(), [m1.id, m2.id].sort());
  assert.equal(timedOut('bob').length, 1);
  assert.equal(timedOut('alice').length, 0);

  const last = imageAlerts().at(-1)!;
  assert.equal(tierOf(last), 'HIGH');
  assert.match(field(last, 'Signal')!, /Same image from 2 accounts/);
  const action = field(last, 'Auto-action')!;
  assert.match(action, /✅ Deleted 2\/2 message\(s\)/);
  assert.match(action, /✅ Timed out/);
  assert.doesNotMatch(action, /FAILED/);
});

test('1b: three raid accounts post the pair concurrently -> every later raider is timed out, all copies deleted', async () => {
  const raiders = ['r-a', 'r-b', 'r-c'].map((id) => addNewMember(id));
  const messages = await Promise.all(
    raiders.map((r, i) => post(r, { images: [raidA, raidB], channelId: `ch-${i}` }))
  );
  assert.deepEqual(deletedIds(), messages.map((m) => m.id).sort());
  assert.equal(new Set(world.timeouts.map((t) => t.userId)).size, 2);
  assert.ok(imageAlerts().some((a) => tierOf(a) === 'HIGH'));
});

test('1c: re-encoded copies (different metadata, same pixels) still cluster via perceptual hash', async () => {
  const reA = { ...raidA, bytes: raidA.bytes + 137 };
  const reB = { ...raidB, bytes: raidB.bytes + 211 };
  const m1 = await post(addMember('p1'), { images: [raidA, raidB] });
  const m2 = await post(addMember('p2'), { images: [reA, reB] });
  assert.equal(tierOf(imageAlerts().at(-1)!), 'HIGH');
  assert.deepEqual(deletedIds(), [m1.id, m2.id].sort());
  assert.equal(timedOut('p2').length, 1);
});

test(
  '1d: concurrent raid of re-encoded copies -> every later raider is still caught',
  {
    todo:
      'BUG: perceptualHashes skips (not queues) attachments once AUTOMOD_PHASH_MAX_CONCURRENCY (3) fetches are in flight, so the 3rd raider of a concurrent 2-image raid gets no hashes and scores LOW',
  },
  async () => {
    const raiders = ['q1', 'q2', 'q3'].map((id) => addNewMember(id));
    // Each copy re-encoded: distinct metadata signature, same pixels.
    const messages = await Promise.all(
      raiders.map((r, i) =>
        post(r, {
          images: [{ ...raidA, bytes: raidA.bytes + i + 1 }, { ...raidB, bytes: raidB.bytes + i + 1 }],
          channelId: `ch-${i}`,
        })
      )
    );
    assert.deepEqual(deletedIds(), messages.map((m) => m.id).sort());
    assert.equal(new Set(world.timeouts.map((t) => t.userId)).size, 2);
  }
);

test('2: three accounts post an identical single image with text -> high on the third', async () => {
  const [a, b, c] = ['u1', 'u2', 'u3'].map((id) => addMember(id));
  await post(a, { images: [diagram], content: QUESTION, channelId: 'c1' });
  await post(b, { images: [diagram], content: 'Same problem here, any ideas how to fix this?', channelId: 'c2' });
  assert.equal(world.deletes.length, 0, 'two accounts sharing an image with text must not auto-act');
  assert.equal(world.timeouts.length, 0);
  assert.equal(tierOf(imageAlerts().at(-1)!), 'MEDIUM');

  await post(c, { images: [diagram], content: 'Has anyone seen this before? It keeps happening', channelId: 'c3' });
  const last = imageAlerts().at(-1)!;
  assert.equal(tierOf(last), 'HIGH');
  assert.match(field(last, 'Signal')!, /Same image from 3 accounts/);
  assert.equal(timedOut('u3').length, 1);
  assert.equal(world.deletes.length, 3);
  assert.match(field(last, 'Auto-action')!, /✅ Timed out/);
});

test('3: two regular members share an image with a text question -> medium, alert only', async () => {
  const a = addMember('r1');
  const b = addMember('r2');
  await post(a, { images: [diagram], content: QUESTION, channelId: 'help-1' });
  assert.equal(imageAlerts().length, 0, 'a lone image with a question has no signal');
  await post(b, { images: [diagram], content: 'I copied this wiring diagram and my LED stays off.', channelId: 'help-2' });

  const alerts = imageAlerts();
  assert.equal(alerts.length, 1);
  assert.equal(tierOf(alerts[0]), 'MEDIUM');
  assert.equal(field(alerts[0], 'Auto-action'), undefined, 'no auto-action on medium');
  assert.equal(world.deletes.length, 0);
  assert.equal(world.timeouts.length, 0);
  assert.equal(world.bans.length, 0);
});

test('4: new member cross-posts screenshot + text: 2 channels -> medium alert only; 3 channels -> high', async () => {
  const n = addNewMember('newbie');
  await post(n, { images: [screenshot], content: QUESTION, channelId: 'ch-a' });
  await post(n, { images: [screenshot], content: QUESTION, channelId: 'ch-b' });

  let last = imageAlerts().at(-1)!;
  assert.equal(tierOf(last), 'MEDIUM');
  assert.match(field(last, 'Signal')!, /fan-out/i);
  assert.equal(world.deletes.length, 0, '2 channels must not delete');
  assert.equal(world.timeouts.length, 0, '2 channels must not time out');

  await post(n, { images: [screenshot], content: QUESTION, channelId: 'ch-c' });
  last = imageAlerts().at(-1)!;
  assert.equal(tierOf(last), 'HIGH');
  assert.equal(world.deletes.length, 3);
  assert.equal(timedOut('newbie').length, 1);
  assert.match(field(last, 'Auto-action')!, /✅ Deleted 3\/3/);
});

test('5: repeat spam inside the cooldown is still enforced; mod-log throttled except on escalation', async () => {
  const a = addMember('a5');
  const b = addMember('b5');
  await post(a, { images: [raidA, raidB] });
  await post(b, { images: [raidA, raidB] });
  const alertsAfterHigh = imageAlerts().length;
  assert.equal(tierOf(imageAlerts().at(-1)!), 'HIGH');
  assert.equal(timedOut('b5').length, 1);

  // Same user keeps going within the 30s cooldown: still high each time.
  const m3 = await post(b, { images: [raidA, raidB] });
  const m4 = await post(b, { images: [raidA, raidB] });
  assert.equal(timedOut('b5').length, 3, 'each high message re-applies the timeout');
  assert.ok(deletedIds().includes(m3.id) && deletedIds().includes(m4.id), 'each repeat is deleted');
  assert.equal(imageAlerts().length, alertsAfterHigh, 'same-tier repeats are throttled');
  assert.ok(world.logs.some((l) => l.level === 'info' && String(l.args[0]).includes('suppressed by cooldown')));

  // Escalation: the image is now a confirmed scam -> critical breaks through.
  await addToBlocklist(['image/png|' + raidA.bytes + '|160x120'], [], 'mod', 'test', 'scam');
  const m5 = await post(b, { images: [raidA, raidB] });
  assert.equal(imageAlerts().length, alertsAfterHigh + 1, 'escalation to critical is alerted');
  assert.equal(tierOf(imageAlerts().at(-1)!), 'CRITICAL');
  assert.ok(world.bans.some((x) => x.userId === 'b5'));
  assert.ok(deletedIds().includes(m5.id));
});

test('6: after "Confirm scam", a new account posting the same image is auto-banned (critical)', async () => {
  const a = addMember('a6');
  const b = addMember('b6');
  await post(a, { images: [raidA, raidB] });
  await post(b, { images: [raidA, raidB] });
  const incidentId = incidentIdOf(imageAlerts().at(-1)!);

  const i = await click('confirmscam', incidentId);
  assert.match(i.edits.at(-1)!, /Confirmed scam — banned 2\/2/);
  const bansBefore = world.bans.length;

  const raider = addNewMember('raider');
  const m = await post(raider, { images: [raidA, raidB], channelId: 'offtopic' });
  assert.equal(world.bans.length, bansBefore + 1);
  assert.equal(world.bans.at(-1)!.userId, 'raider');
  assert.ok(deletedIds().includes(m.id));
  const last = imageAlerts().at(-1)!;
  assert.equal(tierOf(last), 'CRITICAL');
  assert.match(alertText(last), /Known spam image/);
  assert.match(field(last, 'Auto-action')!, /✅ Banned/);
});

test('7: staff posting the raid images -> nothing happens', async () => {
  const s1 = addMember('staff1', { staff: true });
  const s2 = addMember('staff2', { staff: true });
  await post(s1, { images: [raidA, raidB] });
  await post(s2, { images: [raidA, raidB] });
  assert.equal(world.alerts.length, 0);
  assert.equal(world.deletes.length, 0);
  assert.equal(world.timeouts.length, 0);
  assert.equal(world.bans.length, 0);

  // Staff posts were never recorded: a member posting it next is not clustered.
  await post(addMember('regular'), { images: [raidA, raidB] });
  assert.notEqual(tierOf(imageAlerts().at(-1)!), 'HIGH');
  assert.equal(world.timeouts.length, 0);
});

test('8: timeout fails (member not moderatable) -> alert reports "Timeout FAILED", no crash', async () => {
  const a = addMember('a8');
  const b = addMember('b8', { moderatable: false });
  await post(a, { images: [raidA, raidB] });
  await post(b, { images: [raidA, raidB] });
  assert.equal(world.timeouts.length, 0);
  const action = field(imageAlerts().at(-1)!, 'Auto-action')!;
  assert.match(action, /❌ Timeout FAILED/);
  assert.match(action, /Some actions failed/);
});

test('9: mod-log send throws -> listener does not throw; error logged with the auto-action', async () => {
  const a = addMember('a9');
  const b = addMember('b9');
  await post(a, { images: [raidA, raidB] });
  world.failModLog = true;
  await assert.doesNotReject(post(b, { images: [raidA, raidB] }));
  assert.equal(timedOut('b9').length, 1, 'enforcement still happened');
  const err = world.logs.find((l) => l.level === 'error' && String(l.args[0]).includes('posting alert to mod log failed'));
  assert.ok(err, 'failure is logged');
  assert.match(String(err!.args[0]), /auto-action: .*"timedOut":true/);
});

test('10: "Not spam" on an auto-timed-out incident lifts the timeout and allowlists the image', async () => {
  const a = addMember('a10');
  const b = addMember('b10');
  await post(a, { images: [raidA, raidB] });
  await post(b, { images: [raidA, raidB] });
  assert.equal(timedOut('b10').length, 1);
  const incidentId = incidentIdOf(imageAlerts().at(-1)!);

  const i = await click('dismiss', incidentId);
  assert.ok(world.timeouts.some((t) => t.userId === 'b10' && t.duration === null), 'timeout(null) called');
  assert.match(i.edits.at(-1)!, /Lifted the automatic timeout/);

  const alerts = world.alerts.length;
  const deletes = world.deletes.length;
  const timeouts = world.timeouts.length;
  await post(addMember('c10'), { images: [raidA, raidB] });
  await post(addNewMember('d10'), { images: [raidA, raidB], channelId: 'other' });
  assert.equal(world.alerts.length, alerts, 'allowlisted image is skipped');
  assert.equal(world.deletes.length, deletes);
  assert.equal(world.timeouts.length, timeouts);
  assert.ok(world.logs.some((l) => String(l.args[0]).includes('matched the allowlist')));
});

test('11: two moderators click the same button concurrently -> the action runs once', async () => {
  const a = addMember('a11');
  const b = addMember('b11');
  await post(a, { images: [raidA, raidB] });
  await post(b, { images: [raidA, raidB] });
  const incidentId = incidentIdOf(imageAlerts().at(-1)!);

  const [i1, i2] = await Promise.all([
    click('ban', incidentId, 'mod-1'),
    click('ban', incidentId, 'mod-2'),
  ]);
  assert.equal(world.bans.filter((x) => x.userId === 'b11').length, 1);
  assert.equal(i1.edits.length + i2.edits.length, 1, 'one moderator gets the result');
  assert.equal(i1.replies.length + i2.replies.length, 1, 'the other is told it was already actioned');
  assert.match([...i1.replies, ...i2.replies][0], /already actioned/);
});

test('12: learning mode: a single image-only 2-image post from an established account -> low learning alert, no action', async () => {
  await post(addMember('solo'), { images: [raidA, raidB] });
  const alerts = imageAlerts();
  assert.equal(alerts.length, 1);
  assert.equal(tierOf(alerts[0]), 'LOW');
  assert.ok(field(alerts[0], 'Learning mode'), 'alert explains it is a learning-mode hit');
  assert.equal(field(alerts[0], 'Auto-action'), undefined);
  assert.equal(world.deletes.length, 0);
  assert.equal(world.timeouts.length, 0);
  assert.equal(world.bans.length, 0);
});
