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
| `/tag`    | `/tag name:<tag> [user:@username]` | Sends an informational tag to the bot-commands channel, optionally pinging a user. |

### `/tag` options (alphabetical)

- `ask` — Guidance on how to ask good questions.
- `avrdude` — AVRDUDE error troubleshooting.
- `codeblock` — How to format code in Discord.
- `espcomm` — ESP board communication troubleshooting.
- `hid` — Info about Arduino HID (keyboard/mouse) support.
- `language` — What language Arduino uses.
- `levelShifter` — Logic level shifter explanation.
- `libmissing` — Fixing missing library errors.
- `power` — Powering Arduino safely.
- `pullup` — Pull-up/pull-down resistor explanation.
- `wiki` — Link to the Arduino Discord community wiki.

**Example:**  
`/tag name:power` — Sends information about powering Arduino boards to the bot-commands channel.
`/tag name:avrdude user:@someuser` — Sends AVRDUDE troubleshooting info to the bot-commands channel and pings `@someuser`.

## Image-spam automod

The bot watches for the image-spam pattern that has been slipping past our other
filters: accounts (both freshly-joined and compromised long-time members)
posting **clusters of images** to advertise. It complements YAGPDB rather than
replacing it, and never disables image sharing for the server.

**How it detects spam (no images are downloaded — it uses Discord's attachment
metadata only):**

- **Image burst** — several image messages from one user in a short window
  (default: 3 in 60s). *Lower confidence → alerts moderators only.*
- **Cross-channel fan-out** — the same image posted across multiple channels in
  a short window (default: 2+ channels). This is the strongest signal and catches
  compromised veterans, where account age is useless. *High confidence.*
- **Known-spam blocklist** — once a moderator confirms an alert, that image's
  fingerprint is blocklisted so repeat campaigns are caught instantly. *High
  confidence.*

**Tiered response:** high-confidence hits auto-delete the messages and timeout
the user, then post an alert; bursts only post an alert. Every alert lands in the
mod-log channel with action buttons — **Confirm spam / Timeout / Ban / Delete
msgs / Not spam** — so a human stays in the loop. Members with Manage Messages
(or a configured immune role) are never inspected.

**Required bot permissions:** Manage Messages (delete), Moderate Members
(timeout), Ban Members (ban), plus the **Message Content** privileged intent
(already enabled in `index.ts`). Set `MOD_LOG_CHANNEL_ID` to enable the console;
leaving it unset disables the automod entirely.

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
