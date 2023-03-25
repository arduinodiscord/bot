FROM node:lts-alpine AS dependencies

LABEL org.opencontainers.image.source https://github.com/arduinodiscord/bot

WORKDIR /srv

COPY ./package*.json .
COPY ./prisma ./prisma

COPY . .

RUN apk add --update --no-cache openssl1.1-compat

RUN npm install

RUN npm run build

CMD ["npm", "start"]
