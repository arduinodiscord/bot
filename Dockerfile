FROM node:lts-alpine AS dependencies

LABEL org.opencontainers.image.source https://github.com/arduinodiscord/bot

WORKDIR /srv

COPY package*.json prisma ./

RUN npm ci

# ---

FROM node:lts-alpine AS builder

WORKDIR /srv

COPY --from=dependencies /srv/node_modules ./node_modules
COPY . .

RUN npm run build

# ---

FROM node:lts-alpine AS runner

WORKDIR /srv

COPY --from=builder /srv/node_modules ./node_modules
COPY --from=builder /srv/package.json .
COPY --from=builder /srv/dist ./dist

CMD [ "npm", "run", "start" ]
