import { Client, GatewayIntentBits } from "discord.js";
// import { PrismaClient } from '@safeguard/database';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildModeration],
});

client.once("clientReady", () => {
  console.log(`🛡️ Safeguard is online as ${client.user?.tag}`);
});

client.login(process.env.BOT_TOKEN);
