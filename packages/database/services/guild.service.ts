/**
 * Guild Service - Handles all guild-related database operations
 */

import type { PrismaClient } from "../generated/prisma/client.js";
import type {
  Guild,
  GuildCreate,
  GuildUpdate,
  GuildSettings,
  ServiceResult,
} from "../types/index.js";
import { LRUCache } from "../utils/cache.js";
import { safeExecute, withRetry } from "../utils/connection.js";

/**
 * Default guild settings used when creating a new guild
 */
export const DEFAULT_GUILD_SETTINGS: Omit<GuildCreate, "id"> = {
  // Feature toggles
  antinuke_enabled: false,
  logging_enabled: true,
  welcome_enabled: false,

  // Logging channels
  logs_channel: null,
  mod_logs_channel: null,
  member_logs_channel: null,

  // Roles
  muted_role: null,
  mod_role: null,
  admin_role: null,

  // Whitelist
  whitelist: [],
};

/**
 * GuildService class for managing guild settings in the database
 */
export class GuildService {
  private prisma: PrismaClient;
  private cache: LRUCache<string, Guild>;

  constructor(prisma: PrismaClient, cacheOptions?: { maxSize?: number; ttl?: number }) {
    this.prisma = prisma;
    this.cache = new LRUCache<string, Guild>({
      maxSize: cacheOptions?.maxSize ?? 1000,
      ttl: cacheOptions?.ttl ?? 5 * 60 * 1000, // 5 minutes default
      updateOnAccess: true,
    });
  }

  /**
   * Get guild settings by ID
   * @param guildId - Discord guild ID
   * @returns Guild settings or null if not found
   */
  async get(guildId: string): Promise<Guild | null> {
    // Check cache first
    const cached = this.cache.get(guildId);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const guild = await this.prisma.guild.findUnique({
      where: { id: guildId },
    });

    // Cache the result if found
    if (guild) {
      this.cache.set(guildId, guild);
    }

    return guild;
  }

  /**
   * Get guild settings with extended properties
   * @param guildId - Discord guild ID
   * @returns Extended guild settings or null if not found
   */
  async getSettings(guildId: string): Promise<GuildSettings | null> {
    const guild = await this.get(guildId);

    if (!guild) {
      return null;
    }

    return this.toGuildSettings(guild);
  }

  /**
   * Get or create guild settings
   * @param guildId - Discord guild ID
   * @returns Guild settings (creates with defaults if not exists)
   */
  async getOrCreate(guildId: string): Promise<Guild> {
    const existing = await this.get(guildId);

    if (existing) {
      return existing;
    }

    return this.create({ id: guildId });
  }

  /**
   * Create new guild settings
   * @param data - Guild creation data
   * @returns Created guild
   */
  async create(data: GuildCreate): Promise<Guild> {
    const guild = await this.prisma.guild.create({
      data: {
        id: data.id,
        // Feature toggles
        antinuke_enabled: data.antinuke_enabled ?? DEFAULT_GUILD_SETTINGS.antinuke_enabled,
        logging_enabled: data.logging_enabled ?? DEFAULT_GUILD_SETTINGS.logging_enabled,
        welcome_enabled: data.welcome_enabled ?? DEFAULT_GUILD_SETTINGS.welcome_enabled,
        // Logging channels
        logs_channel: data.logs_channel ?? DEFAULT_GUILD_SETTINGS.logs_channel,
        mod_logs_channel: data.mod_logs_channel ?? DEFAULT_GUILD_SETTINGS.mod_logs_channel,
        member_logs_channel: data.member_logs_channel ?? DEFAULT_GUILD_SETTINGS.member_logs_channel,
        // Roles
        muted_role: data.muted_role ?? DEFAULT_GUILD_SETTINGS.muted_role,
        mod_role: data.mod_role ?? DEFAULT_GUILD_SETTINGS.mod_role,
        admin_role: data.admin_role ?? DEFAULT_GUILD_SETTINGS.admin_role,
        // Whitelist
        whitelist: data.whitelist ?? DEFAULT_GUILD_SETTINGS.whitelist,
      },
    });

    // Cache the new guild
    this.cache.set(guild.id, guild);

    return guild;
  }

