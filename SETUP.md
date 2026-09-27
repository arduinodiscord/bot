# Setup Guide

Step-by-step deployment on a Dockge server.

---

## 1. Create the Discord application

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications) → **New Application**.
2. Name it (e.g. *Arduino Bot*) → **Create**.
3. In the left sidebar → **Bot**:
   - Click **Reset Token** → copy it. This is your `BOT_TOKEN`. Keep it secret.
   - Under **Privileged Gateway Intents**, enable **only** these two:
     - **Server Members Intent** (required for join/leave logging and new-member detection)
     - **Message Content Intent** (required for tag suggestions, automod, and help-post detection)
   - Leave **Presence Intent** off — the bot does not use it.
4. In the left sidebar → **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot permissions:
     - `View Channels`, `Read Message History`
     - `Send Messages`, `Send Messages in Threads`, `Embed Links`
     - `Manage Messages` (automod deletes, crosspost publishing)
     - `Manage Threads` (solve / stale-post archiving)
     - `Moderate Members` (automod timeouts), `Ban Members` (console ban button)
     - `Manage Server` (reading invites for join-source tracking with `JOIN_LEAVE_LOG_CHANNEL_ID`)
   - Copy the generated URL, paste it in a browser, and invite the bot to your server.
   - Drag the bot's role **above** the member roles it must be able to time out or ban.

---

## 2. Collect your Discord IDs

Enable Developer Mode: **User Settings → Advanced → Developer Mode**. You can then right-click any server, channel, role, or message to **Copy ID**.

Gather the IDs you need for the features you want to use:

| What to copy | Used for |
|---|---|
| Server (guild) ID | `SERVER_ID` |
| Bot commands channel | `BOT_COMMANDS_CHANNEL_ID` |
| Mod-log channel | `MOD_LOG_CHANNEL_ID` (enables automod console) |
| Help channel(s) | `HELP_CHANNEL_IDS` (comma-separated; forum or text) |
| Join/leave log channel | `JOIN_LEAVE_LOG_CHANNEL_ID` |
| Announcement channels | `CROSSPOST_CHANNEL_IDS` (comma-separated) |
| Crosspost log channel | `CROSSPOST_LOG_CHANNEL_ID` |
| Role-select message | `ROLE_SELECT_MESSAGE_ID` |
| Events role | `EVENT_NOTIFS_ROLE_ID` |
| Server-updates role | `SERVER_UPDATE_NOTIFS_ROLE_ID` |
| Mod / immune roles | `AUTOMOD_IMMUNE_ROLE_IDS` (comma-separated) |

You only need the IDs for features you intend to use. Features self-disable when their ID is left blank.

> **Arduino deployment:** set `SERVER_ID`, `BOT_COMMANDS_CHANNEL_ID` and `MOD_LOG_CHANNEL_ID` explicitly in `.env`. `SERVER_ID` and `BOT_COMMANDS_CHANNEL_ID` default to the official Arduino server, but if `SERVER_ID` doesn't match the guild the bot is in, automod, tags, suggestions and help features silently do nothing. Without `MOD_LOG_CHANNEL_ID`, all spam detection is off.

---

## 3. Get the code onto your server

SSH into your Dockge host and clone the repo into Dockge's stacks directory:

```bash
cd /opt/stacks
git clone https://github.com/arduinodiscord/bot.git arduino-bot
cd arduino-bot
git checkout revamp          # active development branch
```

> Dockge looks for compose files inside `/opt/stacks/<stack-name>/`. Cloning there means Dockge can pick up the stack automatically.

---

## 4. Create your `.env` file

```bash
cp .env.example .env
nano .env                    # or use your editor of choice
```

Fill in at minimum:

```dotenv
BOT_TOKEN=your_token_here
SERVER_ID=...
BOT_COMMANDS_CHANNEL_ID=...
MOD_LOG_CHANNEL_ID=...
```

Then add the IDs and enable the features you want (see section 2 and the full reference below).

---

## 5. Deploy in Dockge

