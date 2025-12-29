import { Logger } from "../structures/Logger";
import type { GuildSettings, GuildSettingsUpdate } from "../types/guild";
import { DEFAULT_GUILD_SETTINGS } from "../types/guild";

/**
 * Cache entry with TTL tracking
 */
interface CacheEntry {
  settings: GuildSettings;
  expiresAt: number;
}

/**
 * Configuration for the GuildSettingsService
 */
export interface GuildSettingsServiceConfig {
  /** Maximum number of guilds to cache (default: 1000) */
  maxCacheSize?: number;
  /** Cache TTL in milliseconds (default: 5 minutes) */
  cacheTtlMs?: number;
  /** Whether to use database (if false, in-memory only) */
  useDatabase?: boolean;
}

/**
 * Service for managing per-guild settings.
 * Provides CRUD operations with in-memory LRU caching.
 *
 * @example
 * ```typescript
 * const settings = await guildSettings.get("123456789");
 * if (settings) {
 *   console.log(settings.features.antinukeEnabled);
 * }
 *
 * await guildSettings.update("123456789", {
 *   features: { antinukeEnabled: true }
 * });
 * ```
 */
export class GuildSettingsService {
  private static instance: GuildSettingsService | null = null;

  /** LRU cache for guild settings */
  private cache: Map<string, CacheEntry> = new Map();

  /** Maximum cache size */
  private readonly maxCacheSize: number;

  /** Cache TTL in milliseconds */
  private readonly cacheTtlMs: number;

  /** Whether database is available */
  private readonly useDatabase: boolean;

  /** Prisma client (lazy loaded) */
  private prisma: unknown = null;

  /** Cleanup interval */
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  private constructor(config: GuildSettingsServiceConfig = {}) {
    this.maxCacheSize = config.maxCacheSize ?? 1000;
    this.cacheTtlMs = config.cacheTtlMs ?? 5 * 60 * 1000; // 5 minutes
    this.useDatabase = config.useDatabase ?? true;

    // Start cache cleanup interval (every minute)
    this.cleanupInterval = setInterval(() => this.cleanupExpired(), 60 * 1000);
  }

  /**
   * Get or create the singleton instance
   */
  static getInstance(config?: GuildSettingsServiceConfig): GuildSettingsService {
    if (!this.instance) {
      this.instance = new GuildSettingsService(config);
    }
    return this.instance;
  }

