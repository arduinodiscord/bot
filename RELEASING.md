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

## Deploying (Dockge host)

```bash
cd /opt/stacks/arduino-bot

# 1. Back up the database if this release contains migrations (cheap; do it anyway).
docker compose exec -T db pg_dump -U arduino -Fc arduino > ~/backups/arduino-$(date -u +%Y%m%d-%H%M).dump

# 2. Fetch the release.
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

If you deploy from the Dockge UI instead of a shell, put `GIT_SHA=...` and `BUILD_DATE=...` in the stack's `.env` before clicking **Rebuild** — otherwise the log shows `Build: unknown`.

In the log, confirm:

- `Build: <sha> (built <date>)` matches the tag you deployed.
- Migrations applied (`All migrations have been successfully applied.` or `No pending migrations to apply.`).
- `Startup check: OK (...)` — any `Startup check:` warning means a missing channel, ID or permission (see SETUP.md §5).
- `Database connection success`.

## Rollback

**No migration in the bad release:** check out the previous tag and rebuild.

```bash
git checkout v1.2.2
export GIT_SHA=$(git rev-parse --short HEAD) BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
docker compose up -d --build
```

**The bad release included a migration:** prefer rolling forward with a fix. If the old code can't run against the new schema and you must go back, restore the backup taken before deploying, then rebuild the previous tag:

```bash
docker compose stop bot
docker compose exec -T db pg_restore -U arduino -d arduino --clean --if-exists < ~/backups/arduino-<timestamp>.dump
git checkout v1.2.2
docker compose up -d --build
```

Restoring discards data written since the backup (blocklist confirmations, moderation actions), so note what moderators did in between.
