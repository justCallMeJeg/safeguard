import { Client, Collection, GatewayIntentBits, type ClientOptions } from "discord.js";
import type { SafeguardEvent } from "../types/events";
import { Logger } from "./Logger";
import { CooldownManager } from "./CooldownManager";
import { loadEvents, setupHotReload } from "../handlers/eventHandler";

/**
 * Extended Discord.js Client for the Safeguard bot.
 * Provides centralized access to events, commands, and utilities.
 */
export class SafeguardClient extends Client {
  /** Collection of registered events */
  public events: Collection<string, SafeguardEvent> = new Collection();

  /** Cooldown manager for event rate limiting */
  public cooldowns: CooldownManager = new CooldownManager();

  /** Whether hot reloading is enabled (dev mode) */
  public hotReloadEnabled: boolean;

  constructor(options?: Partial<ClientOptions>) {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
      ],
      ...options,
    });

    // Enable hot reload in development
    this.hotReloadEnabled = process.env.NODE_ENV !== "production";

    // Initialize logger
    Logger.init();
  }

  /**
   * Start the bot by loading events and logging in
   */
  async start(): Promise<void> {
    const token = process.env.BOT_TOKEN;

    if (!token) {
      Logger.error("Client", "BOT_TOKEN environment variable is not set!");
      process.exit(1);
    }

    try {
      // Load all events
      await loadEvents(this);

      // Setup hot reload in development
      if (this.hotReloadEnabled) {
        await setupHotReload(this);
      }

      // Login to Discord
      await this.login(token);
    } catch (error) {
      Logger.error("Client", error instanceof Error ? error : new Error(String(error)));
      process.exit(1);
    }
  }

  /**
   * Gracefully shutdown the bot
   */
  async shutdown(): Promise<void> {
    Logger.warn("Client", "Shutting down...");

    // Destroy the client connection
    this.destroy();

    Logger.success("Client", "Goodbye! 👋");
    process.exit(0);
  }
}
