<div align="center">

# 🤖 Arduino Discord Bot

### The community bot powering the official **[Arduino Discord](https://arduino.cc/discord)**

Helpful tags, image-spam moderation, and server automation — built for the people who keep the server running.

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![discord.js](https://img.shields.io/badge/discord.js-14-5865F2?logo=discord&logoColor=white)](https://discord.js.org)
[![Sapphire](https://img.shields.io/badge/framework-Sapphire-1e88e5)](https://www.sapphirejs.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Node](https://img.shields.io/badge/Node-LTS-339933?logo=node.js&logoColor=white)](https://nodejs.org)

</div>

---

## ✨ Highlights

| | |
|---|---|
| 🏷️ **Slash-command tags** | Curated troubleshooting guides (`/tag`) — AVRDUDE errors, level shifters, powering boards, and more |
| 🛡️ **Image-spam automod** | Catches the image-cluster spam wave with burst + cross-channel fan-out + perceptual-hash detection, and a one-click moderator console |
| 🧰 **Server automation** | Auto-crosspost, join/leave + invite-source logging, role-select buttons, message-link quoting |
| 🗣️ **Staff tooling** | `/say` to broadcast rich embeds as the bot |
| 🐳 **One-command deploy** | `docker compose up` — bot + Postgres, migrations applied automatically |

---

## 🚀 Quick start

### With Docker (recommended)

```bash
git clone https://github.com/arduinodiscord/bot.git
cd bot
cp .env.example .env          # add your BOT_TOKEN (+ any feature channel IDs)
docker compose up -d          # builds the bot, starts Postgres, applies migrations
```

That's it — the bot connects, registers its slash commands, and is ready.

### Local development

```bash
npm install
cp .env.example .env          # set BOT_TOKEN
npm run dev                   # hot-reloading dev server (ts-node-dev)
```

> **Privileged intents:** enable **Message Content** and **Server Members** for
> your application in the [Discord Developer Portal](https://discord.com/developers/applications).
> For invite-source logging the bot also needs the **Manage Server** permission.

---

## ⚙️ Configuration

Everything is driven by environment variables (see [`.env.example`](.env.example)).
Only `BOT_TOKEN` is required; **every other feature self-disables** until you
give it a channel or role id, so you can adopt them one at a time.

| Variable | Purpose |
|---|---|
| `BOT_TOKEN` | **Required.** Your Discord bot token |
| `MOD_LOG_CHANNEL_ID` | Enables the image-spam automod console |
| `DATABASE_URL` | Postgres connection (optional — runs in-memory without it; wired automatically by Docker) |
| `JOIN_LEAVE_LOG_CHANNEL_ID` | Member join/leave + invite-source logging |
| `CROSSPOST_CHANNEL_IDS` · `CROSSPOST_LOG_CHANNEL_ID` | Auto-publish announcement channels |
| `ROLE_SELECT_MESSAGE_ID` · `EVENT_NOTIFS_ROLE_ID` · `SERVER_UPDATE_NOTIFS_ROLE_ID` | Button-based opt-in roles |
| `AUTOMOD_*` | Detector thresholds & timeouts (sensible defaults; see `.env.example`) |

---

## 💬 Commands

All commands are Discord **slash commands** — type `/` in the server.

| Command | Description |
|---|---|
| `/tag name:<tag> [user:@user]` | Post a curated troubleshooting guide, optionally pinging someone |
| `/solved [helper:@user]` | Mark the current help post solved (and thank a helper); closes the thread |
| `/openposts` | List open help posts waiting for an answer, oldest first (ephemeral) |
| `/about` | Bot, Node, and version info |
| `/ping` | Latency & uptime |
| `/say channel:<#ch> title:… description:…` | **Staff only** — send a custom embed (optional `fields` as `name \| value` per line, and `thumbnail`) |

Plus a **"Request more info"** right-click (message context-menu) action that
posts the `needinfo` checklist to an asker in one click.

<details>
<summary><strong>📚 Available <code>/tag</code> topics</strong></summary>

`ai` · `ask` · `avrdude` · `codeblock` · `debounce` · `espcomm` · `help` ·
`hid` · `lab` · `language` · `levelShifter` · `libmissing` · `needinfo` ·
`ninevolt` · `power` · `pullup` · `reinstall` · `wiki`

</details>

---

## 🛡️ Image-spam automod

A wave of spam — both freshly-joined accounts and **compromised long-time
members** — posts *clusters of images* to advertise. This bot targets exactly
that pattern without ever disabling image sharing server-wide.

**Detection**
- **Burst** — several image messages from one user in a short window (stricter for new members) → *alerts mods*.
- **Cross-channel fan-out** — the same image across multiple channels → *high confidence* (this is what catches compromised veterans, where account age tells you nothing).
- **Known-spam blocklist** — once a mod confirms an alert, that image is fingerprinted and future copies are caught instantly.

Each image gets a cheap **metadata signature** (catches identical re-uploads)
*and* a **perceptual hash** (dHash from a tiny thumbnail — catches re-encoded /
resized copies via Hamming distance).

**Response (tiered):** high-confidence hits auto-delete + timeout and then
alert; bursts only alert. Every alert lands in the mod-log channel with
**Confirm / Timeout / Ban / Delete / Not spam** buttons — a human stays in the
loop. Members with *Manage Messages* (or a configured immune role) are never
inspected.

> Complements your existing YAGPDB AutoMod rather than replacing them.

---

## 🌊 Text-flooding automod

Some users fragment a single thought across a stream of one-word messages
instead of sending it as one message — which buries ongoing conversation and
leaves no room to reply. The bot flags this pattern: **N short messages from
one user inside a short window** (`AUTOMOD_FLOOD_*`, defaults: 5 messages ≤ 25
chars in 15 s) lands a **Message flooding** alert in the same mod-log console as
the image automod, with the same Confirm / Timeout / Ban / Delete / Not-spam
buttons. By default it only alerts (flooding is usually a habit, not an attack);
set `AUTOMOD_FLOOD_AUTO_TIMEOUT=true` to also time the user out automatically.
Members with *Manage Messages* (or a configured immune role) are never flagged.

---

## 📡 Cross-channel question-spam automod

New members often fire the *same* question into every channel at once instead
of the one that fits. Two tenure-aware signals catch this (`AUTOMOD_CROSSPOST_*`):

- **Near-identical fan-out** (any tenure) — the same question (token-overlap ≥
  `SIMILARITY_PCT`, default 80%) across `CHANNELS`+ channels (default 2) inside
  the window. High confidence, so the bot **auto-deletes the duplicate copies,
  keeping the first**, then alerts.
- **New-member spread** (recent joiners only) — posting substantive messages in
  `SPREAD_CHANNELS`+ channels (default 3) at once, even when reworded enough to
  dodge the similarity check. Alerts only — these aren't strict duplicates.

Both surface in the same mod-log console with the usual action buttons, reuse
the existing new-member window, and respect the immune-role/permission checks.
Short greetings and reactions (below `MIN_CHARS`) are ignored.

---

## 🧰 Server management

Ambient helpers, each self-disabling until configured:

- **Auto-crosspost** announcement channels, with logging.
- **Join/leave logging** with invite-source attribution (+ optional analytics when a DB is present).
- **Role-select buttons** to toggle event / server-update opt-in roles.
- **Message-link flattening** — quote a linked message inline for context.

---

## 🙌 Helper assist

Features aimed at taking repetitive load off the community members who answer
the most questions:

- **Keyword → tag suggestions** — when a message matches a known signature
  (AVRDUDE, missing-library, ESP upload, level shifters, power, pull-ups, 9V,
  HID, debounce…), the bot offers the matching tag via a single button, so
  askers self-serve before a helper repeats a canned answer. Each trigger lives
  next to its tag in `tags.ts`. Per-user cooldown; toggle with `TAG_SUGGEST_ENABLED`.
- **Unformatted-code nudge** — detects code pasted as plain text and offers the
  `codeblock` tag, the single most-repeated ask. Toggle `CODE_FORMAT_SUGGEST_ENABLED`.
- **"Just ask" nudge** — replies to low-effort pings ("can I ask?", "anyone
  here?") with the `ask` tag. Conservative patterns; toggle `ASK_SUGGEST_ENABLED`.
- **"Request more info" context-menu** — right-click any message → *Request more
  info* to post the `needinfo` checklist to the asker in one click.
- **Auto-needinfo on thin posts** — a new help thread with no code, image, or
  detail auto-gets the `needinfo` checklist (`HELP_AUTO_NEEDINFO`).
- **Solve workflow** — a **Mark Solved** button on new help threads (set
  `HELP_CHANNEL_IDS`) plus `/solved [helper:@user]`, which closes the post and
  credits whoever helped.
- **Stale-post nudge & auto-archive** — abandoned help posts get a "still need
  help?" nudge after a few days, then auto-archive only if no one replies for a
  while longer (defaults 3 then 7 days — helpers often take a while; tune with
  `HELP_STALE_NUDGE_HOURS` / `HELP_STALE_ARCHIVE_HOURS`).
- **`/openposts`** — an ephemeral digest of open help posts, oldest-waiting
  first, so helpers can pick up whatever's been waiting longest.

> **Help channels can be forum *or* text channels.** List both kinds in
> `HELP_CHANNEL_IDS` — forum posts and threads opened inside text help channels
> get the same Mark-Solved / needinfo / stale-sweep / `/openposts` treatment.
> The keyword/code/ask suggestions and *Request more info* work server-wide
> regardless of channel type. (Plain, thread-less messages in a text channel
> can't be archived, so the thread lifecycle simply doesn't apply to them.)

## 🏗️ Project structure

```
src/
├── index.ts                 # client bootstrap (intents, presence, login)
├── commands/                # slash commands (about, ping, tag, say, solved, openposts)
├── listeners/               # gateway events (ready, messages, members, invites…)
├── interaction-handlers/    # button handlers (spam console, role-select, tag buttons)
└── utils/
    ├── automod/             # spam detection: tracker, flood, crosspost, phash, blocklist, console, incidents
    ├── config.ts            # env-driven configuration
    ├── db.ts                # optional Prisma (pg driver adapter) with in-memory fallback
    ├── tags.ts              # tag content + schema
    └── embed.ts             # shared base embed
prisma/                      # schema + migrations
```

**Stack:** [discord.js v14](https://discord.js.org) · [Sapphire framework](https://www.sapphirejs.dev) · TypeScript 6 · Prisma 7 (+ Postgres, optional).

---

## 🤝 Contributing

Want to add a tag or a feature? PRs welcome!

1. Fork & branch.
2. **Add a tag:** edit [`src/utils/tags.ts`](src/utils/tags.ts) and add it to the `.addChoices()` list in [`src/commands/tag.ts`](src/commands/tag.ts).
3. `npm run build` to type-check.
4. Open a PR against `staging` with a clear description.

Found a bug or have an idea? [Open an issue](https://github.com/arduinodiscord/bot/issues).

---

<div align="center">

**License:** [GPL-3.0-or-later](LICENSE) · Made with ❤️ by the Arduino Discord community

</div>
