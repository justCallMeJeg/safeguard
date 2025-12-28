import { Events } from "discord.js";
import type { SafeguardEvent } from "../../types/events";
import { Logger } from "../../structures/Logger";

/**
 * Handles the warn event.
 * Fires when the Discord.js client encounters a warning.
 */
const event: SafeguardEvent<"warn"> = {
  name: Events.Warn,
  once: false,
  priority: 90, // High priority

  async execute(_client, message) {
    Logger.warn("Discord", message);

    // Common warnings to watch for:
    // - Rate limits approaching
    // - Deprecated API usage
    // - Permission issues
  },
};

export default event;
