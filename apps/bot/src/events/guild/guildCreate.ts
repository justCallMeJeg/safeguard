import { Events, type Guild } from "discord.js";
import type { SafeguardEvent } from "../../types/events";
import { Logger } from "../../structures/Logger";

/**
 * Handles the guildCreate event.
 * Auto-initializes guild settings when bot joins a new server.
 */
const event: SafeguardEvent<"guildCreate"> = {
  name: Events.GuildCreate,
  once: false,

  async execute(client, guild: Guild) {
    Logger.info("GuildCreate", `Joined guild: ${guild.name} (${guild.id})`);

    try {
      // Initialize guild settings
      await client.guildSettings.getOrCreate(guild.id);
      Logger.success("GuildCreate", `Initialized settings for ${guild.name}`);
    } catch (error) {
      Logger.error(
        "GuildCreate",
        `Failed to initialize settings for ${guild.name}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
};

export default event;
