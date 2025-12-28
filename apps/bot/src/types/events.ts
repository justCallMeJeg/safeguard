import type { Awaitable, ClientEvents } from "discord.js";
import type { SafeguardClient } from "../structures/SafeguardClient";

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

  /**
   * The function to execute when the event fires
   * @param client - The SafeguardClient instance
   * @param args - The event arguments from Discord.js
   */
  execute: (client: SafeguardClient, ...args: ClientEvents[K]) => Awaitable<void>;
}

/**
 * Helper type to create a typed event object
 */
export type EventBuilder<K extends keyof ClientEvents> = SafeguardEvent<K>;

/**
 * Type for the events collection stored on the client
 */
export type EventsCollection = Map<string, SafeguardEvent>;
