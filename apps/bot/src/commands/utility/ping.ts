import { SlashCommandBuilder } from "discord.js";
import type { SafeguardCommand } from "../../types/commands";

/**
 * Ping command - Basic utility command to check bot latency.
 */
const command: SafeguardCommand = {
  data: new SlashCommandBuilder().setName("ping").setDescription("Check the bot's latency"),

  category: "utility",

  cooldown: {
    duration: 3000, // 3 seconds
    scope: "user",
  },

  async execute(client, interaction) {
    const response = await interaction.reply({
      content: "🏓 Pinging...",
      withResponse: true,
    });

    const sent = response.resource?.message;
    if (!sent) return;

    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    const wsLatency = client.ws.ping;

    await interaction.editReply(
      `🏓 **Pong!**\n` + `📡 Roundtrip: \`${roundtrip}ms\`\n` + `💓 WebSocket: \`${wsLatency}ms\``
    );
  },
};

export default command;
