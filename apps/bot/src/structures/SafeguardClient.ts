import { Client, Collection, GatewayIntentBits, type ClientOptions } from "discord.js";
import type { SafeguardEvent } from "../types/events";
import type { SafeguardCommand, ContextMenuCommand } from "../types/commands";
import type { ButtonComponent, ModalComponent, SelectMenuComponent } from "../types/components";
import { Logger } from "./Logger";
import { CooldownManager } from "./CooldownManager";
import { loadEvents, setupHotReload } from "../handlers/eventHandler";
import { loadCommands, loadContextMenus, setupCommandHotReload } from "../handlers/commandHandler";
import { loadComponents, setupComponentHotReload } from "../handlers/componentHandler";
import { deployToGuild } from "../handlers/deployCommands";

/**
 * Extended Discord.js Client for the Safeguard bot.
 * Provides centralized access to events, commands, components, and utilities.
 */
export class SafeguardClient extends Client {
  /** Collection of registered events */
  public events: Collection<string, SafeguardEvent> = new Collection();

  /** Collection of registered slash commands */
  public commands: Collection<string, SafeguardCommand> = new Collection();

  /** Collection of context menu commands */
  public contextMenus: Collection<string, ContextMenuCommand> = new Collection();

  /** Collection of button handlers */
  public buttons: Collection<string, ButtonComponent> = new Collection();

  /** Collection of modal handlers */
  public modals: Collection<string, ModalComponent> = new Collection();

  /** Collection of select menu handlers */
  public selectMenus: Collection<string, SelectMenuComponent> = new Collection();

  /** Cooldown manager for event/command rate limiting */
  public cooldowns: CooldownManager = new CooldownManager();

  /** Whether hot reloading is enabled (dev mode) */
  public hotReloadEnabled: boolean;

  /** Bot owner user IDs (for ownerOnly commands) */
  public ownerIds: Set<string> = new Set();

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
   * Start the bot by loading events, commands, components, and logging in
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

      // Load all commands and context menus
      await loadCommands(this);
      await loadContextMenus(this);

      // Load all components (buttons, modals, select menus)
      await loadComponents(this);

      // Auto-deploy to dev guild in development mode
      if (this.hotReloadEnabled) {
        const devGuildId = process.env.DEV_GUILD_ID;
        if (devGuildId) {
          await deployToGuild(this, devGuildId);
        } else {
          Logger.warn("Client", "DEV_GUILD_ID not set - skipping auto-deploy");
        }
      }

      // Setup hot reload in development
      if (this.hotReloadEnabled) {
        await setupHotReload(this);
        await setupCommandHotReload(this);
        await setupComponentHotReload(this);
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

    // Cleanup cooldown manager
    this.cooldowns.destroy();

    // Destroy the client connection
    this.destroy();

    Logger.success("Client", "Goodbye! 👋");
    process.exit(0);
  }
}