  /**
   * Update guild settings
   * @param guildId - Discord guild ID
   * @param data - Update data
   * @returns Updated guild or null if not found
   */
  async update(guildId: string, data: GuildUpdate): Promise<Guild | null> {
    try {
      const guild = await this.prisma.guild.update({
        where: { id: guildId },
        data,
      });

      // Update cache
      this.cache.set(guildId, guild);

      return guild;
    } catch (error) {
      // Handle case where guild doesn't exist
      if (this.isPrismaNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Upsert guild settings (create or update)
   * @param guildId - Discord guild ID
   * @param data - Guild data
   * @returns Upserted guild
   */
  async upsert(guildId: string, data: GuildUpdate): Promise<Guild> {
    const guild = await this.prisma.guild.upsert({
      where: { id: guildId },
      update: data,
      create: {
        id: guildId,
        // Feature toggles
        antinuke_enabled: data.antinuke_enabled ?? DEFAULT_GUILD_SETTINGS.antinuke_enabled,
        logging_enabled: data.logging_enabled ?? DEFAULT_GUILD_SETTINGS.logging_enabled,
        welcome_enabled: data.welcome_enabled ?? DEFAULT_GUILD_SETTINGS.welcome_enabled,
        // Logging channels
        logs_channel: data.logs_channel ?? DEFAULT_GUILD_SETTINGS.logs_channel,
        mod_logs_channel: data.mod_logs_channel ?? DEFAULT_GUILD_SETTINGS.mod_logs_channel,
        member_logs_channel: data.member_logs_channel ?? DEFAULT_GUILD_SETTINGS.member_logs_channel,
        // Roles
        muted_role: data.muted_role ?? DEFAULT_GUILD_SETTINGS.muted_role,
        mod_role: data.mod_role ?? DEFAULT_GUILD_SETTINGS.mod_role,
        admin_role: data.admin_role ?? DEFAULT_GUILD_SETTINGS.admin_role,
        // Whitelist
        whitelist: data.whitelist ?? DEFAULT_GUILD_SETTINGS.whitelist,
      },
    });

    // Update cache
    this.cache.set(guildId, guild);

    return guild;
  }

  /**
   * Delete guild settings
   * @param guildId - Discord guild ID
   * @returns True if deleted, false if not found
   */
  async delete(guildId: string): Promise<boolean> {
    try {
      await this.prisma.guild.delete({
        where: { id: guildId },
      });

      // Remove from cache
      this.cache.delete(guildId);

      return true;
    } catch (error) {
      if (this.isPrismaNotFoundError(error)) {
        return false;
      }
      throw error;
    }
  }

  // ===========================================================================
  // Whitelist Management
  // ===========================================================================

  /**
   * Add user(s) to the guild whitelist
   * @param guildId - Discord guild ID
   * @param userIds - User ID(s) to add
   * @returns Updated guild or null if not found
   */
  async addToWhitelist(guildId: string, userIds: string | string[]): Promise<Guild | null> {
    const guild = await this.get(guildId);

    if (!guild) {
      return null;
    }

    const idsToAdd = Array.isArray(userIds) ? userIds : [userIds];
    const newWhitelist = [...new Set([...guild.whitelist, ...idsToAdd])];

    return this.update(guildId, { whitelist: newWhitelist });
  }

  /**
   * Remove user(s) from the guild whitelist
   * @param guildId - Discord guild ID
   * @param userIds - User ID(s) to remove
   * @returns Updated guild or null if not found
   */
  async removeFromWhitelist(guildId: string, userIds: string | string[]): Promise<Guild | null> {
    const guild = await this.get(guildId);

    if (!guild) {
      return null;
    }

    const idsToRemove = new Set(Array.isArray(userIds) ? userIds : [userIds]);
    const newWhitelist = guild.whitelist.filter((id: string) => !idsToRemove.has(id));

    return this.update(guildId, { whitelist: newWhitelist });
  }

  /**
   * Check if a user is whitelisted in a guild
   * @param guildId - Discord guild ID
   * @param userId - User ID to check
   * @returns True if whitelisted, false otherwise
   */
  async isWhitelisted(guildId: string, userId: string): Promise<boolean> {
    const guild = await this.get(guildId);

    if (!guild) {
      return false;
    }

    return guild.whitelist.includes(userId);
  }

  // ===========================================================================
  // Anti-nuke Settings
  // ===========================================================================

  /**
   * Enable anti-nuke protection for a guild
   * @param guildId - Discord guild ID
   * @returns Updated guild or null if not found
   */
  async enableAntinuke(guildId: string): Promise<Guild | null> {
    return this.update(guildId, { antinuke_enabled: true });
  }

  /**
   * Disable anti-nuke protection for a guild
   * @param guildId - Discord guild ID
   * @returns Updated guild or null if not found
   */
  async disableAntinuke(guildId: string): Promise<Guild | null> {
    return this.update(guildId, { antinuke_enabled: false });
  }

  /**
   * Check if anti-nuke is enabled for a guild
   * @param guildId - Discord guild ID
   * @returns True if enabled, false otherwise (including if guild not found)
   */
  async isAntinukeEnabled(guildId: string): Promise<boolean> {
    const guild = await this.get(guildId);
    return guild?.antinuke_enabled ?? false;
  }

  // ===========================================================================
  // Logs Channel
  // ===========================================================================

  /**
   * Set the logs channel for a guild
   * @param guildId - Discord guild ID
   * @param channelId - Channel ID to set (or null to clear)
   * @returns Updated guild or null if not found
   */
  async setLogsChannel(guildId: string, channelId: string | null): Promise<Guild | null> {
    return this.update(guildId, { logs_channel: channelId });
  }

  /**
   * Get the logs channel for a guild
   * @param guildId - Discord guild ID
   * @returns Channel ID or null if not set/guild not found
   */
  async getLogsChannel(guildId: string): Promise<string | null> {
    const guild = await this.get(guildId);
    return guild?.logs_channel ?? null;
  }

  /**
   * Set the mod logs channel for a guild
   * @param guildId - Discord guild ID
   * @param channelId - Channel ID to set (or null to clear)
   * @returns Updated guild or null if not found
   */
  async setModLogsChannel(guildId: string, channelId: string | null): Promise<Guild | null> {
    return this.update(guildId, { mod_logs_channel: channelId });
  }

  /**
   * Set the member logs channel for a guild
   * @param guildId - Discord guild ID
   * @param channelId - Channel ID to set (or null to clear)
   * @returns Updated guild or null if not found
   */
  async setMemberLogsChannel(guildId: string, channelId: string | null): Promise<Guild | null> {
    return this.update(guildId, { member_logs_channel: channelId });
  }

  // ===========================================================================
  // Logging Feature
  // ===========================================================================

  /**
   * Enable logging for a guild
   * @param guildId - Discord guild ID
   * @returns Updated guild or null if not found
   */
  async enableLogging(guildId: string): Promise<Guild | null> {
    return this.update(guildId, { logging_enabled: true });
  }

  /**
   * Disable logging for a guild
   * @param guildId - Discord guild ID
   * @returns Updated guild or null if not found
   */
  async disableLogging(guildId: string): Promise<Guild | null> {
    return this.update(guildId, { logging_enabled: false });
  }

  /**
   * Check if logging is enabled for a guild
   * @param guildId - Discord guild ID
   * @returns True if enabled, false otherwise
   */
  async isLoggingEnabled(guildId: string): Promise<boolean> {
    const guild = await this.get(guildId);
    return guild?.logging_enabled ?? false;
  }

  // ===========================================================================
  // Welcome Feature
  // ===========================================================================

  /**
   * Enable welcome messages for a guild
   * @param guildId - Discord guild ID
   * @returns Updated guild or null if not found
   */
  async enableWelcome(guildId: string): Promise<Guild | null> {
    return this.update(guildId, { welcome_enabled: true });
  }

  /**
   * Disable welcome messages for a guild
   * @param guildId - Discord guild ID
   * @returns Updated guild or null if not found
   */
  async disableWelcome(guildId: string): Promise<Guild | null> {
    return this.update(guildId, { welcome_enabled: false });
  }

  /**
   * Check if welcome is enabled for a guild
   * @param guildId - Discord guild ID
   * @returns True if enabled, false otherwise
   */
  async isWelcomeEnabled(guildId: string): Promise<boolean> {
    const guild = await this.get(guildId);
    return guild?.welcome_enabled ?? false;
  }

  // ===========================================================================
  // Role Management
  // ===========================================================================

  /**
   * Set the muted role for a guild
   * @param guildId - Discord guild ID
   * @param roleId - Role ID to set (or null to clear)
   * @returns Updated guild or null if not found
   */
  async setMutedRole(guildId: string, roleId: string | null): Promise<Guild | null> {
    return this.update(guildId, { muted_role: roleId });
  }

  /**
   * Get the muted role for a guild
   * @param guildId - Discord guild ID
   * @returns Role ID or null if not set/guild not found
   */
  async getMutedRole(guildId: string): Promise<string | null> {
    const guild = await this.get(guildId);
    return guild?.muted_role ?? null;
  }

  /**
   * Set the mod role for a guild
   * @param guildId - Discord guild ID
   * @param roleId - Role ID to set (or null to clear)
   * @returns Updated guild or null if not found
   */
  async setModRole(guildId: string, roleId: string | null): Promise<Guild | null> {
    return this.update(guildId, { mod_role: roleId });
  }

  /**
   * Get the mod role for a guild
   * @param guildId - Discord guild ID
   * @returns Role ID or null if not set/guild not found
   */
  async getModRole(guildId: string): Promise<string | null> {
    const guild = await this.get(guildId);
    return guild?.mod_role ?? null;
  }

  /**
   * Set the admin role for a guild
   * @param guildId - Discord guild ID
   * @param roleId - Role ID to set (or null to clear)
   * @returns Updated guild or null if not found
   */
  async setAdminRole(guildId: string, roleId: string | null): Promise<Guild | null> {
    return this.update(guildId, { admin_role: roleId });
  }

  /**
   * Get the admin role for a guild
   * @param guildId - Discord guild ID
   * @returns Role ID or null if not set/guild not found
   */
  async getAdminRole(guildId: string): Promise<string | null> {
    const guild = await this.get(guildId);
    return guild?.admin_role ?? null;
  }

  // ===========================================================================
  // Bulk Operations
  // ===========================================================================

  /**
   * Get multiple guilds by IDs
   * @param guildIds - Array of guild IDs
   * @returns Map of guild ID to guild
   */
  async getMany(guildIds: string[]): Promise<Map<string, Guild>> {
    const result = new Map<string, Guild>();
    const uncachedIds: string[] = [];

    // Check cache first
    for (const id of guildIds) {
      const cached = this.cache.get(id);
      if (cached) {
        result.set(id, cached);
      } else {
        uncachedIds.push(id);
      }
    }

    // Fetch uncached from database
    if (uncachedIds.length > 0) {
      const guilds = await this.prisma.guild.findMany({
        where: { id: { in: uncachedIds } },
      });

      for (const guild of guilds) {
        this.cache.set(guild.id, guild);
        result.set(guild.id, guild);
      }
    }

    return result;
  }

  /**
   * Count total guilds in the database
   * @returns Total count
   */
  async count(): Promise<number> {
    return this.prisma.guild.count();
  }

  // ===========================================================================
  // Safe Operations (with error handling)
  // ===========================================================================

  /**
   * Safely get guild settings with error handling
   * @param guildId - Discord guild ID
   * @returns ServiceResult with guild or error
   */
  async safeGet(guildId: string): Promise<ServiceResult<Guild | null>> {
    return safeExecute(() => this.get(guildId));
  }

  /**
   * Safely get or create guild settings with retry
   * @param guildId - Discord guild ID
   * @returns Guild settings
   */
  async safeGetOrCreate(guildId: string): Promise<ServiceResult<Guild>> {
    return safeExecute(() => withRetry(() => this.getOrCreate(guildId)));
  }

  // ===========================================================================
  // Cache Management
  // ===========================================================================

  /**
   * Invalidate cache for a guild
   * @param guildId - Discord guild ID
   */
  invalidateCache(guildId: string): void {
    this.cache.delete(guildId);
  }

  /**
   * Clear entire cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; ttl: number } {
    return this.cache.stats();
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Convert a Guild to GuildSettings with computed properties
   */
  private toGuildSettings(guild: Guild): GuildSettings {
    const hasFeatures = guild.antinuke_enabled || guild.welcome_enabled;
    const hasChannels =
      guild.logs_channel !== null ||
      guild.mod_logs_channel !== null ||
      guild.member_logs_channel !== null;
    const hasRoles =
      guild.muted_role !== null || guild.mod_role !== null || guild.admin_role !== null;
    const hasWhitelist = guild.whitelist.length > 0;

    return {
      ...guild,
      isConfigured: hasFeatures || hasChannels || hasRoles || hasWhitelist,
    };
  }

  /**
   * Check if an error is a Prisma "not found" error
   */
  private isPrismaNotFoundError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    );
  }
}
