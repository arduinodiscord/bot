# Arduino Discord Bot

> Now with slash commands!

---

This is the custom Discord bot powering the official Arduino Discord server at [https://arduino.cc/discord](https://arduino.cc/discord).

## What does this bot do?

The Arduino Bot provides helpful information, troubleshooting steps, and community resources for Arduino users. It responds to slash commands with detailed guides, tips, and links, making it easier for users to get help and learn about Arduino topics.

## Current Slash Commands

All commands are used as Discord slash commands (type `/` in Discord):

| Command   | Usage Example              | Description                                                        |
|-----------|---------------------------|--------------------------------------------------------------------|
| `/about`  | `/about`                  | Shows information about the bot.                                   |
| `/ping`   | `/ping`                   | Bot/API latency and uptime.                                       |
| `/tag`    | `/tag name:<tag> [user:@username]` | Sends an informational tag to the bot-commands channel, optionally pinging a user. |
| `/say`    | `/say channel:<#channel> title:<text> description:<text>` | Staff-only (Manage Server): send a custom embed to a channel. Optional `fields` (one `name \| value` per line) and `thumbnail`. |

### `/tag` options (alphabetical)

- `ai` — The server's no-AI policy.
- `ask` — Guidance on how to ask good questions.
- `avrdude` — AVRDUDE error troubleshooting.
- `codeblock` — How to format code in Discord.
- `debounce` — Debouncing bouncy buttons/switches.
- `espcomm` — ESP board communication troubleshooting.
- `help` — How to use the bot and list of tags.
- `hid` — Info about Arduino HID (keyboard/mouse) support.
- `lab` — Recommended electronics lab equipment.
- `language` — What language Arduino uses.
- `levelShifter` — Logic level shifter explanation.
- `libmissing` — Fixing missing library errors.
- `needinfo` — Ask a user for the details needed to help them.
- `ninevolt` — Why 9V batteries are a poor choice.
- `power` — Powering Arduino safely.
- `pullup` — Pull-up/pull-down resistor explanation.
- `reinstall` — How to cleanly reinstall the Arduino IDE.
- `wiki` — Link to the Arduino Discord community wiki.

**Example:**  
`/tag name:power` — Sends information about powering Arduino boards to the bot-commands channel.
`/tag name:avrdude user:@someuser` — Sends AVRDUDE troubleshooting info to the bot-commands channel and pings `@someuser`.

## Image-spam automod

The bot watches for the image-spam pattern that has been slipping past our other
filters: accounts (both freshly-joined and compromised long-time members)
posting **clusters of images** to advertise. It complements YAGPDB rather than
replacing it, and never disables image sharing for the server.

**How it detects spam:**

- **Image burst** — several image messages from one user in a short window
  (default: 3 in 60s; stricter for new members). *Lower confidence → alerts
  moderators only.*
- **Cross-channel fan-out** — the same image posted across multiple channels in
  a short window (default: 2+ channels). This is the strongest signal and catches
  compromised veterans, where account age is useless. *High confidence.*
- **Known-spam blocklist** — once a moderator confirms an alert, that image's
  fingerprints are blocklisted so repeat campaigns are caught instantly. *High
  confidence.*

Each image gets two fingerprints: a cheap, download-free **metadata signature**
(content type + size + dimensions) that catches byte-identical re-uploads, and a
**perceptual hash** (dHash, computed from a tiny media-proxy thumbnail) that
catches re-encoded or resized copies via Hamming-distance matching. New members
(joined within the last 72h by default) are held to a stricter burst threshold.

**Tiered response:** high-confidence hits auto-delete the messages and timeout
the user, then post an alert; bursts only post an alert. Every alert lands in the
mod-log channel with action buttons — **Confirm spam / Timeout / Ban / Delete
msgs / Not spam** — so a human stays in the loop. Members with Manage Messages
(or a configured immune role) are never inspected.

**Required bot permissions:** Manage Messages (delete), Moderate Members
(timeout), Ban Members (ban), plus the **Message Content** privileged intent
(already enabled in `index.ts`). Set `MOD_LOG_CHANNEL_ID` to enable the console;
leaving it unset disables the automod entirely.

## Server management

These ambient features were ported from the legacy bot and modernized. Each
**self-disables** until its channel/role id is configured (see
[`.env.example`](.env.example)):

- **Auto-crosspost** — automatically publishes messages in configured
  announcement channels and logs the result (`CROSSPOST_CHANNEL_IDS`).
- **Join/leave logging** — posts member join (with invite-source attribution)
  and leave embeds to a log channel, and records best-effort join/leave
  analytics when a database is configured (`JOIN_LEAVE_LOG_CHANNEL_ID`).
- **Role-select buttons** — buttons on a configured message let members toggle
  the event / server-update opt-in roles (`ROLE_SELECT_MESSAGE_ID`).
- **Message-link flattening** — when someone posts a link to another message in
  the server, the bot quotes that message inline for context.

> The legacy file-extension attachment filter and `maintenance` mode were
> intentionally dropped in favour of Discord-native AutoMod and modern
> redeploy/hosting workflows.

## Environment Variables & Configuration

This bot requires the following environment variables to be set:

-   `BOT_TOKEN`: Your Discord bot token.
-   `MOD_LOG_CHANNEL_ID`: Channel for image-spam alerts. Required to enable the
    automod; leave unset to disable it.

Optional:

-   `DATABASE_URL`: Postgres connection string. Without it the bot runs fully
    in-memory and the spam-image blocklist resets on restart.
-   Automod thresholds (`AUTOMOD_BURST_THRESHOLD`, `AUTOMOD_FANOUT_CHANNELS`,
    `AUTOMOD_IMMUNE_ROLE_IDS`, …) — see [`.env.example`](.env.example).

> Additional configuration options can be set in `config.ts`.

### Running with Docker

A [`docker-compose.yml`](docker-compose.yml) bundles the bot with a Postgres
instance for blocklist persistence:

```bash
cp .env.example .env   # fill in BOT_TOKEN and MOD_LOG_CHANNEL_ID
docker compose up -d   # applies DB migrations, then starts the bot
```


## Contributing

Want to add a new tag or feature? It’s easy!

1. **Clone the repo** and create a new branch.
2. **Add your tag:**  
   - Edit [`src/utils/tags.ts`](src/utils/tags.ts) and add your tag object to the exported object.
   - If adding a new command, create a new file in [`src/commands/`](src/commands/).
3. **Register your tag:**  
   - For `/tag`, add your tag to the `.addChoices()` list in [`src/commands/tag.ts`](src/commands/tag.ts).
4. **Test your changes** locally.
5. **Make a Pull Request:**  
   - Push your branch and open a PR on GitHub.  
   - Clearly describe your changes.

If you find a bug or want to request a feature, please [open an issue](https://github.com/max-bromberg/arduino-bot/issues).

---
06-13-2025 Update
**License:** GPL-3.0-or-later  
See [LICENSE](LICENSE) for details.
