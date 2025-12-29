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
  antinukeEnabled: boolean;
  loggingEnabled: boolean;
  welcomeEnabled: boolean;

  // Logging channels
  logsChannel: string | null;
  modLogsChannel: string | null;
  memberLogsChannel: string | null;

  // Roles
  mutedRole: string | null;
  modRole: string | null;
  adminRole: string | null;

  // Whitelist
  whitelist: string[];

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * AuditLog model type matching the Prisma schema
 * Note: metadata uses 'unknown' for compatibility with Prisma's JsonValue
 */
export interface AuditLog {
  id: number;
  guildId: string;
  action: string;
  executor: string;
  targetId: string | null;
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
  antinukeEnabled?: boolean;
  loggingEnabled?: boolean;
  welcomeEnabled?: boolean;

  // Logging channels
  logsChannel?: string | null;
  modLogsChannel?: string | null;
  memberLogsChannel?: string | null;

  // Roles
  mutedRole?: string | null;
  modRole?: string | null;
  adminRole?: string | null;

  // Whitelist
  whitelist?: string[];
}

/**
 * Guild settings for update
 */
export interface GuildUpdate {
  // Feature toggles
  antinukeEnabled?: boolean;
  loggingEnabled?: boolean;
  welcomeEnabled?: boolean;

  // Logging channels
  logsChannel?: string | null;
  modLogsChannel?: string | null;
  memberLogsChannel?: string | null;

  // Roles
  mutedRole?: string | null;
  modRole?: string | null;
  adminRole?: string | null;

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

/**
 * Default guild settings used when creating a new guild
 */
export const DEFAULT_GUILD_SETTINGS: Omit<GuildCreate, "id"> = {
  // Feature toggles
  antinukeEnabled: false,
  loggingEnabled: true,
  welcomeEnabled: false,

  // Logging channels
  logsChannel: null,
  modLogsChannel: null,
  memberLogsChannel: null,

  // Roles
  mutedRole: null,
  modRole: null,
  adminRole: null,

  // Whitelist
  whitelist: [],
};

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
  guildId: string;
  action: AuditAction | string;
  executor: string;
  targetId?: string | null;
  reason?: string | null;
  metadata?: unknown;
}

/**
 * Audit log query filters
 */
export interface AuditLogFilters {
  guildId?: string;
  action?: AuditAction | string;
  executor?: string;
  targetId?: string;
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
