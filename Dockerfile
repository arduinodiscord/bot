FROM node:lts-alpine

LABEL org.opencontainers.image.source https://github.com/arduinodiscord/bot

WORKDIR /srv

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
