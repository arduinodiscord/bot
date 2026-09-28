# Pinned (not `lts`, which floated up to Node 24 and broke native builds).
FROM node:22-alpine

LABEL org.opencontainers.image.source https://github.com/arduinodiscord/bot

WORKDIR /srv

# No native addons remain in the dependency tree, so no build toolchain.
# OpenSSL is what Prisma's schema engine (used by `prisma migrate deploy`)
# links against; Prisma's docs list it as required on Alpine.
RUN apk add --no-cache openssl

# Install dependencies first for better layer caching. The postinstall hook runs
# `prisma generate`, which needs the schema, so copy prisma/ before installing.
# `npm ci` installs exactly what package-lock.json pins.
#
# devDependencies are deliberately NOT pruned: the `prisma` CLI (a devDependency)
# runs `prisma migrate deploy` at container start, and prisma.config.ts needs it
# too. Keeping them costs some image size but can't break migrations.
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

# Then copy the rest of the source and build.
COPY . .
RUN npm run build

# Build identity, logged at startup. Declared after the build so a new SHA
# doesn't invalidate the cached install/build layers. Compose passes these
# from the host environment (see RELEASING.md); they default to 'unknown'.
ARG GIT_SHA=unknown
ARG BUILD_DATE=unknown
ENV GIT_SHA=$GIT_SHA BUILD_DATE=$BUILD_DATE
LABEL org.opencontainers.image.revision=$GIT_SHA org.opencontainers.image.created=$BUILD_DATE

# Drop root for runtime. Everything under /srv stays root-owned and is only
# world-readable: nothing writes there at runtime (`prisma migrate deploy`
# only reads node_modules, prisma/ and prisma.config.ts; OCR loads its bundled
# model with cacheMethod 'none'), so the bot can't modify its own code.
USER node

# Run node directly (not via npm) so SIGTERM from `docker stop` reaches it.
CMD ["node", "dist/src/index.js"]
