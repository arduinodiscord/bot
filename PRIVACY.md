# Privacy Policy

**Effective:** 27 September 2026

This policy explains what data the Arduino Discord bot (the "bot") processes and why. The bot is the custom, open-source bot for the Arduino community Discord server ([arduino.cc/discord](https://arduino.cc/discord)). It is run by that server's volunteer staff team (the "staff", "we"). It operates only in that server.

The bot's source code is public at [github.com/arduinodiscord/bot](https://github.com/arduinodiscord/bot), so anything described here can be checked against the code.

## Summary

- The bot reads messages posted in the server in order to **stop scams and spam** and to **help people get answers**.
- **We never store the text or images of your messages.** Messages are checked in memory and then discarded.
- We store a small amount of data: fingerprints of images that moderators confirmed as scams, words taken from those scam images, a record of moderation actions, and the times members joined and left. It is kept only as long as described below.
- We do **not** sell, share, or rent data. We do **not** use it for advertising. We do **not** use it to train AI or machine-learning models.

## What the bot processes, and why

### Messages and attachments (Message Content)

When you post in the server, the bot reads the message text and any image attachments. It uses them to:

- **Detect scams and spam.** The bot fingerprints images and compares them with images posted by other accounts and in other channels. It reads text inside images using optical character recognition (OCR), which runs locally on our server, and looks for known scam words and links. It also detects the same message being pasted across many channels and rapid message flooding.
- **Offer help.** It notices unformatted code or common help topics and offers a button that shows the relevant help article. It also checks whether a new help post includes enough detail.
- **Preview linked messages** from the same server.

This processing happens **in memory**. For cross-channel and cross-account comparison, recent message fingerprints and text are held in memory for a few minutes, and are then discarded. Message text and images are never written to a database or to disk.

When the bot flags something, it posts an alert to a private moderator channel **inside Discord**. The alert can include a preview of the flagged image and any text detected in it, so moderators can review it.

### Members (Server Members)

The bot receives join and leave events so moderators can see new and departing members in a private staff log. These events are also used to spot raid waves of new or compromised accounts. The log can include the account's creation date and which invite was used to join.

The bot may also use your account age and the date you joined the server when judging whether a post looks like spam. Brand-new accounts are a common source of scam posts.

## What we store

We run the database ourselves. It is not shared with any third party.

| Data | Why | How long |
|---|---|---|
| Fingerprints of images a moderator **confirmed as scam or spam**, or marked as safe. A fingerprint is file size, image dimensions, and a 64-bit perceptual hash, with the moderator's ID. It is not the image, and the image cannot be rebuilt from it. | Recognise the same scam image when it is posted again. | Until a moderator removes it. |
| Individual words read from images a moderator confirmed as scams (e.g. "airdrop", "withdraw"), not linked to any user. | Improve scam-word detection. | Until a moderator removes them. |
| Moderation actions taken through the bot: moderator ID, target user ID, the action, and the reason. | Accountability and appeal review. | 1 year. |
| Member join and leave events: user ID and time. | Detecting raid waves and understanding server growth. | 90 days. |

The bot's operational logs can contain user and channel IDs. They are rotated and overwritten automatically, and are not archived.

## What we do not do

- We do not store message text, attachments, or images.
- We do not track presence, activity, or status.
- We do not sell, share, or rent data, and we do not use it for advertising.
- We do not use any data to train AI or machine-learning models. OCR uses Tesseract, an open-source engine that runs locally and only reads text. Nothing is sent to external AI services.

## Your choices and rights

Scam and spam checks apply to everyone in the server, because they protect the whole community. You can:

- **Ask what we hold about you, or ask us to delete it.** This covers moderation records and join/leave records. Contact the server moderators, or open an issue on the GitHub repository (do not post private details in a public issue). We may keep moderation records needed to enforce an active ban or to handle an appeal.
- **Stop all processing** by leaving the server. The bot does not process anything outside the Arduino Discord server.

## Discord

Your use of Discord is also covered by [Discord's Privacy Policy](https://discord.com/privacy). The bot only uses data that Discord provides to bots, under Discord's [Developer Terms of Service](https://discord.com/developers/docs/policies-and-agreements/developer-terms-of-service) and [Developer Policy](https://discord.com/developers/docs/policies-and-agreements/developer-policy).

## Changes

If the bot starts processing new kinds of data, we will update this policy before that happens. The change history of this file is public in the repository.

## Contact

Message the moderators on the Arduino Discord server, or open an issue at [github.com/arduinodiscord/bot/issues](https://github.com/arduinodiscord/bot/issues).
