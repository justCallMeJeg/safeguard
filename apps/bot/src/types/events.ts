import type { Awaitable, ClientEvents } from "discord.js";
import type { SafeguardClient } from "../structures/SafeguardClient";

/**
 * Cooldown configuration for an event
 */
export interface EventCooldown {
  /** Duration in milliseconds */
  duration: number;

  /** Scope of the cooldown */
  scope: "user" | "guild" | "channel" | "global";

  /** Custom message when on cooldown (optional) */
  message?: string;
}

/**
 * Middleware context passed to beforeExecute/afterExecute hooks
 */
export interface MiddlewareContext<K extends keyof ClientEvents = keyof ClientEvents> {
  /** The event name */
  eventName: K;

  /** Timestamp when the event was received */
  timestamp: number;

  /** Unique execution ID for tracking */
  executionId: string;

  /** Custom data that can be passed between hooks */
  data: Record<string, unknown>;
}

/**
 * Represents an event handler for the Safeguard bot.
 * @template K - The event name from Discord.js ClientEvents
 */
export interface SafeguardEvent<K extends keyof ClientEvents = keyof ClientEvents> {
  /** The Discord.js event name */
  name: K;

  /** If true, the event will only fire once */
  once?: boolean;

  /** Priority for event execution (higher = runs first, default: 0) */
  priority?: number;

  /** If false, the event will not be registered (default: true) */
  enabled?: boolean;

  /** Cooldown configuration (optional) */
  cooldown?: EventCooldown;

  /**
   * Middleware hook that runs before the event executes.
   * Return false to prevent the event from executing.
   * @param ctx - Middleware context
   * @param client - The SafeguardClient instance
   * @param args - The event arguments from Discord.js
   */
  beforeExecute?: (
    ctx: MiddlewareContext<K>,
    client: SafeguardClient,
    ...args: ClientEvents[K]
  ) => Awaitable<boolean>;

  /**
   * The function to execute when the event fires
   * @param client - The SafeguardClient instance
   * @param args - The event arguments from Discord.js
   */
  execute: (client: SafeguardClient, ...args: ClientEvents[K]) => Awaitable<void>;

  /**
   * Middleware hook that runs after the event executes.
   * Useful for logging, metrics, or cleanup.
   * @param ctx - Middleware context (includes execution duration)
   * @param client - The SafeguardClient instance
   * @param args - The event arguments from Discord.js
   */
  afterExecute?: (
    ctx: MiddlewareContext<K> & { duration: number; error?: Error },
    client: SafeguardClient,
    ...args: ClientEvents[K]
  ) => Awaitable<void>;
}

/**
 * Helper type to create a typed event object
 */
export type EventBuilder<K extends keyof ClientEvents> = SafeguardEvent<K>;

/**
 * Type for the events collection stored on the client
 */
export type EventsCollection = Map<string, SafeguardEvent>;
