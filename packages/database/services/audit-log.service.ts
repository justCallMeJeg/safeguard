/**
 * Audit Log Service - Handles all audit log database operations
 * Extends BaseRepository for resilient database operations
 */

import type { PrismaClient } from "../generated/prisma/client.js";
import type {
  AuditLog,
  AuditLogCreate,
  AuditLogFilters,
  PaginatedResult,
  ServiceResult,
} from "../types/index.js";
import { BaseRepository, type RepositoryConfig } from "../repositories/base.repository.js";

/**
 * Configuration options for AuditLogService
 */
export interface AuditLogServiceConfig extends RepositoryConfig {
  /** Default query limit (default: 100) */
  defaultQueryLimit?: number;
  /** Extended timeout for statistics queries in ms (default: 30000) */
  statsTimeoutMs?: number;
}

/**
 * AuditLogService class for managing audit logs in the database
 * Extends BaseRepository for automatic retry, timeout, and circuit breaker protection
 */
export class AuditLogService extends BaseRepository<AuditLog> {
  private readonly defaultQueryLimit: number;
  private readonly statsTimeoutMs: number;

  constructor(prisma: PrismaClient, config?: AuditLogServiceConfig) {
    super(prisma, config);
    this.defaultQueryLimit = config?.defaultQueryLimit ?? 100;
    this.statsTimeoutMs = config?.statsTimeoutMs ?? 30000;
  }

  // ===========================================================================
  // Create Operations
  // ===========================================================================

  /**
   * Create a new audit log entry
   * @param data - Audit log data
   * @returns Created audit log entry
   */
  async create(data: AuditLogCreate): Promise<AuditLog> {
    const createData: Parameters<typeof this.prisma.auditLog.create>[0]["data"] = {
      guildId: data.guildId,
      action: data.action,
      executor: data.executor,
      targetId: data.targetId ?? null,
      reason: data.reason ?? null,
    };

    if (data.metadata !== undefined) {
      createData.metadata = data.metadata as Parameters<
        typeof this.prisma.auditLog.create
      >[0]["data"]["metadata"];
    }

    return this.executeWithResilience(() => this.prisma.auditLog.create({ data: createData }));
  }

  /**
   * Create multiple audit log entries at once
   * @param entries - Array of audit log data
   * @returns Count of created entries
   */
  async createMany(entries: AuditLogCreate[]): Promise<number> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = entries.map((entry): any => {
      const item = {
        guildId: entry.guildId,
        action: entry.action,
        executor: entry.executor,
        targetId: entry.targetId ?? null,
        reason: entry.reason ?? null,
      };
      if (entry.metadata !== undefined) {
        return { ...item, metadata: entry.metadata };
      }
      return item;
    });

