# Setup Guide

Step-by-step deployment on a Dockge server.

---

## 1. Create the Discord application

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications) → **New Application**.
2. Name it (e.g. *Arduino Bot*) → **Create**.
3. In the left sidebar → **Bot**:
   - Click **Reset Token** → copy it. This is your `BOT_TOKEN`. Keep it secret.
   - Under **Privileged Gateway Intents**, enable:
     - **Server Members Intent** (required for join/leave logging and new-member detection)
     - **Message Content Intent** (required for tag suggestions, automod, and help-post detection)
4. In the left sidebar → **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot permissions: `Manage Messages`, `Moderate Members`, `Ban Members`, `Send Messages`, `Embed Links`, `Read Message History`, `View Channels`
   - Copy the generated URL, paste it in a browser, and invite the bot to your server.

> **Manage Server permission** is also needed if you want invite-source logging (`JOIN_LEAVE_LOG_CHANNEL_ID`). Add it to the bot permissions above if you plan to use that feature.

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
Database connection success
Automod: loaded 0 signature(s) and 0 perceptual hash(es) from the blocklist.
```

---

## 6. Verify it's working

**Slash commands registered?**
Type `/` in your server — the bot's commands (`/tag`, `/solved`, `/openposts`, `/ping`, `/about`, `/say`) should appear.

**Automod console active?**
Confirm `MOD_LOG_CHANNEL_ID` is set. Post a test image in two different channels quickly — you should see an alert appear in the mod-log channel within seconds.

**Help-channel features active?**
Open a new thread in a configured help channel. You should see a "Mark Solved" button appear. Post a short message with no code/image in a new thread — the needinfo checklist should appear automatically.

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

## Environment variable reference

All variables are optional except `BOT_TOKEN`. Leaving a variable blank uses the default shown.

### Core

| Variable | Default | Description |
|---|---|---|
| `BOT_TOKEN` | — | **Required.** Your bot token |
| `SERVER_ID` | `420594746990526466` | Your server's ID |
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
| `AUTOMOD_TIMEOUT_MS` | `3600000` | Duration of auto-applied or console timeouts (1h) |
| `AUTOMOD_ALERT_COOLDOWN_MS` | `30000` | Minimum gap between alerts for the same user |
| `AUTOMOD_IMMUNE_ROLE_IDS` | *(none)* | Comma-separated role IDs that are never inspected |

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

### Helper-assist

| Variable | Default | Description |
|---|---|---|
| `HELP_CHANNEL_IDS` | *(disabled)* | Comma-separated forum or text channel IDs — enables solve button, auto-needinfo, stale sweep, and `/openposts` |
| `TAG_SUGGEST_ENABLED` | `true` | Keyword → tag auto-suggestion |
| `CODE_FORMAT_SUGGEST_ENABLED` | `true` | Nudge for unformatted code pastes |
| `ASK_SUGGEST_ENABLED` | `true` | Nudge for "can I ask?" / "anyone here?" messages |
| `HELP_AUTO_NEEDINFO` | `true` | Auto-post needinfo checklist on thin help posts |
| `HELP_NEEDINFO_MIN_CHARS` | `60` | Opening post shorter than this (and with no code/image) counts as thin |
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
