require('dotenv').config()
if (process.env.DEV_ENV) {
  const config = require('../config-dev.json')
} else {
  const config = require('../config-prod.json')
}
const { AkairoClient, CommandHandler } = require('discord-akairo')
class ArduinoBotClient extends AkairoClient {
  constructor() {
    super({
      ownerID: ['200616508328509442', '223217915673968641']
    }, {
      disableMentions: 'everyone'
    })

    this.primaryCommandHandler = new CommandHandler(this, {
      directory: './src/commands',
      // Used for critical maintenance commands only. End-user commands are exclusively slash commands.
      prefix: config.prefix
    })

    this.primaryCommandHandler.loadAll()
  }
}
const client = new ArduinoBotClient()
client.login(process.env.TOKEN)