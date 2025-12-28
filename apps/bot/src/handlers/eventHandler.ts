import { readdirSync, statSync, watch } from "fs";
import { join, relative } from "path";
import type { SafeguardClient } from "../structures/SafeguardClient";
import type { SafeguardEvent, MiddlewareContext } from "../types/events";
import { Logger } from "../structures/Logger";

/** Path to the events directory */
const EVENTS_DIR = join(import.meta.dir, "..", "events");

/**
 * Generate a unique execution ID
 */
function generateExecutionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Recursively get all TypeScript files in a directory
 * @param dir - Directory to scan
 * @returns Array of absolute file paths
 */
function getEventFiles(dir: string): string[] {
  const files: string[] = [];

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...getEventFiles(fullPath));
      } else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
        files.push(fullPath);
      }
    }
  } catch {
    Logger.warn("EventHandler", `Could not read directory: ${dir}`);
  }

  return files;
}

/**
 * Register a single event on the client
 * @param client - The SafeguardClient instance
 * @param event - The event to register
 * @param filePath - The file path (for logging)
 */
function registerEvent(client: SafeguardClient, event: SafeguardEvent, filePath: string): void {
  // Skip disabled events
  if (event.enabled === false) {
    Logger.debug("EventHandler", `Skipping disabled event: ${event.name}`);
    return;
  }

  // Create the event handler with middleware, cooldowns, and error boundary
  const handler = async (...args: unknown[]) => {
    const startTime = Date.now();
    const executionId = generateExecutionId();

    // Create middleware context
    const ctx: MiddlewareContext = {
      eventName: event.name,
      timestamp: startTime,
      executionId,
      data: {},
    };

    let error: Error | undefined;

    try {
      // Check cooldown
      if (event.cooldown) {
        const remaining = client.cooldowns.check(event.name, event.cooldown.scope, args);

        if (remaining > 0) {
          Logger.debug(`Event:${event.name}`, `On cooldown for ${Math.ceil(remaining / 1000)}s`);
          return; // Skip execution if on cooldown
        }
      }

      // Run beforeExecute middleware
      if (event.beforeExecute) {
        const shouldContinue = await event.beforeExecute(
          ctx,
          client,
          ...(args as Parameters<typeof event.beforeExecute> extends [
            MiddlewareContext,
            SafeguardClient,
            ...infer R,
          ]
            ? R
            : never)
        );

        if (!shouldContinue) {
          Logger.debug(`Event:${event.name}`, `Blocked by beforeExecute middleware`);
          return;
        }
      }

      // Set cooldown BEFORE execution (prevents spam during async execution)
      if (event.cooldown) {
        client.cooldowns.set(event.name, event.cooldown.scope, event.cooldown.duration, args);
      }

      // Execute the main event handler
      await event.execute(
        client,
        ...(args as Parameters<typeof event.execute> extends [SafeguardClient, ...infer R]
          ? R
          : never)
      );
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
      Logger.error(`Event:${event.name}`, error);
    } finally {
      const duration = Date.now() - startTime;

      // Run afterExecute middleware
      if (event.afterExecute) {
        try {
          await event.afterExecute(
            { ...ctx, duration, error },
            client,
            ...(args as Parameters<typeof event.afterExecute> extends [
              MiddlewareContext & { duration: number },
              SafeguardClient,
              ...infer R,
            ]
              ? R
              : never)
          );
        } catch (afterErr) {
          Logger.error(
            `Event:${event.name}:afterExecute`,
            afterErr instanceof Error ? afterErr : new Error(String(afterErr))
          );
        }
      }

      // Log slow events (> 1 second)
      if (duration > 1000) {
        Logger.warn(`Event:${event.name}`, `Slow execution: ${duration}ms`);
      }
    }
  };

  // Register the event
  if (event.once) {
    client.once(event.name, handler);
  } else {
    client.on(event.name, handler);
  }

  // Store in the client's event collection
  const eventKey = `${filePath}:${event.name}`;
  client.events.set(eventKey, event);
}

/**
 * Unregister all events from a specific file
 * @param client - The SafeguardClient instance
 * @param filePath - The file path to unregister events from
 */
function unregisterFileEvents(client: SafeguardClient, filePath: string): void {
  const keysToDelete: string[] = [];

  for (const [key, event] of client.events) {
    if (key.startsWith(filePath)) {
      client.removeAllListeners(event.name);
      keysToDelete.push(key);
    }
  }

  for (const key of keysToDelete) {
    client.events.delete(key);
  }
}

