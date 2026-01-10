import { ApplicationCommandRegistry, Command } from '@sapphire/framework';
import { EmbedBuilder } from 'discord.js';
import universalEmbed from '../index';

export class PingCommand extends Command {
  public constructor(context: Command.Context, options: Command.Options) {
    super(context, {
      ...options,
      name: 'ping',
      description: 'Check the bot\'s latency and heartbeat.',
    });
  }

  public override registerApplicationCommands(
    registry: ApplicationCommandRegistry
  ) {
    registry.registerChatInputCommand((builder) => {
      builder.setName(this.name).setDescription(this.description);
    });
  }

  public override chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const sent = await interaction.deferReply({ fetchReply: true });
    
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(this.container.client.ws.ping);
    
    const embed = new EmbedBuilder(universalEmbed)
      .setDescription(`My latency is ${latency}ms `)
      .addFields([

        { 
          name: 'API Latency', 
          value: `${apiLatency}ms`, 
          inline: true 
        },
        { 
          name: 'Uptime', 
          value: this.formatUptime(process.uptime()),
          inline: false 
        }
      ])
    	.setFooter({ text: 'Arduino server' })
      .setTimestap();

    
    return interaction.editReply({ embeds: [embed] });
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);
    
    return parts.join(' ');
  }
}
