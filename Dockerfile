# Pinned (not `lts`, which floated up to Node 24 and broke native builds).
FROM node:22-alpine

LABEL org.opencontainers.image.source https://github.com/arduinodiscord/bot

WORKDIR /srv

# @sapphire/type publishes no Linux prebuilt binary, so node-gyp compiles it
# from source on install — that needs Python and a C/C++ toolchain.
RUN apk add --no-cache python3 make g++

# Install dependencies first for better layer caching. The postinstall hook runs
# `prisma generate`, which needs the schema, so copy prisma/ before installing.
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm install

# Then copy the rest of the source and build.
COPY . .
RUN npm run build

CMD ["npm", "start"]
