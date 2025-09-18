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

## Environment Variables

This bot requires the following environment variables to be set:

-   `BOT_TOKEN`: Your Discord bot token.
-   `BOT_COMMANDS_CHANNEL_ID`: The ID of the channel where the bot will send responses for commands like `/tag`. This channel should be configured in your server.

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