  /**
   * Initialize the service (load Prisma if using database)
   */
  async initialize(): Promise<void> {
    if (this.useDatabase) {
      try {
        // Dynamic import to avoid errors if database isn't set up
        const { prisma } = await import("@safeguard/database");
        this.prisma = prisma;
        Logger.success("GuildSettings", "Database connection established");
      } catch (error) {
        Logger.warn(
          "GuildSettings",
          `Database unavailable, using in-memory only: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    } else {
      Logger.info("GuildSettings", "Running in memory-only mode");
    }
  }

  /**
   * Get guild settings by ID
   * Returns null if guild not found
   */
  async get(guildId: string): Promise<GuildSettings | null> {
    // Check cache first
    const cached = this.getFromCache(guildId);
    if (cached) {
      Logger.debug("GuildSettings", `Cache hit for guild ${guildId}`);
      return cached;
    }

    // Try database
    if (this.prisma) {
      try {
        const dbGuild = await this.fetchFromDatabase(guildId);
        if (dbGuild) {
          this.setCache(guildId, dbGuild);
          return dbGuild;
        }
      } catch (error) {
        Logger.error(
          "GuildSettings",
          `Database error fetching guild ${guildId}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return null;
  }

  /**
   * Get guild settings, creating default settings if not found
   */
  async getOrCreate(guildId: string): Promise<GuildSettings> {
    const existing = await this.get(guildId);
    if (existing) return existing;

    // Create new guild with defaults
    const now = new Date();
    const newSettings: GuildSettings = {
      id: guildId,
      ...DEFAULT_GUILD_SETTINGS,
      createdAt: now,
      updatedAt: now,
    };

    // Save to database if available
    if (this.prisma) {
      try {
        await this.saveToDatabase(newSettings);
        Logger.info("GuildSettings", `Created new guild settings for ${guildId}`);
      } catch (error) {
        Logger.error(
          "GuildSettings",
          `Failed to save guild ${guildId}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Always cache
    this.setCache(guildId, newSettings);
    return newSettings;
  }

  /**
   * Update guild settings
   */
  async update(guildId: string, update: GuildSettingsUpdate): Promise<GuildSettings> {
    // Get current settings (or create if not exists)
    const current = await this.getOrCreate(guildId);

    // Merge updates
    const updated: GuildSettings = {
      ...current,
      features: { ...current.features, ...update.features },
      channels: { ...current.channels, ...update.channels },
      roles: { ...current.roles, ...update.roles },
      whitelist: update.whitelist ?? current.whitelist,
      updatedAt: new Date(),
    };

    // Save to database if available
    if (this.prisma) {
      try {
        await this.updateInDatabase(updated);
        Logger.debug("GuildSettings", `Updated guild ${guildId}`);
      } catch (error) {
        Logger.error(
          "GuildSettings",
          `Failed to update guild ${guildId}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Update cache
    this.setCache(guildId, updated);
    return updated;
  }

  /**
   * Delete guild settings
   */
  async delete(guildId: string): Promise<void> {
    // Remove from cache
    this.cache.delete(guildId);

    // Remove from database if available
    if (this.prisma) {
      try {
        await this.deleteFromDatabase(guildId);
        Logger.info("GuildSettings", `Deleted guild ${guildId}`);
      } catch (error) {
        Logger.error(
          "GuildSettings",
          `Failed to delete guild ${guildId}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * Invalidate cache for a guild
   */
  invalidateCache(guildId: string): void {
    this.cache.delete(guildId);
    Logger.debug("GuildSettings", `Cache invalidated for guild ${guildId}`);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; ttlMs: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      ttlMs: this.cacheTtlMs,
    };
  }

  /**
   * Check if database is connected
   */
  isDatabaseConnected(): boolean {
    return this.prisma !== null;
  }

  // ========== Private Methods ==========

  /**
   * Get from cache if not expired
   */
  private getFromCache(guildId: string): GuildSettings | null {
    const entry = this.cache.get(guildId);
    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(guildId);
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(guildId);
    this.cache.set(guildId, entry);

    return entry.settings;
  }

  /**
   * Set cache entry with TTL
   */
  private setCache(guildId: string, settings: GuildSettings): void {
    // Enforce max size (LRU eviction)
    if (this.cache.size >= this.maxCacheSize) {
      // Delete oldest entry (first in Map)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(guildId, {
      settings,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
  }

  /**
   * Remove expired entries from cache
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [guildId, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(guildId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      Logger.debug("GuildSettings", `Cleaned up ${cleaned} expired cache entries`);
    }
  }

  /**
   * Fetch from Prisma database
   */
  private async fetchFromDatabase(guildId: string): Promise<GuildSettings | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prisma = this.prisma as any;
    const guild = await prisma.guild.findUnique({
      where: { id: guildId },
    });

    if (!guild) return null;

    return this.mapFromDatabase(guild);
  }

  /**
   * Save new guild to database
   */
  private async saveToDatabase(settings: GuildSettings): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prisma = this.prisma as any;
    await prisma.guild.create({
      data: this.mapToDatabase(settings),
    });
  }

  /**
   * Update guild in database
   */
  private async updateInDatabase(settings: GuildSettings): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prisma = this.prisma as any;
    await prisma.guild.update({
      where: { id: settings.id },
      data: this.mapToDatabase(settings),
    });
  }

  /**
   * Delete guild from database
   */
  private async deleteFromDatabase(guildId: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prisma = this.prisma as any;
    await prisma.guild.delete({
      where: { id: guildId },
    });
  }

  /**
   * Map database model to GuildSettings
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapFromDatabase(guild: any): GuildSettings {
    return {
      id: guild.id,
      features: {
        antinukeEnabled: guild.antinuke_enabled,
        loggingEnabled: guild.logging_enabled,
        welcomeEnabled: guild.welcome_enabled,
      },
      channels: {
        logsChannel: guild.logs_channel,
        modLogsChannel: guild.mod_logs_channel,
        memberLogsChannel: guild.member_logs_channel,
      },
      roles: {
        mutedRole: guild.muted_role,
        modRole: guild.mod_role,
        adminRole: guild.admin_role,
      },
      whitelist: guild.whitelist,
      createdAt: guild.created_at,
      updatedAt: guild.updated_at,
    };
  }

  /**
   * Map GuildSettings to database model
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapToDatabase(settings: GuildSettings): any {
    return {
      id: settings.id,
      antinuke_enabled: settings.features.antinukeEnabled,
      logging_enabled: settings.features.loggingEnabled,
      welcome_enabled: settings.features.welcomeEnabled,
      logs_channel: settings.channels.logsChannel,
      mod_logs_channel: settings.channels.modLogsChannel,
      member_logs_channel: settings.channels.memberLogsChannel,
      muted_role: settings.roles.mutedRole,
      mod_role: settings.roles.modRole,
      admin_role: settings.roles.adminRole,
      whitelist: settings.whitelist,
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
    GuildSettingsService.instance = null;
    Logger.info("GuildSettings", "Service destroyed");
  }
}

/**
 * Singleton instance for easy access
 */
export const guildSettings = GuildSettingsService.getInstance();
