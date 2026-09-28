/**
 * Fake discord.js-shaped world for driving the real automod listener and
 * moderation-button handler end to end. Only the surface those code paths
 * touch is implemented; every side effect (delete, timeout, ban, mod-log post)
 * is recorded so tests can assert outcomes.
 *
 * Import `./simEnv` before this module (and before anything importing config).
 */
import { SIM_GUILD_ID, SIM_MOD_LOG_ID } from './simEnv';
import { container } from '@sapphire/framework';
import { Collection, PermissionFlagsBits, type MessageCreateOptions } from 'discord.js';
import { createHash } from 'node:crypto';
import { Jimp } from 'jimp';
import { markAutomodReady } from '../utils/automod/state';
import { __resetDeletes } from '../utils/automod/console';

const DAY = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------- recording

export interface LogCall {
  level: string;
  args: unknown[];
}

export interface World {
  guild: FakeGuild;
  deletes: { channelId: string; messageId: string }[];
  timeouts: { userId: string; duration: number | null; reason?: string }[];
  bans: { userId: string; reason?: string }[];
  alerts: MessageCreateOptions[];
  logs: LogCall[];
  /** Make the next mod-log send() calls throw. */
  failModLog: boolean;
  members: Map<string, FakeMember>;
}

export let world: World;

// ---------------------------------------------------------------- members

export interface FakeMember {
  id: string;
  user: { id: string; tag: string; bot: boolean; createdAt: Date };
  joinedTimestamp: number;
  joinedAt: Date;
  moderatable: boolean;
  bannable: boolean;
  permissions: { has(flag: bigint): boolean };
  roles: { cache: { has(id: string): boolean } };
  displayAvatarURL(): string;
  timeout(duration: number | null, reason?: string): Promise<unknown>;
}

export interface MemberOptions {
  /** Days since joining the server (default 400: an established member). */
  joinedDaysAgo?: number;
  staff?: boolean;
  moderatable?: boolean;
  bannable?: boolean;
}

export function addMember(id: string, opts: MemberOptions = {}): FakeMember {
  const joined = Date.now() - (opts.joinedDaysAgo ?? 400) * DAY;
  const member: FakeMember = {
    id,
    user: { id, tag: `${id}#0`, bot: false, createdAt: new Date(joined - 30 * DAY) },
    joinedTimestamp: joined,
    joinedAt: new Date(joined),
    moderatable: opts.moderatable ?? true,
    bannable: opts.bannable ?? true,
    permissions: {
      has: (flag: bigint) => Boolean(opts.staff) && flag === PermissionFlagsBits.ManageMessages,
    },
    roles: { cache: { has: () => false } },
    displayAvatarURL: () => `https://cdn.discordapp.com/embed/avatars/0.png`,
    timeout: async (duration, reason) => {
      world.timeouts.push({ userId: id, duration, reason });
    },
  };
  world.members.set(id, member);
  return member;
}

/** A member who joined an hour ago (inside the 72h new-member window). */
export const addNewMember = (id: string, opts: MemberOptions = {}) =>
  addMember(id, { ...opts, joinedDaysAgo: 1 / 24 });

// ---------------------------------------------------------------- guild

export interface FakeGuild {
  id: string;
  members: {
    fetch(id: string): Promise<FakeMember>;
    ban(id: string, opts?: { reason?: string }): Promise<unknown>;
  };
}

function makeGuild(): FakeGuild {
  return {
    id: SIM_GUILD_ID,
    members: {
      fetch: async (id: string) => {
        const m = world.members.get(id);
        if (!m) throw Object.assign(new Error('Unknown Member'), { code: 10007 });
        return m;
      },
      ban: async (id: string, opts?: { reason?: string }) => {
        world.bans.push({ userId: id, reason: opts?.reason });
      },
    },
  };
}

// ---------------------------------------------------------------- channels

const deleted = new Set<string>();

function textChannel(channelId: string) {
  return {
    id: channelId,
    isTextBased: () => true,
    isDMBased: () => false,
    isSendable: () => true,
    messages: {
      delete: async (messageId: string) => {
        // A second delete of the same message is Discord's "Unknown Message".
        if (deleted.has(messageId))
          throw Object.assign(new Error('Unknown Message'), { code: 10008 });
        deleted.add(messageId);
        world.deletes.push({ channelId, messageId });
      },
    },
  };
}

