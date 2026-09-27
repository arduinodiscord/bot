/**
 * End-to-end simulation of the image-spam automod: the real
 * MessageCreateListener.run (and SpamModerationHandler.run for moderator
 * buttons) driven with fake discord.js objects. Network is stubbed (pHash
 * fetches get real generated PNGs); OCR is off.
 */
import '../test/simEnv';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PermissionFlagsBits, type Message, type ButtonInteraction } from 'discord.js';
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
import { perceptualHashes, __resetPhash } from '../utils/automod/phash';
import { AUTO_ACTION_FIELD } from '../utils/automod/console';
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
  contentIdOf,
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
  __resetPhash();
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
  const action = field(last, AUTO_ACTION_FIELD)!;
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

test('2: identical image with text: 3 accounts -> medium; the 4th -> high, deleting only its own post', async () => {
  const [a, b, c, d] = ['u1', 'u2', 'u3', 'u4'].map((id) => addMember(id));
  await post(a, { images: [diagram], content: QUESTION, channelId: 'c1' });
  await post(b, { images: [diagram], content: 'Same problem here, any ideas how to fix this?', channelId: 'c2' });
  assert.equal(world.deletes.length, 0, 'two accounts sharing an image with text must not auto-act');
  assert.equal(world.timeouts.length, 0);
  assert.equal(tierOf(imageAlerts().at(-1)!), 'MEDIUM');

  await post(c, { images: [diagram], content: 'Has anyone seen this before? It keeps happening', channelId: 'c3' });
  assert.equal(tierOf(imageAlerts().at(-1)!), 'MEDIUM', 'three members sharing a popular image is not a raid');
  assert.equal(world.deletes.length, 0);

  const m4 = await post(d, { images: [diagram], content: 'Same here, my board does this too', channelId: 'c4' });
  const last = imageAlerts().at(-1)!;
  assert.equal(tierOf(last), 'HIGH');
  assert.match(field(last, 'Signal')!, /Same image from 4 accounts/);
  assert.equal(timedOut('u4').length, 1);
  // The others posted with text: their messages are never deleted for it.
  assert.deepEqual(deletedIds(), [m4.id]);
  assert.match(field(last, AUTO_ACTION_FIELD)!, /✅ Timed out/);
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
  assert.equal(field(alerts[0], AUTO_ACTION_FIELD), undefined, 'no auto-action on medium');
  assert.equal(world.deletes.length, 0);
  assert.equal(world.timeouts.length, 0);
  assert.equal(world.bans.length, 0);
});

test('4: new member cross-posts screenshot + text: 2-3 channels -> medium alert only; 4 channels -> high', async () => {
  const n = addNewMember('newbie');
  await post(n, { images: [screenshot], content: QUESTION, channelId: 'ch-a' });
  await post(n, { images: [screenshot], content: QUESTION, channelId: 'ch-b' });

  let last = imageAlerts().at(-1)!;
  assert.equal(tierOf(last), 'MEDIUM');
  assert.match(field(last, 'Signal')!, /several channels/i);
  assert.equal(world.deletes.length, 0, '2 channels must not delete');
  assert.equal(world.timeouts.length, 0, '2 channels must not time out');

  await post(n, { images: [screenshot], content: QUESTION, channelId: 'ch-c' });
  assert.equal(world.deletes.length, 0, '3 channels must not delete');
  assert.equal(world.timeouts.length, 0, '3 channels must not time out');

  await post(n, { images: [screenshot], content: QUESTION, channelId: 'ch-d' });
  last = imageAlerts().at(-1)!;
  assert.equal(tierOf(last), 'HIGH');
  assert.equal(world.deletes.length, 4);
  assert.equal(timedOut('newbie').length, 1);
  assert.match(field(last, AUTO_ACTION_FIELD)!, /✅ Deleted 4\/4/);
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
  await addToBlocklist([contentIdOf(raidA)], [], 'mod', 'test', 'scam');
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
  assert.match(i.edits.at(-1)!, /Confirmed scam\. Banned 2\/2/);
  const bansBefore = world.bans.length;

  const raider = addNewMember('raider');
  const m = await post(raider, { images: [raidA, raidB], channelId: 'offtopic' });
  assert.equal(world.bans.length, bansBefore + 1);
  assert.equal(world.bans.at(-1)!.userId, 'raider');
  assert.ok(deletedIds().includes(m.id));
  const last = imageAlerts().at(-1)!;
  assert.equal(tierOf(last), 'CRITICAL');
  assert.match(alertText(last), /Known spam image/);
  assert.match(field(last, AUTO_ACTION_FIELD)!, /✅ Banned/);
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
  const action = field(imageAlerts().at(-1)!, AUTO_ACTION_FIELD)!;
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
  assert.ok(world.logs.some((l) => String(l.args[0]).includes('marked "Not spam"; skipped')));
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
  assert.match([...i1.replies, ...i2.replies][0], /already been handled/);
});

