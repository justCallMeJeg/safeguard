import { Events } from "discord.js";
import type { SafeguardEvent } from "../../types/events";
import { Logger } from "../../structures/Logger";

/**
 * Handles the error event.
 * Fires when the Discord.js client encounters an error.
 */
const event: SafeguardEvent<"error"> = {
  name: Events.Error,
  once: false,
  priority: 100, // High priority - runs first

  async execute(_client, error) {
    Logger.error("Discord", error);

    // You can add additional error handling here:
    // - Send to error tracking service (Sentry, etc.)
    // - Notify developers via webhook
    // - Log to database for analysis
  },

  afterExecute(ctx) {
    // Log execution time for monitoring
    if (ctx.duration > 100) {
      Logger.debug("Error", `Error handling took ${ctx.duration}ms`);
    }
  },
};

export default event;
