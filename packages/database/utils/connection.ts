/**
 * Database connection utilities and health checks
 */

import type { PrismaClient } from "../generated/prisma/client.js";
import type { HealthCheckResult } from "../types/index.js";

// Re-export circuit breaker utilities from base repository
export { CircuitBreaker, CircuitState, isRetryableError } from "../repositories/base.repository.js";

/**
 * Gracefully disconnect the Prisma client
 * @param prisma - The Prisma client instance
 * @param timeoutMs - Maximum time to wait for disconnect (default: 5000ms)
 */
export async function gracefulShutdown(
  prisma: PrismaClient,
  timeoutMs: number = 5000
): Promise<void> {
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Shutdown timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    await Promise.race([prisma.$disconnect(), timeoutPromise]);
  } catch (error) {
    // Force disconnect on timeout
    console.error("Graceful shutdown failed:", error);
    await prisma.$disconnect().catch(() => {});
  }
}

/**
 * Check if the database connection is healthy
 * @param prisma - The Prisma client instance
 * @param timeoutMs - Maximum time to wait for the health check (default: 5000ms)
 * @returns Health check result with status and latency
 */
export async function checkDatabaseHealth(
  prisma: PrismaClient,
  timeoutMs: number = 5000
): Promise<HealthCheckResult> {
  const timestamp = new Date();
  const startTime = performance.now();

  try {
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Health check timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    // Race the query against the timeout
    await Promise.race([prisma.$queryRaw`SELECT 1`, timeoutPromise]);

    const latency = Math.round(performance.now() - startTime);

    return {
      healthy: true,
      latency,
      timestamp,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp,
    };
  }
}

/**
 * Retry a database operation with exponential backoff
 * @param operation - The async operation to retry
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param baseDelayMs - Base delay between retries in ms (default: 100)
 * @returns The result of the operation
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 100
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on the last attempt
      if (attempt < maxRetries) {
        // Exponential backoff with jitter
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 100;
        await sleep(delay);
      }
    }
  }

  throw lastError ?? new Error("Operation failed after retries");
}

/**
 * Execute a database operation with a timeout
 * @param operation - The async operation to execute
 * @param timeoutMs - Maximum time to wait (default: 10000ms)
 * @returns The result of the operation
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number = 10000
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  return Promise.race([operation(), timeoutPromise]);
}

/**
 * Execute a database operation safely, returning a result object instead of throwing
 * @param operation - The async operation to execute
 * @returns A result object with success status and data or error
 */
export async function safeExecute<T>(
  operation: () => Promise<T>
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Sleep for a specified duration
 * @param ms - Duration in milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Connection pool statistics (if using pg pool)
 */
export interface PoolStats {
  totalConnections: number;
  idleConnections: number;
  waitingClients: number;
}

/**
 * Transaction wrapper for executing multiple operations atomically
 * @param prisma - The Prisma client instance
 * @param operations - Function that receives the transaction client
 * @returns The result of the transaction
 */
export async function withTransaction<T>(
  prisma: PrismaClient,
  operations: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(operations as Parameters<typeof prisma.$transaction>[0]) as Promise<T>;
}
