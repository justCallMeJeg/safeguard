import type { PartialSafeguardConfig } from "./schema";

/**
 * Default configuration values for Safeguard bot.
 * These are used when no config file or environment variable is provided.
 *
 * Note: Sensitive values like tokens are NOT included here.
 * They must be provided via environment variables or config files.
 */
export const defaultConfig: PartialSafeguardConfig = {
  bot: {
    // Required values - must be set via env or config file
    token: "",
    clientId: "",
    publicKey: "",
    clientSecret: "",
    ownerIds: [],
    devGuildId: undefined,
  },

  settings: {
    // Default command prefix for future message commands
    defaultPrefix: "!",

    // Embed colors using Discord's color palette
    colors: {
      primary: 0x5865f2, // Discord Blurple
      success: 0x57f287, // Green
      error: 0xed4245, // Red
      warning: 0xfee75c, // Yellow
      info: 0x5865f2, // Blurple
      moderation: 0xeb459e, // Fuchsia
    },

    // Cooldown settings
    cooldowns: {
      defaultMs: 3000, // 3 seconds default cooldown
      bypassRoles: [], // No roles bypass by default
      bypassUsers: [], // No users bypass by default (owners always bypass)
    },

    // Feature toggles
    features: {
      hotReload: true, // Enable in development
      debugMode: false, // Disable extra logging
      verboseEvents: false, // Don't log all events
      autoDeployDev: true, // Auto-deploy to dev guild
    },
  },

  logging: {
    level: "info", // Default log level
    timestamps: true, // Show timestamps
    colors: true, // Use colors
    compact: false, // Full format
  },
};

/**
 * Environment variable mapping
 * Maps environment variable names to config paths
 */
export const envMapping: Record<string, string> = {
  // Bot credentials
  BOT_TOKEN: "bot.token",
  CLIENT_ID: "bot.clientId",
  PUBLIC_KEY: "bot.publicKey",
  CLIENT_SECRET: "bot.clientSecret",
  BOT_OWNER_IDS: "bot.ownerIds",
  DEV_GUILD_ID: "bot.devGuildId",

  // Settings
  BOT_PREFIX: "settings.defaultPrefix",
  COOLDOWN_DEFAULT_MS: "settings.cooldowns.defaultMs",
  COOLDOWN_BYPASS_ROLES: "settings.cooldowns.bypassRoles",
  COOLDOWN_BYPASS_USERS: "settings.cooldowns.bypassUsers",

  // Features
  HOT_RELOAD: "settings.features.hotReload",
  DEBUG_MODE: "settings.features.debugMode",
  VERBOSE_EVENTS: "settings.features.verboseEvents",
  AUTO_DEPLOY_DEV: "settings.features.autoDeployDev",

  // Logging
  LOG_LEVEL: "logging.level",
  LOG_TIMESTAMPS: "logging.timestamps",
  LOG_COLORS: "logging.colors",
  LOG_COMPACT: "logging.compact",
};

/**
 * Config file names to search for (in order of priority, last wins)
 */
export const configFiles = [
  "config.json", // Default config (committed to git)
  "config.local.json", // Local overrides (gitignored)
];
