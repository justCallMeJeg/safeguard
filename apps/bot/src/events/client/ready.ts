import { ActivityType, Events } from "discord.js";
import type { SafeguardEvent } from "../../types/events";
import { Logger } from "../../structures/Logger";

/**
 * Handles the clientReady event.
 * Fires once when the bot successfully connects to Discord.
 */
const event: SafeguardEvent<Events.ClientReady> = {
  name: Events.ClientReady,
  once: true,
  priority: 100, // High priority - runs first

  async execute(client) {
    const { user } = client;

    if (!user) {
      Logger.error("Ready", "Client user is not available!");
      return;
    }

    // Set the bot's presence
    client.user?.setPresence({
      status: "online",
      activities: [
        {
          name: "Watching over your server",
          type: ActivityType.Watching,
        },
      ],
    });

    // Log startup information
    const guildCount = client.guilds.cache.size;
    const userCount = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);

    Logger.success("Ready", `🛡️ Safeguard is online as ${user.tag}`);
    Logger.success(
      "Ready",
      `📊 Serving ${guildCount} guild(s) with ${userCount.toLocaleString()} members`
    );

    if (client.hotReloadEnabled) {
      Logger.success("Ready", "🔥 Hot reload is enabled");
    }
  },
};

export default event;
