import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

// ============================================================================
// Prisma Client Setup
// ============================================================================

export { PrismaClient };

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL!;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ============================================================================
// Types
// ============================================================================

export * from "./types/index.js";

// ============================================================================
// Utilities
// ============================================================================

export * from "./utils/index.js";

// ============================================================================
// Repositories
// ============================================================================

export * from "./repositories/index.js";

// ============================================================================
// Services
// ============================================================================

export * from "./services/index.js";

// ============================================================================
// Pre-configured Service Instances
// ============================================================================

import { GuildService } from "./services/guild.service.js";
import { AuditLogService } from "./services/audit-log.service.js";
import { gracefulShutdown } from "./utils/connection.js";

const globalForServices = globalThis as unknown as {
  guildService: GuildService;
  auditLogService: AuditLogService;
};

/**
 * Pre-configured GuildService instance using the shared Prisma client
 */
export const guildService = globalForServices.guildService ?? new GuildService(prisma);

/**
 * Pre-configured AuditLogService instance using the shared Prisma client
 */
export const auditLogService = globalForServices.auditLogService ?? new AuditLogService(prisma);

if (process.env.NODE_ENV !== "production") {
  globalForServices.guildService = guildService;
  globalForServices.auditLogService = auditLogService;
}

// ============================================================================
// Lifecycle Management
// ============================================================================

/**
 * Gracefully shutdown database connections
 * Call this when your application is shutting down
 */
export async function shutdown(): Promise<void> {
  // Reset circuit breakers
  guildService.resetCircuit();
  auditLogService.resetCircuit();

  // Disconnect Prisma
  await gracefulShutdown(prisma);
}