    const result = await this.executeWithResilience(() =>
      this.prisma.auditLog.createMany({ data })
    );
    return result.count;
  }

  // ===========================================================================
  // Read Operations
  // ===========================================================================

  /**
   * Get an audit log entry by ID
   * @param id - Audit log ID
   * @returns Audit log entry or null
   */
  async getById(id: number): Promise<AuditLog | null> {
    return this.executeWithResilience(() =>
      this.prisma.auditLog.findUnique({
        where: { id },
      })
    );
  }

  /**
   * Query audit logs with filters
   * @param filters - Query filters
   * @returns Array of matching audit logs
   */
  async query(filters: AuditLogFilters = {}): Promise<AuditLog[]> {
    const where = this.buildWhereClause(filters);

    return this.executeWithResilience(() =>
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: filters.limit ?? this.defaultQueryLimit,
        skip: filters.offset ?? 0,
      })
    );
  }

  /**
   * Query audit logs with pagination
   * @param filters - Query filters including pagination
   * @returns Paginated result
   */
  async queryPaginated(
    filters: AuditLogFilters & { page?: number; pageSize?: number } = {}
  ): Promise<PaginatedResult<AuditLog>> {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where = this.buildWhereClause(filters);

    const [data, total] = await this.executeWithResilience(() =>
      Promise.all([
        this.prisma.auditLog.findMany({
          where,
          orderBy: { timestamp: "desc" },
          take: pageSize,
          skip,
        }),
        this.prisma.auditLog.count({ where }),
      ])
    );

    const totalPages = Math.ceil(total / pageSize);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }

  /**
   * Get audit logs for a specific guild
   * @param guildId - Discord guild ID
   * @param limit - Maximum number of entries to return
   * @returns Array of audit logs
   */
  async getByGuild(guildId: string, limit: number = 100): Promise<AuditLog[]> {
    return this.query({ guildId, limit });
  }

  /**
   * Get audit logs by executor
   * @param executorId - Discord user ID of executor
   * @param guildId - Optional guild ID to filter by
   * @param limit - Maximum number of entries to return
   * @returns Array of audit logs
   */
  async getByExecutor(
    executorId: string,
    guildId?: string,
    limit: number = 100
  ): Promise<AuditLog[]> {
    return this.query({ executor: executorId, guildId, limit });
  }

  /**
   * Get audit logs by action type
   * @param action - Action type to filter by
   * @param guildId - Optional guild ID to filter by
   * @param limit - Maximum number of entries to return
   * @returns Array of audit logs
   */
  async getByAction(action: string, guildId?: string, limit: number = 100): Promise<AuditLog[]> {
    return this.query({ action, guildId, limit });
  }

  /**
   * Get audit logs within a date range
   * @param startDate - Start of date range
   * @param endDate - End of date range
   * @param guildId - Optional guild ID to filter by
   * @returns Array of audit logs
   */
  async getByDateRange(startDate: Date, endDate: Date, guildId?: string): Promise<AuditLog[]> {
    return this.query({ startDate, endDate, guildId });
  }

  /**
   * Get recent audit logs for a guild
   * @param guildId - Discord guild ID
   * @param minutes - Number of minutes to look back
   * @returns Array of recent audit logs
   */
  async getRecent(guildId: string, minutes: number = 5): Promise<AuditLog[]> {
    const startDate = new Date(Date.now() - minutes * 60 * 1000);

    return this.executeWithResilience(() =>
      this.prisma.auditLog.findMany({
        where: {
          guildId,
          timestamp: { gte: startDate },
        },
        orderBy: { timestamp: "desc" },
      })
    );
  }

  /**
   * Count actions by an executor in a time window (for rate limiting/detection)
   * @param guildId - Discord guild ID
   * @param executorId - User ID of executor
   * @param action - Optional action type to count
   * @param windowMs - Time window in milliseconds
   * @returns Count of actions
   */
  async countActionsInWindow(
    guildId: string,
    executorId: string,
    action?: string,
    windowMs: number = 60000
  ): Promise<number> {
    const startTime = new Date(Date.now() - windowMs);

    return this.executeWithResilience(() =>
      this.prisma.auditLog.count({
        where: {
          guildId,
          executor: executorId,
          ...(action && { action }),
          timestamp: { gte: startTime },
        },
      })
    );
  }

  // ===========================================================================
  // Delete Operations
  // ===========================================================================

  /**
   * Delete audit logs older than a specified date
   * @param beforeDate - Delete logs before this date
   * @param guildId - Optional guild ID to filter by
   * @returns Count of deleted entries
   */
  async deleteOlderThan(beforeDate: Date, guildId?: string): Promise<number> {
    const result = await this.executeWithResilience(() =>
      this.prisma.auditLog.deleteMany({
        where: {
          timestamp: { lt: beforeDate },
          ...(guildId && { guildId }),
        },
      })
    );

    return result.count;
  }

  /**
   * Delete all audit logs for a guild
   * @param guildId - Discord guild ID
   * @returns Count of deleted entries
   */
  async deleteByGuild(guildId: string): Promise<number> {
    const result = await this.executeWithResilience(() =>
      this.prisma.auditLog.deleteMany({
        where: { guildId },
      })
    );

    return result.count;
  }

  // ===========================================================================
  // Statistics (with extended timeout)
  // ===========================================================================

  /**
   * Get statistics for a guild
   * @param guildId - Discord guild ID
   * @returns Statistics object
   */
  async getGuildStats(guildId: string): Promise<{
    totalLogs: number;
    actionBreakdown: Record<string, number>;
    topExecutors: Array<{ executor: string; count: number }>;
    logsLast24h: number;
  }> {
    // Use extended timeout for complex aggregation queries
    const [totalLogs, logsLast24h, actionGroups, executorGroups] = await this.executeWithResilience(
      () =>
        Promise.all([
          this.prisma.auditLog.count({
            where: { guildId },
          }),
          this.prisma.auditLog.count({
            where: {
              guildId,
              timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            },
          }),
          this.prisma.auditLog.groupBy({
            by: ["action"],
            where: { guildId },
            _count: { action: true },
          }),
          this.prisma.auditLog.groupBy({
            by: ["executor"],
            where: { guildId },
            _count: { executor: true },
            orderBy: { _count: { executor: "desc" } },
            take: 10,
          }),
        ]),
      { timeoutMs: this.statsTimeoutMs }
    );

    const actionBreakdown: Record<string, number> = {};
    for (const group of actionGroups) {
      actionBreakdown[group.action] = group._count.action;
    }

    const topExecutors = executorGroups.map(
      (group: { executor: string; _count: { executor: number } }) => ({
        executor: group.executor,
        count: group._count.executor,
      })
    );

    return {
      totalLogs,
      actionBreakdown,
      topExecutors,
      logsLast24h,
    };
  }

  // ===========================================================================
  // Safe Operations - Preserved for backward compatibility
  // ===========================================================================

  /**
   * Safely create an audit log entry
   * @param data - Audit log data
   * @returns ServiceResult with created entry or error
   */
  async safeCreate(data: AuditLogCreate): Promise<ServiceResult<AuditLog>> {
    return this.executeSafe(() => this.create(data));
  }

  /**
   * Safely query audit logs
   * @param filters - Query filters
   * @returns ServiceResult with entries or error
   */
  async safeQuery(filters: AuditLogFilters = {}): Promise<ServiceResult<AuditLog[]>> {
    return this.executeSafe(() => this.query(filters));
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Build a Prisma where clause from filters
   */
  private buildWhereClause(filters: AuditLogFilters) {
    return {
      ...(filters.guildId && { guildId: filters.guildId }),
      ...(filters.action && { action: filters.action }),
      ...(filters.executor && { executor: filters.executor }),
      ...(filters.targetId && { targetId: filters.targetId }),
      ...((filters.startDate || filters.endDate) && {
        timestamp: {
          ...(filters.startDate && { gte: filters.startDate }),
          ...(filters.endDate && { lte: filters.endDate }),
        },
      }),
    };
  }
}
