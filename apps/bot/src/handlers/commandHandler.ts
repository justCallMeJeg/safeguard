import { readdirSync, statSync, watch } from "fs";
import { join, relative } from "path";
import type { SafeguardClient } from "../structures/SafeguardClient";
import type { SafeguardCommand, ContextMenuCommand } from "../types/commands";
import { Logger } from "../structures/Logger";

/** Path to the commands directory */
const COMMANDS_DIR = join(import.meta.dir, "..", "commands");

/** Path to the context menus directory */
const CONTEXT_MENUS_DIR = join(import.meta.dir, "..", "contextMenus");

/**
 * Recursively get all TypeScript files in a directory
 * @param dir - Directory to scan
 * @returns Array of absolute file paths
 */
function getCommandFiles(dir: string): string[] {
  const files: string[] = [];

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...getCommandFiles(fullPath));
      } else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist, that's fine
  }

  return files;
}

/**
 * Load a single command file
 * @param client - The SafeguardClient instance
 * @param filePath - The file path to load
 * @param isReload - Whether this is a reload (for logging)
 */
async function loadCommandFile(
  client: SafeguardClient,
  filePath: string,
  isReload = false
): Promise<void> {
  try {
    // Clear the module from cache for hot reload
    if (isReload) {
      delete require.cache[filePath];
    }

    // Dynamic import with cache busting for hot reload
    const importPath = isReload ? `${filePath}?update=${Date.now()}` : filePath;
    const module = await import(importPath);

    // Support both default export and named 'command' export
    const command: SafeguardCommand | undefined = module.default ?? module.command;

    if (!command) {
      Logger.warn(
        "CommandHandler",
        `No command export found in: ${relative(COMMANDS_DIR, filePath)}`
      );
      return;
    }

    if (!command.data || !command.execute) {
      Logger.warn(
        "CommandHandler",
        `Invalid command structure in: ${relative(COMMANDS_DIR, filePath)}`
      );
      return;
    }

    // Get command name from the builder
    const commandName = command.data.name;

    // Store in the client's command collection
    client.commands.set(commandName, command);

    const action = isReload ? "Reloaded" : "Loaded";
    Logger.debug("CommandHandler", `${action} command: /${commandName}`);
  } catch (error) {
    Logger.error(
      "CommandHandler",
      error instanceof Error ? error : new Error(`Failed to load: ${filePath}`)
    );
  }
}

/**
 * Load a single context menu file
 */
async function loadContextMenuFile(
  client: SafeguardClient,
  filePath: string,
  isReload = false
): Promise<void> {
  try {
    if (isReload) {
      delete require.cache[filePath];
    }

    const importPath = isReload ? `${filePath}?update=${Date.now()}` : filePath;
    const module = await import(importPath);

    const contextMenu: ContextMenuCommand | undefined = module.default ?? module.contextMenu;

    if (!contextMenu?.data || !contextMenu.execute) {
      Logger.warn(
        "CommandHandler",
        `Invalid context menu in: ${relative(CONTEXT_MENUS_DIR, filePath)}`
      );
      return;
    }

    const menuName = contextMenu.data.name;
    client.contextMenus.set(menuName, contextMenu);

    const action = isReload ? "Reloaded" : "Loaded";
    Logger.debug("CommandHandler", `${action} context menu: ${menuName}`);
  } catch (error) {
    Logger.error(
      "CommandHandler",
      error instanceof Error ? error : new Error(`Failed to load: ${filePath}`)
    );
  }
}

/**
 * Load all commands from the commands directory
 * @param client - The SafeguardClient instance
 */
export async function loadCommands(client: SafeguardClient): Promise<void> {
  const commandFiles = getCommandFiles(COMMANDS_DIR);

  if (commandFiles.length === 0) {
    Logger.warn("CommandHandler", "No command files found!");
    return;
  }

  for (const file of commandFiles) {
    await loadCommandFile(client, file);
  }

  Logger.success("CommandHandler", `Loaded ${client.commands.size} command(s)`);
}

