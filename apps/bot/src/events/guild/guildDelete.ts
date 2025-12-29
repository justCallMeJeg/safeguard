import { Events, type Guild } from "discord.js";
import type { SafeguardEvent } from "../../types/events";
import { Logger } from "../../structures/Logger";

/**
 * Handles the guildDelete event.
 * Cleans up cache when bot leaves a server.
 * Note: We don't delete from database by default to preserve data
 * in case the bot is re-added.
 */
const event: SafeguardEvent<"guildDelete"> = {
  name: Events.GuildDelete,
  once: false,

  async execute(client, guild: Guild) {
    Logger.info("GuildDelete", `Left guild: ${guild.name} (${guild.id})`);

    // Invalidate cache (but keep database record)
    client.guildSettings.invalidateCache(guild.id);

    // Optionally: To delete from database on leave, uncomment:
    // await client.guildSettings.delete(guild.id);
  },
};

export default event;
