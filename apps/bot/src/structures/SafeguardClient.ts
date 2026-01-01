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
import { config, type SafeguardConfig } from "../config";
import { GuildSettingsService } from "../services/GuildSettingsService";
import { auditLogService, type AuditLogService } from "@safeguard/database";

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
  public hotReloadEnabled: boolean = false;

  /** Bot owner user IDs (for ownerOnly commands) */
  public ownerIds: Set<string> = new Set();

  /** Guild settings service for per-guild configuration */
  public guildSettings: GuildSettingsService = GuildSettingsService.getInstance();

  /** Audit log service for database logging */
  public auditLogs: AuditLogService = auditLogService;

  /** The loaded configuration */
  private _config: SafeguardConfig | null = null;

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

    // Initialize logger
    Logger.init();
  }

  /**
   * Get the current configuration
   */
  get config(): SafeguardConfig {
    if (!this._config) {
      throw new Error("Configuration not loaded. Call start() first.");
    }
    return this._config;
  }

  /**
   * Start the bot by loading config, events, commands, components, and logging in
   */
  async start(): Promise<void> {
    try {
      // Initialize configuration first
      Logger.info("Client", "Loading configuration...");
      this._config = await config.initialize();

      // Set properties from config
      this.hotReloadEnabled =
        process.env.NODE_ENV !== "production" && this._config.settings.features.hotReload;
      this.ownerIds = new Set(this._config.bot.ownerIds);

      // Validate required config
      if (!this._config.bot.token) {
        Logger.error("Client", "BOT_TOKEN is not configured!");
        Logger.error("Client", "Set BOT_TOKEN in your .env file or config.json");
        process.exit(1);
      }

      // Log configuration summary
      Logger.debug(
        "Client",
        `Owner IDs: ${this.ownerIds.size > 0 ? [...this.ownerIds].join(", ") : "none"}`
      );
      Logger.debug("Client", `Hot reload: ${this.hotReloadEnabled ? "enabled" : "disabled"}`);
      Logger.debug(
        "Client",
        `Debug mode: ${this._config.settings.features.debugMode ? "enabled" : "disabled"}`
      );

      // Listen for config changes
      config.onChange((newConfig) => {
        Logger.info("Client", "Configuration updated");
        // Update runtime values that can change
        this.ownerIds = new Set(newConfig.bot.ownerIds);
      });

      // Initialize guild settings service
      Logger.info("Client", "Initializing guild settings service...");
      await this.guildSettings.initialize();

      // Load all events
      await loadEvents(this);

      // Load all commands and context menus
      await loadCommands(this);
      await loadContextMenus(this);

      // Load all components (buttons, modals, select menus)
      await loadComponents(this);

      // Auto-deploy to dev guild in development mode
      if (this.hotReloadEnabled && this._config.settings.features.autoDeployDev) {
        const devGuildId = this._config.bot.devGuildId;
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
      await this.login(this._config.bot.token);
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

    // Cleanup config manager
    config.destroy();

    // Cleanup guild settings service
    this.guildSettings.destroy();

    // Cleanup cooldown manager
    this.cooldowns.destroy();

    // Destroy the client connection
    this.destroy();

    Logger.success("Client", "Goodbye! 👋");
    process.exit(0);
  }
}
