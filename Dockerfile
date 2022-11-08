FROM node:alpine

LABEL org.opencontainers.image.source https://github.com/max-bromberg/arduino-bot

WORKDIR /opt/app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

CMD ["npm", "start"]
