/**
 * Safeguard Configuration System
 *
 * This module provides a type-safe, validated configuration system with:
 * - JSON file support (config.json, config.local.json)
 * - Environment variable overrides
 * - Hot-reloading in development
 * - Zod schema validation
 *
 * @example
 * ```typescript
 * import { config, getConfig } from "./config";
 *
 * // Initialize once at startup
 * await config.initialize();
 *
 * // Access config values
 * const token = getConfig().bot.token;
 * const colors = getConfig().settings.colors;
 *
 * // Get specific values
 * const primary = config.getValue<number>("settings.colors.primary");
 *
 * // Listen for changes (hot-reload)
 * config.onChange((newConfig) => {
 *   console.log("Config changed!", newConfig);
 * });
 * ```
 */

// Re-export types
export type {
  SafeguardConfig,
  BotConfig,
  SettingsConfig,
  ColorsConfig,
  CooldownConfig,
  FeaturesConfig,
  LoggingConfig,
  PartialSafeguardConfig,
} from "./schema";

// Re-export schemas for external validation
export {
  SafeguardConfigSchema,
  BotConfigSchema,
  SettingsConfigSchema,
  ColorsConfigSchema,
  CooldownConfigSchema,
  FeaturesConfigSchema,
  LoggingConfigSchema,
  normalizeConfig,
} from "./schema";

// Export ConfigManager class
export { ConfigManager } from "./ConfigManager";

// Import for singleton
import { ConfigManager } from "./ConfigManager";
import type { SafeguardConfig } from "./schema";

/**
 * Singleton config manager instance
 */
export const config = ConfigManager.getInstance();

/**
 * Get the current configuration
 * Shorthand for config.get()
 */
export function getConfig(): SafeguardConfig {
  return config.get();
}

/**
 * Force reload the configuration
 * Shorthand for config.reload()
 */
export function reloadConfig(): SafeguardConfig {
  return config.reload();
}
