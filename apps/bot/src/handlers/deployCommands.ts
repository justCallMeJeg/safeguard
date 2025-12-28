/**
 * Deploy slash commands to Discord
 *
 * Usage:
 *   bun run deploy           - Deploy globally
 *   bun run deploy:guild     - Deploy to dev guild (uses DEV_GUILD_ID env)
 *
 * This script syncs commands with Discord, removing any that no longer exist.
 */

import { REST, Routes } from "discord.js";
import { join } from "path";
import { readdirSync, statSync } from "fs";
import type { SafeguardCommand } from "../types/commands";
import type { SafeguardClient } from "../structures/SafeguardClient";
import { Logger } from "../structures/Logger";

/** Path to the commands directory */
const COMMANDS_DIR = join(import.meta.dir, "..", "commands");

/**
 * Command JSON structure (works for both slash commands and context menus)
 */
interface CommandJSON {
  name: string;
  description?: string; // Optional for context menus
  type?: number; // ApplicationCommandType
  options?: unknown[];
}

/**
 * Recursively get all TypeScript files in a directory
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
    // Directory doesn't exist yet
  }

  return files;
}

/**
 * Load all commands and return their JSON data
 */
async function loadCommandsJSON(devOnly = false): Promise<CommandJSON[]> {
  const commandFiles = getCommandFiles(COMMANDS_DIR);
  const commands: CommandJSON[] = [];

  for (const file of commandFiles) {
    try {
      const module = await import(file);
      const command: SafeguardCommand | undefined = module.default ?? module.command;

      if (!command?.data) continue;

      // Filter based on devOnly flag
      if (devOnly && !command.devOnly) continue;
      if (!devOnly && command.devOnly) continue;

      commands.push(command.data.toJSON() as CommandJSON);
    } catch (error) {
      Logger.error("Deploy", error instanceof Error ? error : new Error(`Failed to load: ${file}`));
    }
  }

  return commands;
}

/**
 * Deploy commands to a specific guild (instant, for development)
 * @param client - The SafeguardClient instance
 * @param guildId - The guild ID to deploy to
 */
export async function deployToGuild(client: SafeguardClient, guildId: string): Promise<void> {
  const token = process.env.BOT_TOKEN;
  const clientId = process.env.CLIENT_ID;

  if (!token || !clientId) {
    Logger.warn("Deploy", "Missing BOT_TOKEN or CLIENT_ID for auto-deploy");
    return;
  }

  const rest = new REST().setToken(token);

  try {
    // Get commands from client collection
    const commands: CommandJSON[] = [];
    for (const [, command] of client.commands) {
      commands.push(command.data.toJSON() as CommandJSON);
    }

    // Add context menus
    for (const [, contextMenu] of client.contextMenus) {
      commands.push(contextMenu.data.toJSON() as CommandJSON);
    }

    if (commands.length === 0) {
      Logger.warn("Deploy", "No commands to deploy");
      return;
    }

    // Deploy to guild
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands,
    });

    // Sync: Remove stale commands
    const existingCommands = (await rest.get(
      Routes.applicationGuildCommands(clientId, guildId)
    )) as Array<{ id: string; name: string }>;

    const localCommandNames = new Set(commands.map((c) => c.name));
    const staleCommands = existingCommands.filter((c) => !localCommandNames.has(c.name));

    for (const stale of staleCommands) {
      await rest.delete(Routes.applicationGuildCommand(clientId, guildId, stale.id));
      Logger.debug("Deploy", `Removed stale command: /${stale.name}`);
    }

    Logger.success("Deploy", `Auto-deployed ${commands.length} command(s) to dev guild`);
  } catch (error) {
    Logger.error("Deploy", error instanceof Error ? error : new Error("Failed to auto-deploy"));
  }
}

/**
 * Deploy commands globally (takes up to 1 hour to propagate)
 */
export async function deployGlobally(): Promise<void> {
  const token = process.env.BOT_TOKEN;
  const clientId = process.env.CLIENT_ID;

  if (!token || !clientId) {
    Logger.error("Deploy", "Missing BOT_TOKEN or CLIENT_ID");
    process.exit(1);
  }

  const rest = new REST().setToken(token);

  try {
    const commands = await loadCommandsJSON(false);

    if (commands.length === 0) {
      Logger.warn("Deploy", "No commands to deploy!");
      return;
    }

    Logger.info("Deploy", `Deploying ${commands.length} command(s) globally...`);

    const data = await rest.put(Routes.applicationCommands(clientId), { body: commands });

    Logger.success("Deploy", `Deployed ${(data as unknown[]).length} command(s) globally`);

    // Sync: Remove stale commands
    const existingCommands = (await rest.get(Routes.applicationCommands(clientId))) as Array<{
      id: string;
      name: string;
    }>;

    const localCommandNames = new Set(commands.map((c) => c.name));
    const staleCommands = existingCommands.filter((c) => !localCommandNames.has(c.name));

    for (const stale of staleCommands) {
      await rest.delete(Routes.applicationCommand(clientId, stale.id));
      Logger.info("Deploy", `Removed stale command: /${stale.name}`);
    }

    Logger.success("Deploy", "Deployment complete!");
  } catch (error) {
    Logger.error("Deploy", error instanceof Error ? error : new Error("Failed to deploy"));
    process.exit(1);
  }
}

/**
 * CLI entry point - only runs when script is executed directly
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isGuildDeploy = args.includes("--guild") || args.includes("-g");

  if (isGuildDeploy) {
    const guildId = process.env.DEV_GUILD_ID;
    if (!guildId) {
      Logger.error("Deploy", "DEV_GUILD_ID is not set for guild deployment!");
      process.exit(1);
    }

    const token = process.env.BOT_TOKEN;
    const clientId = process.env.CLIENT_ID;

    if (!token || !clientId) {
      Logger.error("Deploy", "Missing BOT_TOKEN or CLIENT_ID");
      process.exit(1);
    }

    const rest = new REST().setToken(token);
    const commands = await loadCommandsJSON(true);

    if (commands.length === 0) {
      // If no dev-only commands, deploy all commands
      const allCommands = await loadCommandsJSON(false);
      if (allCommands.length === 0) {
        Logger.warn("Deploy", "No commands to deploy!");
        return;
      }
      commands.push(...allCommands);
    }

    Logger.info("Deploy", `Deploying ${commands.length} command(s) to dev guild...`);

    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands,
    });

    // Sync: Remove stale commands
    const existingCommands = (await rest.get(
      Routes.applicationGuildCommands(clientId, guildId)
    )) as Array<{ id: string; name: string }>;

    const localCommandNames = new Set(commands.map((c) => c.name));
    const staleCommands = existingCommands.filter((c) => !localCommandNames.has(c.name));

    for (const stale of staleCommands) {
      await rest.delete(Routes.applicationGuildCommand(clientId, guildId, stale.id));
      Logger.info("Deploy", `Removed stale command: /${stale.name}`);
    }

    Logger.success("Deploy", `Deployed ${commands.length} command(s) to dev guild`);
  } else {
    await deployGlobally();
  }
}

// Run if executed directly
if (import.meta.main) {
  main();
}
