import type { Interaction } from "discord.js";
import { Logger } from "./Logger";

/**
 * Manages cooldowns for events with different scopes.
 * Supports user, guild, channel, and global cooldowns.
 */
export class CooldownManager {
  /** Map of cooldown keys to expiration timestamps */
  private cooldowns: Map<string, number> = new Map();

  /** Interval for cleaning up expired cooldowns */
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Start cleanup interval (every 5 minutes)
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Generate a cooldown key based on scope
   * @param eventName - The event name
   * @param scope - The cooldown scope
   * @param interaction - The interaction (for user/guild/channel scope)
   */
  private getKey(
    eventName: string,
    scope: "user" | "guild" | "channel" | "global",
    context?: { userId?: string; guildId?: string; channelId?: string }
  ): string {
    switch (scope) {
      case "user":
        return `${eventName}:user:${context?.userId ?? "unknown"}`;
      case "guild":
        return `${eventName}:guild:${context?.guildId ?? "unknown"}`;
      case "channel":
        return `${eventName}:channel:${context?.channelId ?? "unknown"}`;
      case "global":
        return `${eventName}:global`;
    }
  }

  /**
   * Extract context from an interaction or event args
   * @param args - Event arguments
   */
  extractContext(args: unknown[]): { userId?: string; guildId?: string; channelId?: string } {
    const firstArg = args[0];

    // Check if it's an Interaction
    if (firstArg && typeof firstArg === "object" && "user" in firstArg) {
      const interaction = firstArg as Interaction;
      return {
        userId: interaction.user?.id,
        guildId: interaction.guild?.id ?? undefined,
        channelId: interaction.channelId ?? undefined,
      };
    }

    // Check for common event patterns
    if (firstArg && typeof firstArg === "object") {
      const obj = firstArg as Record<string, unknown>;
      return {
        userId: (obj.author as { id?: string })?.id ?? (obj.user as { id?: string })?.id,
        guildId: (obj.guild as { id?: string })?.id ?? (obj.guildId as string),
        channelId: (obj.channel as { id?: string })?.id ?? (obj.channelId as string),
      };
    }

    return {};
  }

  /**
   * Check if an event is on cooldown
   * @param eventName - The event name
   * @param scope - The cooldown scope
   * @param args - Event arguments (for context extraction)
   * @returns Remaining cooldown time in ms, or 0 if not on cooldown
   */
  check(
    eventName: string,
    scope: "user" | "guild" | "channel" | "global",
    args: unknown[]
  ): number {
    const context = this.extractContext(args);
    const key = this.getKey(eventName, scope, context);
    const expiration = this.cooldowns.get(key);

    if (!expiration) return 0;

    const remaining = expiration - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  /**
   * Set a cooldown for an event
   * @param eventName - The event name
   * @param scope - The cooldown scope
   * @param duration - Duration in milliseconds
   * @param args - Event arguments (for context extraction)
   */
  set(
    eventName: string,
    scope: "user" | "guild" | "channel" | "global",
    duration: number,
    args: unknown[]
  ): void {
    const context = this.extractContext(args);
    const key = this.getKey(eventName, scope, context);
    const expiration = Date.now() + duration;

    this.cooldowns.set(key, expiration);

    Logger.debug("Cooldown", `Set cooldown: ${key} for ${duration}ms`);
  }

  /**
   * Clear a specific cooldown
   * @param eventName - The event name
   * @param scope - The cooldown scope
   * @param args - Event arguments (for context extraction)
   */
  clear(eventName: string, scope: "user" | "guild" | "channel" | "global", args: unknown[]): void {
    const context = this.extractContext(args);
    const key = this.getKey(eventName, scope, context);
    this.cooldowns.delete(key);
  }

  /**
   * Clean up expired cooldowns
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, expiration] of this.cooldowns) {
      if (expiration < now) {
        this.cooldowns.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      Logger.debug("Cooldown", `Cleaned up ${cleaned} expired cooldown(s)`);
    }
  }

  /**
   * Get the number of active cooldowns
   */
  get size(): number {
    return this.cooldowns.size;
  }

  /**
   * Destroy the cooldown manager and clear the cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cooldowns.clear();
  }
}
