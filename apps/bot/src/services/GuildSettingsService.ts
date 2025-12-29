import { Logger } from "../structures/Logger";
import {
  guildService,
  type Guild,
  type GuildUpdate,
  type ServiceResult,
} from "@safeguard/database";

/**
 * Configuration for the GuildSettingsService
 */
export interface GuildSettingsServiceConfig {
  /** Whether to use database (if false, in-memory only) */
  useDatabase?: boolean;
}

/**
 * Service for managing per-guild settings.
 * This is a thin wrapper around @safeguard/database's GuildService
 * that handles initialization and provides a convenient API for the bot.
 *
 * @example
 * ```typescript
 * const settings = await guildSettingsService.get("123456789");
 * if (settings) {
 *   console.log(settings.antinukeEnabled);
 * }
 *
 * await guildSettingsService.update("123456789", {
 *   antinukeEnabled: true
 * });
 * ```
 */
export class GuildSettingsService {
  private static instance: GuildSettingsService | null = null;

  /** Whether the service has been initialized */
  private initialized = false;

  /** Whether database connection is available */
  private databaseConnected = false;

  private constructor() {}

  /**
   * Get or create the singleton instance
   */
  static getInstance(): GuildSettingsService {
    if (!this.instance) {
      this.instance = new GuildSettingsService();
    }
    return this.instance;
  }

  /**
   * Initialize the service (verify database connection)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Test database connection by getting cache stats
      guildService.getCacheStats();
      this.databaseConnected = true;
      Logger.success("GuildSettings", "Database connection established");
    } catch (error) {
      Logger.warn(
        "GuildSettings",
        `Database unavailable: ${error instanceof Error ? error.message : String(error)}`
      );
      this.databaseConnected = false;
    }

    this.initialized = true;
  }

  /**
   * Get guild settings by ID
   * Returns null if guild not found
   */
  async get(guildId: string): Promise<Guild | null> {
    const result = await guildService.safeGet(guildId);
    if (!result.success) {
      Logger.error("GuildSettings", `Failed to get guild ${guildId}: ${result.error}`);
      return null;
    }
    return result.data;
  }

  /**
   * Get guild settings, creating default settings if not found
   */
  async getOrCreate(guildId: string): Promise<Guild> {
    const result = await guildService.safeGetOrCreate(guildId);
    if (!result.success) {
      Logger.error("GuildSettings", `Failed to get/create guild ${guildId}: ${result.error}`);
      // Return a minimal guild object as fallback
      throw new Error(`Database error: ${result.error}`);
    }
    return result.data;
  }

  /**
   * Update guild settings
   */
  async update(guildId: string, update: GuildUpdate): Promise<Guild | null> {
    try {
      const updated = await guildService.update(guildId, update);
      if (updated) {
        Logger.debug("GuildSettings", `Updated guild ${guildId}`);
      }
      return updated;
    } catch (error) {
      Logger.error(
        "GuildSettings",
        `Failed to update guild ${guildId}: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  /**
   * Delete guild settings
   */
  async delete(guildId: string): Promise<boolean> {
    try {
      const deleted = await guildService.delete(guildId);
      if (deleted) {
        Logger.info("GuildSettings", `Deleted guild ${guildId}`);
      }
      return deleted;
    } catch (error) {
      Logger.error(
        "GuildSettings",
        `Failed to delete guild ${guildId}: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }

  /**
   * Invalidate cache for a guild
   */
  invalidateCache(guildId: string): void {
    guildService.invalidateCache(guildId);
    Logger.debug("GuildSettings", `Cache invalidated for guild ${guildId}`);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; ttl: number } {
    return guildService.getCacheStats();
  }

  /**
   * Check if database is connected
   */
  isDatabaseConnected(): boolean {
    return this.databaseConnected;
  }

  // ========== Feature Helpers ==========

  /**
   * Check if anti-nuke is enabled for a guild
   */
  async isAntinukeEnabled(guildId: string): Promise<boolean> {
    return guildService.isAntinukeEnabled(guildId);
  }

  /**
   * Enable anti-nuke protection for a guild
   */
  async enableAntinuke(guildId: string): Promise<Guild | null> {
    return guildService.enableAntinuke(guildId);
  }

  /**
   * Disable anti-nuke protection for a guild
   */
  async disableAntinuke(guildId: string): Promise<Guild | null> {
    return guildService.disableAntinuke(guildId);
  }

  /**
   * Check if a user is whitelisted
   */
  async isWhitelisted(guildId: string, userId: string): Promise<boolean> {
    return guildService.isWhitelisted(guildId, userId);
  }

  /**
   * Add user(s) to whitelist
   */
  async addToWhitelist(guildId: string, userIds: string | string[]): Promise<Guild | null> {
    return guildService.addToWhitelist(guildId, userIds);
  }

  /**
   * Remove user(s) from whitelist
   */
  async removeFromWhitelist(guildId: string, userIds: string | string[]): Promise<Guild | null> {
    return guildService.removeFromWhitelist(guildId, userIds);
  }

  // ========== Channel Helpers ==========

  /**
   * Get the logs channel for a guild
   */
  async getLogsChannel(guildId: string): Promise<string | null> {
    return guildService.getLogsChannel(guildId);
  }

  /**
   * Set the logs channel for a guild
   */
  async setLogsChannel(guildId: string, channelId: string | null): Promise<Guild | null> {
    return guildService.setLogsChannel(guildId, channelId);
  }

  /**
   * Get the mod logs channel for a guild
   */
  async getModLogsChannel(guildId: string): Promise<string | null> {
    const guild = await this.get(guildId);
    return guild?.modLogsChannel ?? null;
  }

  /**
   * Set the mod logs channel for a guild
   */
  async setModLogsChannel(guildId: string, channelId: string | null): Promise<Guild | null> {
    return guildService.setModLogsChannel(guildId, channelId);
  }

  // ========== Lifecycle ==========

  /**
   * Cleanup resources (no-op, cleanup is handled by database package)
   */
  destroy(): void {
    GuildSettingsService.instance = null;
    this.initialized = false;
    Logger.info("GuildSettings", "Service destroyed");
  }
}

/**
 * Singleton instance for easy access
 */
export const guildSettings = GuildSettingsService.getInstance();

// Re-export types for convenience
export type { Guild, GuildUpdate, ServiceResult };