function modLogChannel() {
  return {
    ...textChannel(SIM_MOD_LOG_ID),
    send: async (payload: MessageCreateOptions) => {
      if (world.failModLog) throw new Error('Missing Permissions');
      world.alerts.push(payload);
      return { id: `alert-${world.alerts.length}` };
    },
  };
}

// ---------------------------------------------------------------- images

const rgba = (r: number, g: number, b: number) =>
  ((r << 24) | (g << 16) | (b << 8) | 255) >>> 0;

function rng(seed: number) {
  let s = seed >>> 0;
  return (lo: number, hi: number) => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return lo + (s % (hi - lo));
  };
}

/** Screenshot-like PNG (flat background + blocks), deterministic per seed. */
async function screenshotPng(seed: number): Promise<Buffer> {
  const r = rng(seed);
  const W = 160;
  const H = 120;
  const bg = r(200, 256);
  const img = new Jimp({ width: W, height: H, color: rgba(bg, bg, bg) });
  const blocks = r(8, 20);
  for (let i = 0; i < blocks; i++) {
    const x = r(0, W - 20);
    const y = r(0, H - 8);
    const w = Math.min(r(10, 90), W - x);
    const h = Math.min(r(4, 25), H - y);
    const c = r(0, 256);
    for (let py = y; py < y + h; py++)
      for (let px = x; px < x + w; px++) img.setPixelColor(rgba(c, (c + 60) % 256, c), px, py);
  }
  return img.getBuffer('image/png');
}

const imageBytes = new Map<string, Buffer>();

export interface SimImage {
  key: string;
  bytes: number;
  width: number;
  height: number;
}

/**
 * A distinct image. The same SimImage attached to several messages is "the
 * same file re-uploaded": identical metadata signature and pixels, but a
 * fresh CDN URL per upload, as on Discord.
 */
export async function makeImage(seed: number): Promise<SimImage> {
  const key = `img${seed}`;
  const png = await screenshotPng(seed);
  imageBytes.set(key, png);
  return { key, bytes: png.length, width: 160, height: 120 };
}

/** The content id the bot will compute for an image (SHA-256 of served bytes). */
export const contentIdOf = (img: SimImage): string =>
  createHash('sha256').update(imageBytes.get(img.key)!).digest('hex');

let fetchCount = 0;
/** Number of image fetches served (pHash). */
export const imageFetches = () => fetchCount;

function installFetch(): void {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const key = /\/(img\d+)\.png/.exec(url)?.[1];
    const png = key ? imageBytes.get(key) : undefined;
    if (!png) return new Response('not found', { status: 404 });
    fetchCount++;
    return new Response(new Uint8Array(png), {
      status: 200,
      headers: { 'content-type': 'image/png', 'content-length': String(png.length) },
    });
  }) as typeof fetch;
}

// ---------------------------------------------------------------- messages

let seq = 0;

export interface PostOptions {
  channelId?: string;
  content?: string;
  images?: SimImage[];
}

/** Build a guild message from `member` shaped like discord.js's Message. */
export function makeMessage(member: FakeMember, opts: PostOptions = {}) {
  const channelId = opts.channelId ?? 'general';
  const id = `msg-${++seq}`;
  const attachments = new Collection<string, unknown>();
  for (const img of opts.images ?? []) {
    const attId = `att-${++seq}`;
    const url = `https://media.discordapp.net/attachments/${channelId}/${attId}/${img.key}.png`;
    attachments.set(attId, {
      id: attId,
      name: `${img.key}.png`,
      contentType: 'image/png',
      size: img.bytes,
      width: img.width,
      height: img.height,
      url: url.replace('media.discordapp.net', 'cdn.discordapp.com'),
      proxyURL: url,
    });
  }
  return {
    id,
    channelId,
    guildId: SIM_GUILD_ID,
    guild: world.guild,
    member,
    author: member.user,
    content: opts.content ?? '',
    attachments,
    mentions: { everyone: false },
    inGuild: () => true,
  };
}

// ---------------------------------------------------------------- world

