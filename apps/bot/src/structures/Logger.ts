import { createConsola, type ConsolaInstance } from "consola";

/**
 * Logger utility for the Safeguard bot.
 * Provides structured, colored logging with context awareness.
 */
export class Logger {
  private static instance: ConsolaInstance;

  /**
   * Initialize the logger with bot branding
   */
  static init(): ConsolaInstance {
    if (!this.instance) {
      this.instance = createConsola({
        level: process.env.NODE_ENV === "production" ? 3 : 4, // info in prod, debug in dev
        formatOptions: {
          date: true,
          colors: true,
          compact: false,
        },
      }).withTag("Safeguard");
    }
    return this.instance;
  }

  /**
   * Get the logger instance
   */
  static get(): ConsolaInstance {
    if (!this.instance) {
      return this.init();
    }
    return this.instance;
  }

  /**
   * Create a scoped logger with additional context
   * @param scope - The scope name (e.g., "Events", "Commands")
   */
  static scoped(scope: string): ConsolaInstance {
    return this.get().withTag(scope);
  }

  /**
   * Log an event-related message
   * @param eventName - The name of the event
   * @param message - The message to log
   */
  static event(eventName: string, message: string): void {
    this.scoped("Events").info(`[${eventName}] ${message}`);
  }

  /**
   * Log a command-related message
   * @param commandName - The name of the command
   * @param message - The message to log
   */
  static command(commandName: string, message: string): void {
    this.scoped("Commands").info(`[${commandName}] ${message}`);
  }

  /**
   * Log a debug message (only in development)
   * @param context - The context/scope
   * @param message - The message to log
   */
  static debug(context: string, message: string): void {
    this.scoped(context).debug(message);
  }

  /**
   * Log an error with context
   * @param context - The context where the error occurred
   * @param error - The error object or message
   */
  static error(context: string, error: Error | string): void {
    const logger = this.scoped(context);
    if (error instanceof Error) {
      logger.error(error.message);
      if (error.stack) {
        logger.debug(error.stack);
      }
    } else {
      logger.error(error);
    }
  }

  /**
   * Log a warning message
   * @param context - The context/scope
   * @param message - The warning message
   */
  static warn(context: string, message: string): void {
    this.scoped(context).warn(message);
  }

  /**
   * Log a success message
   * @param context - The context/scope
   * @param message - The success message
   */
  static success(context: string, message: string): void {
    this.scoped(context).success(message);
  }
}