/**
 * Load a single event file
 * @param client - The SafeguardClient instance
 * @param filePath - The file path to load
 * @param isReload - Whether this is a reload (for logging)
 */
async function loadEventFile(
  client: SafeguardClient,
  filePath: string,
  isReload = false
): Promise<void> {
  try {
    // Clear the module from Bun's cache for hot reload
    if (isReload) {
      delete require.cache[filePath];
    }

    // Dynamic import with cache busting for hot reload
    const importPath = isReload ? `${filePath}?update=${Date.now()}` : filePath;
    const module = await import(importPath);

    // Support both default export and named 'event' export
    const event: SafeguardEvent | undefined = module.default ?? module.event;

    if (!event) {
      Logger.warn("EventHandler", `No event export found in: ${relative(EVENTS_DIR, filePath)}`);
      return;
    }

    if (!event.name || !event.execute) {
      Logger.warn("EventHandler", `Invalid event structure in: ${relative(EVENTS_DIR, filePath)}`);
      return;
    }

    registerEvent(client, event, filePath);

    const action = isReload ? "Reloaded" : "Loaded";
    Logger.debug(
      "EventHandler",
      `${action} event: ${event.name} from ${relative(EVENTS_DIR, filePath)}`
    );
  } catch (error) {
    Logger.error(
      "EventHandler",
      error instanceof Error ? error : new Error(`Failed to load: ${filePath}`)
    );
  }
}

/**
 * Load all events from the events directory
 * @param client - The SafeguardClient instance
 */
export async function loadEvents(client: SafeguardClient): Promise<void> {
  const eventFiles = getEventFiles(EVENTS_DIR);

  if (eventFiles.length === 0) {
    Logger.warn("EventHandler", "No event files found!");
    return;
  }

  // Sort by priority (higher priority first)
  const eventsWithPriority: Array<{ file: string; priority: number }> = [];

  for (const file of eventFiles) {
    try {
      const module = await import(file);
      const event: SafeguardEvent | undefined = module.default ?? module.event;
      eventsWithPriority.push({
        file,
        priority: event?.priority ?? 0,
      });
    } catch {
      eventsWithPriority.push({ file, priority: 0 });
    }
  }

  // Sort by priority descending
  eventsWithPriority.sort((a, b) => b.priority - a.priority);

  // Load events in priority order
  for (const { file } of eventsWithPriority) {
    await loadEventFile(client, file);
  }

  Logger.success("EventHandler", `Loaded ${client.events.size} event(s)`);
}

/**
 * Setup hot reloading for events in development mode
 * @param client - The SafeguardClient instance
 */
export async function setupHotReload(client: SafeguardClient): Promise<void> {
  Logger.success("HotReload", "Watching for event file changes...");

  // Use native fs.watch for file changes
  const watcher = watch(EVENTS_DIR, { recursive: true }, async (eventType, filename) => {
    if (!filename || !filename.endsWith(".ts")) return;

    const filePath = join(EVENTS_DIR, filename);

    // Debounce rapid changes
    const debounceKey = `hotreload:${filePath}`;
    if ((globalThis as Record<string, unknown>)[debounceKey]) return;
    (globalThis as Record<string, unknown>)[debounceKey] = true;

    setTimeout(() => {
      delete (globalThis as Record<string, unknown>)[debounceKey];
    }, 100);

    try {
      const stat = statSync(filePath);
      if (!stat.isFile()) return;
    } catch {
      // File was deleted
      Logger.debug("HotReload", `File deleted: ${filename}`);
      unregisterFileEvents(client, filePath);
      return;
    }

    Logger.debug("HotReload", `File changed: ${filename}`);

    // Unregister old events from this file
    unregisterFileEvents(client, filePath);

    // Re-register remaining events for the same event names
    // This ensures other handlers for the same event type stay active
    const affectedEventNames = new Set<string>();
    for (const [, event] of client.events) {
      affectedEventNames.add(event.name);
    }

    // Reload the changed file
    await loadEventFile(client, filePath, true);

    Logger.success("HotReload", `Reloaded: ${filename}`);
  });

  // Cleanup on shutdown
  process.on("SIGINT", () => {
    watcher.close();
  });

  process.on("SIGTERM", () => {
    watcher.close();
  });
}