/**
 * Load all context menus from the contextMenus directory
 * @param client - The SafeguardClient instance
 */
export async function loadContextMenus(client: SafeguardClient): Promise<void> {
  const contextMenuFiles = getCommandFiles(CONTEXT_MENUS_DIR);

  if (contextMenuFiles.length === 0) {
    return; // Context menus are optional
  }

  for (const file of contextMenuFiles) {
    await loadContextMenuFile(client, file);
  }

  if (client.contextMenus.size > 0) {
    Logger.success("CommandHandler", `Loaded ${client.contextMenus.size} context menu(s)`);
  }
}

/**
 * Setup hot reloading for commands in development mode
 * @param client - The SafeguardClient instance
 */
export async function setupCommandHotReload(client: SafeguardClient): Promise<void> {
  Logger.success("HotReload", "Watching for command file changes...");

  // Watch commands directory
  const commandWatcher = watch(COMMANDS_DIR, { recursive: true }, async (_eventType, filename) => {
    if (!filename || !filename.endsWith(".ts")) return;

    const filePath = join(COMMANDS_DIR, filename);

    // Debounce rapid changes
    const debounceKey = `hotreload:cmd:${filePath}`;
    if ((globalThis as Record<string, unknown>)[debounceKey]) return;
    (globalThis as Record<string, unknown>)[debounceKey] = true;

    setTimeout(() => {
      delete (globalThis as Record<string, unknown>)[debounceKey];
    }, 100);

    try {
      const stat = statSync(filePath);
      if (!stat.isFile()) return;
    } catch {
      Logger.debug("HotReload", `Command file deleted: ${filename}`);
      return;
    }

    Logger.debug("HotReload", `Command file changed: ${filename}`);
    await loadCommandFile(client, filePath, true);
    Logger.success("HotReload", `Reloaded command: ${filename}`);
  });

  // Watch context menus directory
  try {
    const contextMenuWatcher = watch(
      CONTEXT_MENUS_DIR,
      { recursive: true },
      async (_eventType, filename) => {
        if (!filename || !filename.endsWith(".ts")) return;

        const filePath = join(CONTEXT_MENUS_DIR, filename);

        const debounceKey = `hotreload:ctx:${filePath}`;
        if ((globalThis as Record<string, unknown>)[debounceKey]) return;
        (globalThis as Record<string, unknown>)[debounceKey] = true;

        setTimeout(() => {
          delete (globalThis as Record<string, unknown>)[debounceKey];
        }, 100);

        try {
          const stat = statSync(filePath);
          if (!stat.isFile()) return;
        } catch {
          Logger.debug("HotReload", `Context menu file deleted: ${filename}`);
          return;
        }

        Logger.debug("HotReload", `Context menu file changed: ${filename}`);
        await loadContextMenuFile(client, filePath, true);
        Logger.success("HotReload", `Reloaded context menu: ${filename}`);
      }
    );

    process.on("SIGINT", () => contextMenuWatcher.close());
    process.on("SIGTERM", () => contextMenuWatcher.close());
  } catch {
    // Context menus directory doesn't exist, skip watching
  }

  // Cleanup on shutdown
  process.on("SIGINT", () => commandWatcher.close());
  process.on("SIGTERM", () => commandWatcher.close());
}

/**
 * Get all commands as JSON for deployment (includes context menus)
 * @param client - The SafeguardClient instance
 * @param devOnly - Only return dev commands
 */
export function getCommandsJSON(client: SafeguardClient, devOnly = false): unknown[] {
  const commands: unknown[] = [];

  // Add slash commands
  for (const [, command] of client.commands) {
    if (devOnly && !command.devOnly) continue;
    if (!devOnly && command.devOnly) continue;

    commands.push(command.data.toJSON());
  }

  // Add context menus
  for (const [, contextMenu] of client.contextMenus) {
    if (devOnly && !contextMenu.devOnly) continue;
    if (!devOnly && contextMenu.devOnly) continue;

    commands.push(contextMenu.data.toJSON());
  }

  return commands;
}