test('12: learning mode: a single image-only 2-image post from an established account -> low learning alert, no action', async () => {
  await post(addMember('solo'), { images: [raidA, raidB] });
  const alerts = imageAlerts();
  assert.equal(alerts.length, 1);
  assert.equal(tierOf(alerts[0]), 'LOW');
  assert.ok(field(alerts[0], 'Learning mode'), 'alert explains it is a learning-mode hit');
  assert.equal(field(alerts[0], AUTO_ACTION_FIELD), undefined);
  assert.equal(world.deletes.length, 0);
  assert.equal(world.timeouts.length, 0);
  assert.equal(world.bans.length, 0);
});

// ------------------------------------------------------------- security review

test('S1: an image forged to match a confirmed scam image\'s metadata is NOT banned', async () => {
  // Confirm a real scam raid.
  await post(addMember('s1a'), { images: [raidA, raidB] });
  await post(addMember('s1b'), { images: [raidA, raidB] });
  await click('confirmscam', incidentIdOf(imageAlerts().at(-1)!));
  const bans = world.bans.length;

  // An innocent image padded to the scam file's exact type, size and dimensions.
  const forged: SimImage = { ...diagram, bytes: raidA.bytes, width: raidA.width, height: raidA.height };
  await post(addMember('innocent'), { images: [forged], content: QUESTION, channelId: 'help' });
  assert.equal(world.bans.length, bans, 'metadata is not identity: no auto-ban');
  assert.ok(!world.timeouts.some((t) => t.userId === 'innocent'));
});

test('S2: a scam image riding along with an allowlisted image is still checked', async () => {
  // A mod marks the diagram "Not spam".
  await post(addMember('s2a'), { images: [diagram, screenshot] });
  await post(addMember('s2b'), { images: [diagram, screenshot] });
  await click('dismiss', incidentIdOf(imageAlerts().at(-1)!));
  // A confirmed scam image posted together with the allowlisted diagram.
  await addToBlocklist([contentIdOf(raidA)], [], 'mod', 'test', 'scam');
  await post(addNewMember('s2c'), { images: [diagram, raidA], channelId: 'other' });
  assert.ok(world.bans.some((b) => b.userId === 's2c'), 'the scam image is not carried through');
});

test('S3: reposting a member\'s image does not delete their post or get them banned', async () => {
  const alice = addMember('alice');
  const mallory = addNewMember('mallory');
  const a = await post(alice, { images: [diagram], content: QUESTION, channelId: 'help' });
  // Mallory reposts it with @everyone: high for Mallory.
  await post(mallory, { images: [diagram], content: '@everyone look', channelId: 'general' });
  const last = imageAlerts().at(-1)!;
  assert.equal(tierOf(last), 'HIGH');
  assert.ok(!deletedIds().includes(a.id), "Alice's message is left alone");
  assert.ok(timedOut('mallory').length === 1 && timedOut('alice').length === 0);

  await click('confirmscam', incidentIdOf(last));
  assert.ok(world.bans.some((b) => b.userId === 'mallory'));
  assert.ok(!world.bans.some((b) => b.userId === 'alice'), 'a member who posted with text is not bulk-banned');
});

test('S4: a moderator without Ban Members cannot ban through the buttons', async () => {
  await post(addMember('s4a'), { images: [raidA, raidB] });
  await post(addMember('s4b'), { images: [raidA, raidB] });
  const id = incidentIdOf(imageAlerts().at(-1)!);
  const helper = makeButtonInteraction('confirmscam', id, 'helper', [PermissionFlagsBits.ManageMessages]);
  await handler.run(helper as unknown as ButtonInteraction, { action: 'confirmscam', incidentId: id });
  assert.equal(world.bans.length, 0);
  assert.match(helper.replies[0], /Ban Members/);
});

test('S5: a tutorial link, or a URL in a diagram, is not scam evidence', async () => {
  await post(addMember('s5a'), { images: [diagram], content: 'Wiring from https://docs.arduino.cc/tutorials', channelId: 'help-1' });
  await post(addMember('s5b'), { images: [diagram], content: 'I followed https://docs.arduino.cc too', channelId: 'help-2' });
  assert.equal(tierOf(imageAlerts().at(-1)!), 'MEDIUM');
  assert.equal(world.deletes.length + world.timeouts.length, 0);
});
