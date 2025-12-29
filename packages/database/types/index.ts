/**
 * Type definitions for Safeguard database operations
 */

// ============================================================================
// Prisma Model Types (defined locally for type safety)
// ============================================================================

/**
 * Guild model type matching the Prisma schema
 */
export interface Guild {
  id: string;

  // Feature toggles
  antinuke_enabled: boolean;
  logging_enabled: boolean;
  welcome_enabled: boolean;

  // Logging channels
  logs_channel: string | null;
  mod_logs_channel: string | null;
  member_logs_channel: string | null;

  // Roles
  muted_role: string | null;
  mod_role: string | null;
  admin_role: string | null;

  // Whitelist
  whitelist: string[];

  // Timestamps
  created_at: Date;
  updated_at: Date;
}

/**
 * AuditLog model type matching the Prisma schema
 * Note: metadata uses 'unknown' for compatibility with Prisma's JsonValue
 */
export interface AuditLog {
  id: number;
  guild_id: string;
  action: string;
  executor: string;
  target_id: string | null;
  reason: string | null;
  metadata: unknown;
  timestamp: Date;
}

// ============================================================================
// Guild Settings Types
// ============================================================================

/**
 * Guild settings for creation
 */
export interface GuildCreate {
  id: string;

  // Feature toggles
  antinuke_enabled?: boolean;
  logging_enabled?: boolean;
  welcome_enabled?: boolean;

  // Logging channels
  logs_channel?: string | null;
  mod_logs_channel?: string | null;
  member_logs_channel?: string | null;

  // Roles
  muted_role?: string | null;
  mod_role?: string | null;
  admin_role?: string | null;

  // Whitelist
  whitelist?: string[];
}

/**
 * Guild settings for update
 */
export interface GuildUpdate {
  // Feature toggles
  antinuke_enabled?: boolean;
  logging_enabled?: boolean;
  welcome_enabled?: boolean;

  // Logging channels
  logs_channel?: string | null;
  mod_logs_channel?: string | null;
  member_logs_channel?: string | null;

  // Roles
  muted_role?: string | null;
  mod_role?: string | null;
  admin_role?: string | null;

  // Whitelist
  whitelist?: string[];
}

/**
 * Extended guild settings with computed properties
 */
export interface GuildSettings extends Guild {
  /** Whether the guild has any configuration beyond defaults */
  isConfigured: boolean;
}

// ============================================================================
// Audit Log Types
// ============================================================================

/**
 * Audit action types
 */
export type AuditAction =
  | "MEMBER_BAN"
  | "MEMBER_KICK"
  | "MEMBER_TIMEOUT"
  | "ROLE_CREATE"
  | "ROLE_DELETE"
  | "ROLE_UPDATE"
  | "CHANNEL_CREATE"
  | "CHANNEL_DELETE"
  | "CHANNEL_UPDATE"
  | "GUILD_UPDATE"
  | "MEMBER_ROLE_UPDATE"
  | "WEBHOOK_CREATE"
  | "WEBHOOK_DELETE"
  | "BOT_ADD"
  | "ANTINUKE_TRIGGERED"
  | "SETTINGS_UPDATE"
  | "WHITELIST_ADD"
  | "WHITELIST_REMOVE";

/**
 * Audit log entry for creation
 */
export interface AuditLogCreate {
  guild_id: string;
  action: AuditAction | string;
  executor: string;
  target_id?: string | null;
  reason?: string | null;
  metadata?: unknown;
}

/**
 * Audit log query filters
 */
export interface AuditLogFilters {
  guild_id?: string;
  action?: AuditAction | string;
  executor?: string;
  target_id?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Cache Types
// ============================================================================

/**
 * Cache entry with TTL
 */
export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Cache configuration options
 */
export interface CacheOptions {
  /** Maximum number of entries in the cache */
  maxSize: number;
  /** Time-to-live in milliseconds */
  ttl: number;
  /** Whether to update TTL on access */
  updateOnAccess?: boolean;
}

// ============================================================================
// Service Result Types
// ============================================================================

/**
 * Generic result type for service operations
 */
export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// ============================================================================
// Database Health Types
// ============================================================================

/**
 * Database health check result
 */
export interface HealthCheckResult {
  healthy: boolean;
  latency?: number;
  error?: string;
  timestamp: Date;
}
