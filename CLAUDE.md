# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # hot-reloading dev server (ts-node-dev, transpile-only)
npm run build      # TypeScript compile to dist/
npm start          # run compiled output

# Docker (bot + Postgres, migrations auto-applied)
docker compose up -d
docker compose down
```

There is no test suite. Type-check via `npm run build`.

To add a new slash command, register it in `src/commands/` following the Sapphire `Command` pattern.

PRs target the `staging` branch (not `main`).

## Commits

Format: `action: description` (e.g. `feat: add debounce tag`, `fix: stale sweep not resetting on reply`, `refactor: unify suggestion engine`).

Always commit with Max as primary author and Claude as co-author:
```
Co-Authored-By: Claude <noreply@anthropic.com>
```

## Architecture

**Framework:** [Sapphire](https://www.sapphirejs.dev) on top of discord.js v14. Sapphire auto-discovers and registers files from:
- `src/commands/` — slash commands
- `src/listeners/` — Discord gateway event handlers
- `src/interaction-handlers/` — button/select-menu interaction handlers

**Entry point:** `src/index.ts` — creates the `SapphireClient` with the required gateway intents and calls `client.login()`.

**Configuration:** `src/utils/config.ts` is the single source of truth for all env vars. Every feature self-disables when its channel/role ID env var is unset. Automod thresholds all have sensible defaults overridable via `AUTOMOD_*` env vars. Only `BOT_TOKEN` is required.

**Database:** Optional Postgres via Prisma 7 with the `@prisma/adapter-pg` driver adapter. `src/utils/db.ts` exports a Prisma client (or `null` when `DATABASE_URL` is unset). Automod runs fully in-memory without a DB; only the spam-image blocklist and analytics/audit tables require persistence. Schema: `prisma/schema.prisma`.

**Automod pipeline** (`src/utils/automod/`):
- `signature.ts` — cheap metadata fingerprint per image attachment
- `phash.ts` — perceptual hash (dHash) via Jimp for near-duplicate matching
- `tracker.ts` — in-memory sliding-window state for burst and cross-channel fan-out detection
- `flood.ts` — short-message flood detector
- `crosspost.ts` — cross-channel question-spam detector (Jaccard similarity + new-member spread)
- `blocklist.ts` — confirmed-spam fingerprint store (in-memory + DB)
- `incidents.ts` — creates `Incident` objects passed to the console
- `console.ts` — builds moderator alert embeds with action buttons (Confirm / Timeout / Ban / Delete / Not spam)

The whole pipeline is triggered in `src/listeners/messageCreate.ts`. The three detectors (image, flood, crosspost) run independently on each message.

**Tags** (`src/utils/tags.ts`): A `Record<string, Tag>` map. Each entry has optional `embeds`, `components`, `content` (string or `(user?) => string`), `botCommandsOnly`, and `suggest` (a `{ pattern: RegExp, prompt: string }` for keyword auto-suggestion). To add a tag: add it to `tags.ts` and add a choice in `src/commands/tag.ts`.

**Help-channel workflow:** Configured via `HELP_CHANNEL_IDS` (forum or text channels). New help threads get a "Mark Solved" button (`src/listeners/threadCreate.ts`), auto-needinfo if thin (`src/utils/helpPosts.ts`), and are tracked by the stale-post sweep (`src/utils/staleHelpSweep.ts`). The `/solved` command and `solvedButton` interaction handler close threads and update tags.

## `revamp` branch — work in progress

All active development is on `revamp`. The branch adds substantial new features on top of the automod core that was ported/built on `main`.

**Automod additions (revamp):**
- Text-flooding detector (`automod/flood.ts`) — flags N short messages from one user in a sliding window; alerts only by default, `AUTOMOD_FLOOD_AUTO_TIMEOUT=true` to also time out.
- Cross-channel question-spam detector (`automod/crosspost.ts`) — two signals: near-identical fan-out (Jaccard similarity ≥ threshold, any tenure) auto-deletes duplicates and alerts; new-member spread (posting substantively in many channels even when reworded) alerts only.

**Helper-assist suite (revamp, built in three phases):**

*Phase 1* — reduces repetitive load on community helpers:
- Keyword → tag auto-suggest (`src/listeners/tagSuggest.ts`): tag entries each carry a `suggest: { pattern, prompt }` field; the listener matches incoming messages and offers a one-click tag button with a per-user cooldown. Toggle: `TAG_SUGGEST_ENABLED`.
- "Request more info" message context-menu (`src/commands/requestInfo.ts`): right-click any message to post the `needinfo` checklist to the asker in one click.
- Solve workflow: `/solved [helper]` command + "Mark Solved" button on new help threads. Shared logic in `src/utils/solveThread.ts` titles the thread with a checkmark, credits the helper, and archives. OP or staff only.

*Phase 2* — broader coverage and close-the-loop on help posts:
- Tag `suggest` triggers co-located in `tags.ts` (moved out of `tagSuggest.ts`) — adding a suggestible tag is now a one-place change.
- Unformatted-code nudge: detects plain-text code pastes and offers the `codeblock` tag. Toggle: `CODE_FORMAT_SUGGEST_ENABLED`.
- "Just ask" nudge: conservative patterns catch "can I ask?" / "anyone here?" and reply with the `ask` tag. Toggle: `ASK_SUGGEST_ENABLED`.
- Auto-needinfo on thin posts: new help thread with short content and no code/image gets the `needinfo` checklist automatically. Toggle: `HELP_AUTO_NEEDINFO`, threshold: `HELP_NEEDINFO_MIN_CHARS`.
- Stale-post sweep (`src/utils/staleHelpSweep.ts`): nudges open posts idle past `HELP_STALE_NUDGE_HOURS` (default 72h), then auto-archives if no human replies within a further `HELP_STALE_ARCHIVE_HOURS` (default 168h). Runs on an unref'd interval started in the `ready` listener.
- `/openposts` command (`src/commands/openPosts.ts`): ephemeral digest of open help posts, oldest-waiting first. Backed by `src/utils/helpPosts.ts` (shared with the sweep).

*Phase 3 (timing refinement)* — lengthened stale-post defaults (24h→72h nudge, 72h→168h archive) and generalised help-channel support: `HELP_CHANNEL_IDS` accepts both forum channels and regular text channels; threads inside either get the same lifecycle. Legacy `HELP_FORUM_CHANNEL_IDS` still works and is merged in.
