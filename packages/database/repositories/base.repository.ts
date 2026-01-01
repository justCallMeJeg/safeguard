/**
 * Base Repository - Abstract class providing resilient database operations
 *
 * Features:
 * - Automatic retry with exponential backoff for transient failures
 * - Circuit breaker pattern to prevent cascading failures
 * - Configurable timeouts for all operations
 * - Connection health tracking
 */

import type { PrismaClient } from "../generated/prisma/client.js";

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration options for repository resilience features
 */
export interface RepositoryConfig {
  /** Maximum retry attempts for transient failures (default: 3) */
  maxRetries?: number;
  /** Base delay in ms for retry backoff (default: 100) */
  baseRetryDelayMs?: number;
  /** Default timeout for operations in ms (default: 10000) */
  defaultTimeoutMs?: number;
  /** Circuit breaker failure threshold (default: 5) */
  circuitBreakerThreshold?: number;
  /** Circuit breaker reset timeout in ms (default: 30000) */
  circuitBreakerResetMs?: number;
}

const DEFAULT_CONFIG: Required<RepositoryConfig> = {
  maxRetries: 3,
  baseRetryDelayMs: 100,
  defaultTimeoutMs: 10000,
  circuitBreakerThreshold: 5,
  circuitBreakerResetMs: 30000,
};

// ============================================================================
// Circuit Breaker
// ============================================================================

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = "CLOSED", // Normal operation
  OPEN = "OPEN", // Failing, reject requests
  HALF_OPEN = "HALF_OPEN", // Testing if service recovered
}

/**
 * Circuit breaker for database connection protection
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly threshold: number;
  private readonly resetTimeoutMs: number;

  constructor(threshold: number = 5, resetTimeoutMs: number = 30000) {
    this.threshold = threshold;
    this.resetTimeoutMs = resetTimeoutMs;
  }

  /**
   * Check if circuit allows execution
   */
  canExecute(): boolean {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      // Check if reset timeout has passed
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = CircuitState.HALF_OPEN;
        return true;
      }
      return false;
    }

    // HALF_OPEN: allow one request to test
    return true;
  }

  /**
   * Record a successful execution
   */
  recordSuccess(): void {
    this.failureCount = 0;
    this.state = CircuitState.CLOSED;
  }

  /**
   * Record a failed execution
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = CircuitState.OPEN;
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}

// ============================================================================
// Retryable Error Detection
// ============================================================================

/**
 * Prisma error codes that are safe to retry
 */
const RETRYABLE_PRISMA_CODES = new Set([
  "P1001", // Can't reach database server
  "P1002", // Database server timeout
  "P1008", // Operations timed out
  "P1017", // Server has closed the connection
  "P2024", // Timed out fetching connection from pool
]);

/**
 * Check if an error is retryable (transient failure)
 */
export function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  // Check for Prisma error codes
  if ("code" in error && typeof (error as { code: unknown }).code === "string") {
    const code = (error as { code: string }).code;
    if (RETRYABLE_PRISMA_CODES.has(code)) {
      return true;
    }
  }

  // Check for common network/connection errors
  if ("message" in error && typeof (error as { message: unknown }).message === "string") {
    const message = (error as { message: string }).message.toLowerCase();
    const retryableMessages = [
      "connection",
      "timeout",
      "econnrefused",
      "econnreset",
      "epipe",
      "network",
    ];
    return retryableMessages.some((m) => message.includes(m));
  }

  return false;
}

// ============================================================================
// Base Repository
// ============================================================================

/**
 * Abstract base repository providing resilient database operations
 *
 * @template TModel - The model type returned by queries
 */
export abstract class BaseRepository<_TModel = unknown> {
  protected readonly prisma: PrismaClient;
  protected readonly config: Required<RepositoryConfig>;
  protected readonly circuitBreaker: CircuitBreaker;

  constructor(prisma: PrismaClient, config?: RepositoryConfig) {
    this.prisma = prisma;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.circuitBreaker = new CircuitBreaker(
      this.config.circuitBreakerThreshold,
      this.config.circuitBreakerResetMs
    );
  }

  /**
   * Execute an operation with full resilience (retry, timeout, circuit breaker)
   */
  protected async executeWithResilience<R>(
    operation: () => Promise<R>,
    options?: { timeoutMs?: number; maxRetries?: number }
  ): Promise<R> {
    const timeoutMs = options?.timeoutMs ?? this.config.defaultTimeoutMs;
    const maxRetries = options?.maxRetries ?? this.config.maxRetries;

    // Check circuit breaker
    if (!this.circuitBreaker.canExecute()) {
      throw new Error("Circuit breaker is open - database temporarily unavailable");
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Execute with timeout
        const result = await this.executeWithTimeout(operation, timeoutMs);
        this.circuitBreaker.recordSuccess();
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Record failure for circuit breaker
        if (isRetryableError(error)) {
          this.circuitBreaker.recordFailure();
        }

        // Don't retry on last attempt or non-retryable errors
        if (attempt >= maxRetries || !isRetryableError(error)) {
          break;
        }

        // Exponential backoff with jitter
        const delay = this.config.baseRetryDelayMs * Math.pow(2, attempt) + Math.random() * 100;
        await this.sleep(delay);
      }
    }

    throw lastError ?? new Error("Operation failed");
  }

  /**
   * Execute an operation with timeout
   */
  protected async executeWithTimeout<R>(
    operation: () => Promise<R>,
    timeoutMs: number
  ): Promise<R> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([operation(), timeoutPromise]);
  }

  /**
   * Execute an operation safely, returning a result object
   */
  protected async executeSafe<R>(
    operation: () => Promise<R>
  ): Promise<{ success: true; data: R } | { success: false; error: string }> {
    try {
      const data = await this.executeWithResilience(operation);
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Check if an error is a Prisma "not found" error
   */
  protected isPrismaNotFoundError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    );
  }

  /**
   * Get circuit breaker state
   */
  getCircuitState(): CircuitState {
    return this.circuitBreaker.getState();
  }

  /**
   * Reset circuit breaker (for recovery scenarios)
   */
  resetCircuit(): void {
    this.circuitBreaker.reset();
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
