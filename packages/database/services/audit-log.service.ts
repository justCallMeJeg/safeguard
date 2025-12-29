/**
 * Audit Log Service - Handles all audit log database operations
 */

import type { PrismaClient } from "../generated/prisma/client.js";
import type {
  AuditLog,
  AuditLogCreate,
  AuditLogFilters,
  PaginatedResult,
  ServiceResult,
} from "../types/index.js";
import { safeExecute } from "../utils/connection.js";

/**
 * AuditLogService class for managing audit logs in the database
 */
export class AuditLogService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Create a new audit log entry
   * @param data - Audit log data
   * @returns Created audit log entry
   */
  async create(data: AuditLogCreate): Promise<AuditLog> {
    const createData: Parameters<typeof this.prisma.auditLog.create>[0]["data"] = {
      guild_id: data.guild_id,
      action: data.action,
      executor: data.executor,
      target_id: data.target_id ?? null,
      reason: data.reason ?? null,
    };

    if (data.metadata !== undefined) {
      createData.metadata = data.metadata as Parameters<
        typeof this.prisma.auditLog.create
      >[0]["data"]["metadata"];
    }

    return this.prisma.auditLog.create({ data: createData });
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
        guild_id: entry.guild_id,
        action: entry.action,
        executor: entry.executor,
        target_id: entry.target_id ?? null,
        reason: entry.reason ?? null,
      };
      if (entry.metadata !== undefined) {
        return { ...item, metadata: entry.metadata };
      }
      return item;
    });

    const result = await this.prisma.auditLog.createMany({ data });
    return result.count;
  }

  /**
   * Get an audit log entry by ID
   * @param id - Audit log ID
   * @returns Audit log entry or null
   */
  async getById(id: number): Promise<AuditLog | null> {
    return this.prisma.auditLog.findUnique({
      where: { id },
    });
  }

  /**
   * Query audit logs with filters
   * @param filters - Query filters
   * @returns Array of matching audit logs
   */
  async query(filters: AuditLogFilters = {}): Promise<AuditLog[]> {
    const where = this.buildWhereClause(filters);

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: filters.limit ?? 100,
      skip: filters.offset ?? 0,
    });
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

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: pageSize,
        skip,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

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
    return this.query({ guild_id: guildId, limit });
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
    return this.query({ executor: executorId, guild_id: guildId, limit });
  }

  /**
   * Get audit logs by action type
   * @param action - Action type to filter by
   * @param guildId - Optional guild ID to filter by
   * @param limit - Maximum number of entries to return
   * @returns Array of audit logs
   */
  async getByAction(action: string, guildId?: string, limit: number = 100): Promise<AuditLog[]> {
    return this.query({ action, guild_id: guildId, limit });
  }

  /**
   * Get audit logs within a date range
   * @param startDate - Start of date range
   * @param endDate - End of date range
   * @param guildId - Optional guild ID to filter by
   * @returns Array of audit logs
   */
  async getByDateRange(startDate: Date, endDate: Date, guildId?: string): Promise<AuditLog[]> {
    return this.query({ startDate, endDate, guild_id: guildId });
  }

  /**
   * Get recent audit logs for a guild
   * @param guildId - Discord guild ID
   * @param minutes - Number of minutes to look back
   * @returns Array of recent audit logs
   */
  async getRecent(guildId: string, minutes: number = 5): Promise<AuditLog[]> {
    const startDate = new Date(Date.now() - minutes * 60 * 1000);

    return this.prisma.auditLog.findMany({
      where: {
        guild_id: guildId,
        timestamp: { gte: startDate },
      },
      orderBy: { timestamp: "desc" },
    });
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

    return this.prisma.auditLog.count({
      where: {
        guild_id: guildId,
        executor: executorId,
        ...(action && { action }),
        timestamp: { gte: startTime },
      },
    });
  }

  /**
   * Delete audit logs older than a specified date
   * @param beforeDate - Delete logs before this date
   * @param guildId - Optional guild ID to filter by
   * @returns Count of deleted entries
   */
  async deleteOlderThan(beforeDate: Date, guildId?: string): Promise<number> {
    const result = await this.prisma.auditLog.deleteMany({
      where: {
        timestamp: { lt: beforeDate },
        ...(guildId && { guild_id: guildId }),
      },
    });

    return result.count;
  }

  /**
   * Delete all audit logs for a guild
   * @param guildId - Discord guild ID
   * @returns Count of deleted entries
   */
  async deleteByGuild(guildId: string): Promise<number> {
    const result = await this.prisma.auditLog.deleteMany({
      where: { guild_id: guildId },
    });

    return result.count;
  }

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
    const [totalLogs, logsLast24h, actionGroups, executorGroups] = await Promise.all([
      this.prisma.auditLog.count({
        where: { guild_id: guildId },
      }),
      this.prisma.auditLog.count({
        where: {
          guild_id: guildId,
          timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.auditLog.groupBy({
        by: ["action"],
        where: { guild_id: guildId },
        _count: { action: true },
      }),
      this.prisma.auditLog.groupBy({
        by: ["executor"],
        where: { guild_id: guildId },
        _count: { executor: true },
        orderBy: { _count: { executor: "desc" } },
        take: 10,
      }),
    ]);

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
  // Safe Operations
  // ===========================================================================

  /**
   * Safely create an audit log entry
   * @param data - Audit log data
   * @returns ServiceResult with created entry or error
   */
  async safeCreate(data: AuditLogCreate): Promise<ServiceResult<AuditLog>> {
    return safeExecute(() => this.create(data));
  }

  /**
   * Safely query audit logs
   * @param filters - Query filters
   * @returns ServiceResult with entries or error
   */
  async safeQuery(filters: AuditLogFilters = {}): Promise<ServiceResult<AuditLog[]>> {
    return safeExecute(() => this.query(filters));
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Build a Prisma where clause from filters
   */
  private buildWhereClause(filters: AuditLogFilters) {
    return {
      ...(filters.guild_id && { guild_id: filters.guild_id }),
      ...(filters.action && { action: filters.action }),
      ...(filters.executor && { executor: filters.executor }),
      ...(filters.target_id && { target_id: filters.target_id }),
      ...((filters.startDate || filters.endDate) && {
        timestamp: {
          ...(filters.startDate && { gte: filters.startDate }),
          ...(filters.endDate && { lte: filters.endDate }),
        },
      }),
    };
  }
}