const logger = {
  has: () => true,
  trace: (...args: unknown[]) => world.logs.push({ level: 'trace', args }),
  debug: (...args: unknown[]) => world.logs.push({ level: 'debug', args }),
  info: (...args: unknown[]) => world.logs.push({ level: 'info', args }),
  warn: (...args: unknown[]) => world.logs.push({ level: 'warn', args }),
  error: (...args: unknown[]) => world.logs.push({ level: 'error', args }),
  fatal: (...args: unknown[]) => world.logs.push({ level: 'fatal', args }),
  write: (...args: unknown[]) => world.logs.push({ level: 'write', args }),
};

/** Fresh world: new guild/members/recorders, fresh Sapphire container fakes. */
export function resetWorld(): World {
  deleted.clear();
  __resetDeletes();
  markAutomodReady(true);
  world = {
    guild: makeGuild(),
    deletes: [],
    timeouts: [],
    bans: [],
    alerts: [],
    logs: [],
    failModLog: false,
    members: new Map(),
  };
  const client = {
    channels: {
      fetch: async (id: string) => (id === SIM_MOD_LOG_ID ? modLogChannel() : textChannel(id)),
    },
  };
  const c = container as unknown as Record<string, unknown>;
  c.client = client;
  c.logger = logger;
  installFetch();
  return world;
}

// ---------------------------------------------------------------- alert inspection

interface EmbedJSON {
  title?: string;
  fields?: { name: string; value: string }[];
}

export function embedOf(payload: MessageCreateOptions): EmbedJSON {
  const e = payload.embeds?.[0] as { toJSON?: () => EmbedJSON } | EmbedJSON | undefined;
  if (!e) return {};
  return 'toJSON' in e && typeof e.toJSON === 'function' ? e.toJSON() : (e as EmbedJSON);
}

export const alertText = (payload: MessageCreateOptions): string =>
  JSON.stringify(embedOf(payload));

export const field = (payload: MessageCreateOptions, name: string): string | undefined =>
  embedOf(payload).fields?.find((f) => f.name.includes(name))?.value;

/** Image-automod alerts only (flood/crosspost alerts have other titles). */
export const imageAlerts = () =>
  world.alerts.filter((a) => embedOf(a).title === 'Possible image spam');

/** "HIGH", "MEDIUM", ... from the Confidence field. */
export const tierOf = (payload: MessageCreateOptions) =>
  field(payload, 'Confidence')?.split(' ')[0];

/** Incident id carried on the alert's moderation buttons. */
export function incidentIdOf(payload: MessageCreateOptions): string {
  const row = payload.components?.[0] as { toJSON?: () => { components: { custom_id: string }[] } };
  const json = row.toJSON ? row.toJSON() : (row as unknown as { components: { custom_id: string }[] });
  return json.components[0].custom_id.split(':')[2];
}

// ---------------------------------------------------------------- moderator buttons

export interface FakeInteraction {
  customId: string;
  replies: string[];
  edits: string[];
}

/** Permissions a moderator clicking a button has. Default: full moderator. */
const FULL_MOD = [
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.ModerateMembers,
  PermissionFlagsBits.BanMembers,
];

export function makeButtonInteraction(
  action: string,
  incidentId: string,
  modId = 'mod-1',
  perms: bigint[] = FULL_MOD
) {
  const interaction = {
    customId: `automod:${action}:${incidentId}`,
    memberPermissions: {
      has: (flag: bigint | bigint[]) =>
        (Array.isArray(flag) ? flag : [flag]).every((f) => perms.includes(f)),
    },
    guild: world.guild,
    guildId: SIM_GUILD_ID,
    channelId: SIM_MOD_LOG_ID,
    user: { id: modId, tag: `${modId}#0` },
    deferred: false,
    replied: false,
    replies: [] as string[],
    edits: [] as string[],
    message: { components: [], embeds: [], edit: async () => null },
    async deferReply() {
      interaction.deferred = true;
    },
    async reply(opts: { content: string }) {
      interaction.replied = true;
      interaction.replies.push(opts.content);
    },
    async editReply(opts: { content: string }) {
      interaction.edits.push(opts.content);
    },
  };
  return interaction;
}
