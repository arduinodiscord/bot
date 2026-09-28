# Releasing

How a change gets from a branch to the production bot.

## Versioning and branches

- **Branch flow:** work lands on `revamp` → PR into `staging` (test deploy) → PR into `main` (production). PRs target `staging`, never `main` directly.
- **Version:** semver in `package.json`, bumped once per release on `staging` before it merges to `main`:
  - **patch** — bug fixes, copy/threshold tweaks
  - **minor** — new features, new env vars (with defaults), new migrations
  - **major** — anything an operator must act on: renamed/removed env vars, new required permissions or intents, destructive migrations
- **Tag** the exact commit that gets deployed, after it merges to `main`:
  ```bash
  git checkout main && git pull
  git tag -a v1.2.3 -m "v1.2.3"
  git push origin v1.2.3
  ```
- **Release notes:** create a GitHub release from the tag (`gh release create v1.2.3 --generate-notes`), then edit it to call out:
  new/changed env vars, new permissions or intents, migrations, and behaviour changes moderators will notice.

## Database migrations

1. Change `prisma/schema.prisma`, then create the migration locally against a dev database:
   ```bash
   npx prisma migrate dev --name short_description
   ```
2. **Read the generated SQL** in `prisma/migrations/<timestamp>_short_description/migration.sql`. Watch for dropped columns/tables and table rewrites on large tables.
3. Commit the schema change and the migration folder together.
4. On deploy, the container runs `prisma migrate deploy` before starting the bot, so pending migrations apply automatically. If a migration fails, the bot does not start — check `docker compose logs bot`.

**Policy: roll forward.** Never edit or delete a migration that has been deployed. To undo one, write a new migration. A code rollback does not undo a schema change, so keep migrations backward compatible with the previous release where possible (add columns before using them, drop them a release later).

## Pre-release checks

- CI is green on the commit being released (build, tests, migrations against Postgres, Docker build).
- **Once, and after any report of automod misses:** check that Discord's media proxy gives identical thumbnails for two uploads of the same file. The automod's exact image matching (blocklist, allowlist, cross-account matching) depends on it. Upload one image file twice in a test channel, copy both image links, and run:

  ```bash
  node scripts/check-proxy-determinism.mjs <link-1> <link-2>
  ```

  `OK` means exact matching works. `DIFFERENT` means confirmed scam images would only be caught by the perceptual near-match (timeout + delete, never auto-ban): stop and fix before releasing.

## Deploying (Dockge host)

**What gets deployed:** production always runs a **release tag** (`vX.Y.Z`, an annotated tag on `main`, created as above). Never deploy a moving branch to production: `git checkout main` or `git pull` gives you whatever is newest, not what was reviewed. A staging/test deploy may use a branch or a commit SHA, but note the SHA you deployed. Either way the startup log's `Build: <sha>` line is the proof of what is running.

**Where:** always from the **same stack directory** (`/opt/stacks/arduino-bot`). Compose names the project after the directory and the database volume after the project (`arduino-bot_pgdata`). Deploying from a fresh clone elsewhere, or pasting `docker-compose.yml` into a new Dockge stack, starts with an **empty database**, and a pasted stack has no Dockerfile or source to build from.

**How:** from a shell, with `docker compose up -d --build`. Dockge's UI buttons reuse the existing image, so they may not rebuild after a `git checkout` and you'd silently keep running the old code. Use Dockge to watch logs, not to deploy.

```bash
cd /opt/stacks/arduino-bot

# 1. Back up the database if this release contains migrations (cheap; do it anyway).
#    Use an absolute path: `~` is /root under `sudo -i`/`sudo su`, so a backup
#    taken as one user is "missing" when you restore as the other.
BACKUP_DIR=/home/$USER/backups          # or any absolute path you'll remember
mkdir -p "$BACKUP_DIR"
BACKUP="$BACKUP_DIR/arduino-$(date -u +%Y%m%d-%H%M).dump"
docker compose exec -T db pg_dump -U arduino -Fc arduino > "$BACKUP"
ls -lh "$BACKUP"                        # non-empty? note this path for rollback

# 2. Fetch the release tag.
git fetch --tags
git checkout v1.2.3

# 3. Build identity: compose passes these to the image as build args.
export GIT_SHA=$(git rev-parse --short HEAD)
export BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# 4. Rebuild and restart.
docker compose up -d --build

# 5. Check the startup log.
docker compose logs -f --tail=100 bot
```

If you run docker via `sudo`, use `sudo -E docker compose up -d --build` (or `sudo GIT_SHA=$GIT_SHA BUILD_DATE=$BUILD_DATE docker compose ...`) so the exported variables reach compose. Alternatively put `GIT_SHA=...` and `BUILD_DATE=...` in the stack's `.env`, and update them on every deploy. Otherwise the log shows `Build: unknown`.

In the log, confirm:

- `Build: <sha> (built <date>)` matches the tag you deployed (`git rev-parse --short v1.2.3^{commit}`).
- Migrations applied (`All migrations have been successfully applied.` or `No pending migrations to apply.`).
- `Startup check: OK (...)` — any `Startup check:` warning means a missing channel, ID or permission (see SETUP.md section 5).
- `Database connection success`.

## Rollback

**No migration in the bad release:** check out the previous tag and rebuild.

```bash
cd /opt/stacks/arduino-bot
git checkout v1.2.2
export GIT_SHA=$(git rev-parse --short HEAD)
export BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
docker compose up -d --build
```

**The bad release included a migration:** prefer rolling forward with a fix. If the old code can't run against the new schema and you must go back, restore the backup taken before deploying, then rebuild the previous tag:

```bash
cd /opt/stacks/arduino-bot
docker compose stop bot
docker compose exec -T db pg_restore -U arduino -d arduino --clean --if-exists < /home/<user>/backups/arduino-<timestamp>.dump
git checkout v1.2.2
export GIT_SHA=$(git rev-parse --short HEAD)
export BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
docker compose up -d --build
```

Restoring discards data written since the backup (blocklist confirmations, moderation actions), so note what moderators did in between.

## Release notes: first release from `revamp`

Call these out in the GitHub release for the first production deploy of the revamp work:

- **New permissions:** `Manage Roles` (role-select buttons) and `Attach Files` (mod-log alerts attach an evidence image, including in the mod-log channel's overwrites). Re-invite with the URL in SETUP.md section 1; it updates the bot's role in place.
- **Blocklist shrinks, learning mode may come back.** The `20260927000000_purge_legacy_phash` migration deletes every stored perceptual-hash fingerprint (they were computed with a broken algorithm and matched unrelated images), and `20260927120000_drop_forgeable_meta_fingerprints` deletes the old `meta` fingerprints too. With `AUTOMOD_LEARNING_MODE=auto`, learning mode switches on whenever the confirmed corpus is below `AUTOMOD_LEARNING_CORPUS_TARGET`, so after this migration the mod log may start receiving learning alerts again until moderators re-confirm enough spam. Expected, not a regression.
- **Analytics primary keys:** `20260928000000_analytics_surrogate_ids` gives the analytics tables an `id` key (raid joins in the same millisecond no longer fail). Runs in place on the existing data.
- **OCR is offline:** the English model ships in the image; nothing is fetched from a CDN at runtime.
- **Container runs as non-root** (`node` user) and no longer installs a C/C++ toolchain.