1. Open Dockge in your browser (typically `http://<server-ip>:5001`).
2. Click **+ Compose** (or **Scan** if Dockge has already picked up the stack).
3. If creating manually, paste the contents of `docker-compose.yml` into the editor.
4. Dockge will find the `.env` file in the same directory and use it automatically.
5. Click **Deploy**. Dockge will:
   - Build the bot image (takes a minute on first run)
   - Start Postgres
   - Run `prisma migrate deploy` to create the database schema
   - Start the bot

Watch the log output. You should see:
```
Logged in as Arduino Bot#0000 (...)
Startup check: OK (guild Arduino, all configured channels and permissions present).
Database connection success
Automod: loaded 0 signature(s) and 0 perceptual hash(es) from the blocklist (...)
Automod: learning mode ACTIVE (...)
```

The **startup check** verifies the configuration against the live server and logs every problem it finds. The bot keeps running either way, so read it:

- `Startup check: OK (...)` — the guild, configured channels and permissions all line up.
- `Startup check: bot is not in SERVER_ID=...` (error) — wrong `SERVER_ID`; the log lists the guilds the bot *is* in. Nearly every feature is inert until fixed.
- `Startup check: <VAR> <id> not found in <guild>` — a configured channel ID is wrong or the bot can't see it.
- `Startup check: <VAR> #channel: missing ...` / `help channel #...: missing ...` — the bot lacks a channel permission there.
- `Startup check: automod guild permissions missing: ...` — Manage Messages / Moderate Members / Ban Members not granted.
- `Startup check: bot's highest role (...) is at the bottom of the role list` — move the bot's role up so it can time out/ban.
- `Automod: MOD_LOG_CHANNEL_ID is not set — ALL spam detection is disabled` — set it.

---

## 6. Verify it's working

**Slash commands registered?**
Type `/` in your server — the bot's commands (`/tag`, `/solved`, `/openposts`, `/ping`, `/about`, `/say`) should appear.

**Automod console active?**
Confirm `MOD_LOG_CHANNEL_ID` is set (the bot logs a startup warning if it isn't). Post a test image in two different channels quickly — you should see an alert appear in the mod-log channel within seconds.

> ⚠️ Test with a **non-moderator account**: anyone with Manage Messages (or a role in `AUTOMOD_IMMUNE_ROLE_IDS`) is exempt from all automod inspection, so images posted by staff never trigger alerts.

While the blocklist corpus is still small, **learning mode** is active (see below): any image with at least one suspicion signal — scam keywords read from the image, a link, a burst, a new account — is posted to the mod log so moderators can train the filter with the Confirm/Not-spam buttons.

**Help-channel features active?**
Open a new thread in a configured help channel. You should see a "Mark Solved" button appear. If you set `HELP_AUTO_NEEDINFO=true` (off by default), a short post with no code/image also gets the needinfo checklist automatically.

**Tag suggestions active?**
Post a message containing `avrdude` or `stk500` in any channel — the bot should reply with a suggestion button.

---

## 7. Updating

```bash
cd /opt/stacks/arduino-bot
git pull
```

Then in Dockge, click **Rebuild** on the stack. The `prisma migrate deploy` step in the startup command applies any new migrations automatically.

---

## 8. Data retention and logs

The bot enforces the retention periods in [PRIVACY.md](PRIVACY.md) itself: a daily sweep (started at login, `src/utils/retention.ts`) deletes join/leave analytics older than 90 days and moderation-action records older than 365 days. It needs no configuration, but only runs while the bot does.

Container logs contain user and channel IDs, so `docker-compose.yml` rotates the bot's logs with the `json-file` driver (5 files × 10 MB, oldest overwritten). Don't move the bot service to a log driver that archives indefinitely without updating PRIVACY.md.

---

## Environment variable reference

All variables are optional except `BOT_TOKEN`. Leaving a variable blank uses the default shown.

### Core

| Variable | Default | Description |
|---|---|---|
| `BOT_TOKEN` | — | **Required.** Your bot token |
| `SERVER_ID` | `420594746990526466` | Your server's ID — set explicitly (see section 2) |
| `BOT_COMMANDS_CHANNEL_ID` | `451158319361556491` | Channel where bot-command-only tags are allowed |
| `DATABASE_URL` | auto-set by compose | Set automatically by docker-compose; do not override |

### Automod console

| Variable | Default | Description |
|---|---|---|
| `MOD_LOG_CHANNEL_ID` | *(disabled)* | Channel where automod alerts appear; **required to enable automod** |

### Image-spam automod

| Variable | Default | Description |
|---|---|---|
| `AUTOMOD_BURST_THRESHOLD` | `3` | Image messages from one user within the window to flag a burst |
| `AUTOMOD_BURST_WINDOW_MS` | `60000` | Window for burst counting (ms) |
| `AUTOMOD_NEW_MEMBER_BURST_THRESHOLD` | `2` | Stricter burst threshold for recently-joined members |
| `AUTOMOD_NEW_MEMBER_WINDOW_MS` | `259200000` | How long a member counts as "new" (72h) |
| `AUTOMOD_FANOUT_CHANNELS` | `2` | Distinct channels the same image must appear in to flag fan-out |
| `AUTOMOD_FANOUT_WINDOW_MS` | `120000` | Window for fan-out detection (ms) |
| `AUTOMOD_PHASH_THRESHOLD` | `6` | Max Hamming distance (of 64) for two images to count as the same |
| `AUTOMOD_PHASH_MAX_CONCURRENCY` | `3` | Max simultaneous pHash fetch/decode jobs (raid backpressure) |
| `AUTOMOD_CLUSTER_MIN_USERS` | `2` | Distinct accounts posting the same/near-identical image to flag a coordinated raid |
| `AUTOMOD_CLUSTER_WINDOW_MS` | `120000` | Window for cross-user image clustering (ms) |
| `AUTOMOD_SCORE_HIGH` | `50` | Confidence (0-100) at or above which the bot auto-deletes and times out |
| `AUTOMOD_SCORE_MEDIUM` | `30` | Confidence at or above which an alert is posted (no auto-action) |
| `AUTOMOD_SCORE_LOW` | `15` | Confidence at or above which a hit counts as low-confidence (posted only with `AUTOMOD_LOG_LOW_CONFIDENCE`) |
| `AUTOMOD_TIMEOUT_MS` | `3600000` | Duration of auto-applied or console timeouts (1h) |
| `AUTOMOD_ALERT_COOLDOWN_MS` | `30000` | Minimum gap between alerts for the same user |
| `AUTOMOD_IMMUNE_ROLE_IDS` | *(none)* | Comma-separated role IDs that are never inspected |
| `AUTOMOD_LEARNING_MODE` | `auto` | Ramp-up mode: while active, every image with any nonzero suspicion signal is posted to the mod log (alert-only) so moderators can train the corpus. `auto` retires itself at the corpus target; `on`/`off` force it |
| `AUTOMOD_LEARNING_CORPUS_TARGET` | `20` | Confirmed blocklist fingerprints at which `auto` learning mode switches to normal confidence gating |
| `AUTOMOD_LEARNING_CATCH_ALL` | `false` | Set `true` to post **every** image message (even zero-signal ones) while learning mode is active. Guarantees nothing slips past during training, but is a firehose in a busy server |
| `AUTOMOD_LOG_LOW_CONFIDENCE` | `false` | After learning mode retires, set `true` to keep posting low-confidence hits |

### OCR (scam text in images)

| Variable | Default | Description |
|---|---|---|
| `OCR_ENABLED` | `true` | Set `false` to disable reading text from images |
| `AUTOMOD_OCR_TIMEOUT_MS` | `5000` | Per-image OCR timeout (ms); on timeout the image is skipped |
| `AUTOMOD_OCR_MAX_CONCURRENCY` | `2` | Max simultaneous OCR jobs |
| `AUTOMOD_OCR_IMAGE_WIDTH` | `640` | Width (px) images are fetched at for OCR — larger reads better but is slower |
| `AUTOMOD_SCAM_KEYWORDS` | *(built-in list)* | Comma-separated keywords that **replace** the built-in seed list |

### Text-flooding automod

| Variable | Default | Description |
|---|---|---|
| `AUTOMOD_FLOOD_ENABLED` | `true` | Set `false` to disable |
| `AUTOMOD_FLOOD_THRESHOLD` | `5` | Short messages in the window to flag flooding |
| `AUTOMOD_FLOOD_WINDOW_MS` | `15000` | Window for flood counting (ms) |
| `AUTOMOD_FLOOD_MAX_CHARS` | `25` | A message is "short" at or below this character count |
| `AUTOMOD_FLOOD_AUTO_TIMEOUT` | `false` | Set `true` to also timeout automatically (default: alert only) |

### Cross-channel question-spam automod

| Variable | Default | Description |
|---|---|---|
| `AUTOMOD_CROSSPOST_ENABLED` | `true` | Set `false` to disable |
| `AUTOMOD_CROSSPOST_CHANNELS` | `2` | Distinct channels for a near-identical message to trigger |
| `AUTOMOD_CROSSPOST_SPREAD_CHANNELS` | `3` | Distinct channels for new-member spread detection |
| `AUTOMOD_CROSSPOST_WINDOW_MS` | `120000` | Detection window (ms) |
| `AUTOMOD_CROSSPOST_MIN_CHARS` | `12` | Messages shorter than this are ignored (greetings, reactions) |
| `AUTOMOD_CROSSPOST_SIMILARITY_PCT` | `80` | Token-overlap % at which two messages count as the same question |
| `AUTOMOD_CROSSPOST_AUTO_DELETE` | `false` | Set `true` to auto-delete duplicate copies (keeping the first); default alert-only |

### Helper-assist

| Variable | Default | Description |
|---|---|---|
| `HELP_CHANNEL_IDS` | *(disabled)* | Comma-separated forum or text channel IDs — enables solve button, auto-needinfo, stale sweep, and `/openposts` |
| `HELP_FORUM_CHANNEL_IDS` | *(none)* | Legacy alias for `HELP_CHANNEL_IDS`; still honoured and merged in |
| `TAG_SUGGEST_ENABLED` | `true` | Keyword → tag auto-suggestion |
| `CODE_FORMAT_SUGGEST_ENABLED` | `true` | Nudge for unformatted code pastes |
| `ASK_SUGGEST_ENABLED` | `true` | Nudge for "can I ask?" / "anyone here?" messages |
| `SUGGEST_IMMUNE_ROLE_IDS` | *(none)* | Comma-separated role IDs whose holders never receive suggestions (Trusted, Knowledgeable, Helper, Moderator, etc.). Self-assignable notification roles should **not** be listed. |
| `SUGGEST_IGNORE_CHANNEL_IDS` | *(none)* | Comma-separated channel IDs where suggestions are suppressed entirely (e.g. staff channels). Listing a forum channel's ID silences all its threads. |
| `HELP_AUTO_NEEDINFO` | `false` | Set `true` to auto-post a concise checklist when a new help post is thin. Off by default — enable after observing the Mark Solved rollout. |
| `HELP_NEEDINFO_MIN_CHARS` | `120` | Combined character count (thread title + post body) below which a post counts as thin. Posts with a code block, inline code, image, or URL are never considered thin. |
| `HELP_STALE_SWEEP_ENABLED` | `true` | Nudge + auto-archive abandoned help posts |
| `HELP_STALE_NUDGE_HOURS` | `72` | Hours idle before a "still need help?" nudge (3 days) |
| `HELP_STALE_ARCHIVE_HOURS` | `168` | Hours after the nudge with no human reply before auto-archiving (7 days) |

### Server management

| Variable | Default | Description |
|---|---|---|
| `JOIN_LEAVE_LOG_CHANNEL_ID` | *(disabled)* | Member join/leave + invite-source logging |
| `CROSSPOST_CHANNEL_IDS` | *(disabled)* | Comma-separated announcement channels to auto-publish |
| `CROSSPOST_LOG_CHANNEL_ID` | *(disabled)* | Where auto-crosspost results are logged |
| `ROLE_SELECT_MESSAGE_ID` | *(disabled)* | Message whose buttons toggle opt-in roles |
| `EVENT_NOTIFS_ROLE_ID` | *(disabled)* | Role toggled by the "events" button |
| `SERVER_UPDATE_NOTIFS_ROLE_ID` | *(disabled)* | Role toggled by the "server_updates" button |

### Postgres (docker-compose only)

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_USER` | `arduino` | Database user |
| `POSTGRES_PASSWORD` | `arduino` | Database password — **change this** |
| `POSTGRES_DB` | `arduino` | Database name |
