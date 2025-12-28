import type {
  Awaitable,
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  ContextMenuCommandBuilder,
  MessageContextMenuCommandInteraction,
  PermissionResolvable,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  UserContextMenuCommandInteraction,
} from "discord.js";
import type { SafeguardClient } from "../structures/SafeguardClient";
import type { EventCooldown } from "./events";

/**
 * Command category for organization
 */
export type CommandCategory = "moderation" | "utility" | "config" | "info";

/**
 * Permission requirements for a command
 */
export interface CommandPermissions {
  /** Permissions required for the user to run this command */
  user?: PermissionResolvable[];

  /** Permissions the bot needs to execute this command */
  bot?: PermissionResolvable[];
}

/**
 * Defer configuration for commands
 */
export interface DeferConfig {
  /** If true, automatically defer the interaction before execution */
  enabled: boolean;

  /** If true, the deferred reply will be ephemeral */
  ephemeral?: boolean;
}

/**
 * Base command interface with shared properties
 */
interface BaseCommand {
  /** Category for organization (optional) */
  category?: CommandCategory;

  /** Cooldown configuration (optional, reuses EventCooldown) */
  cooldown?: EventCooldown;

  /** Permission requirements (optional) */
  permissions?: CommandPermissions;

  /** If true, command can only be used in guilds, not DMs (default: true) */
  guildOnly?: boolean;

  /** If true, command is only registered in dev guild (default: false) */
  devOnly?: boolean;

  /** If true, only bot owners can use this command */
  ownerOnly?: boolean;

  /** Auto-defer configuration */
  defer?: boolean | DeferConfig;
}

/**
 * Represents a slash command for the Safeguard bot.
 */
export interface SafeguardCommand extends BaseCommand {
  /** The slash command builder data */
  data:
    | SlashCommandBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;

  /**
   * Execute the command
   * @param client - The SafeguardClient instance
   * @param interaction - The command interaction
   */
  execute: (client: SafeguardClient, interaction: ChatInputCommandInteraction) => Awaitable<void>;

  /**
   * Handle autocomplete for this command (optional)
   * @param client - The SafeguardClient instance
   * @param interaction - The autocomplete interaction
   */
  autocomplete?: (client: SafeguardClient, interaction: AutocompleteInteraction) => Awaitable<void>;
}

/**
 * Represents a context menu command (right-click on user or message)
 */
export interface ContextMenuCommand extends BaseCommand {
  /** The context menu command builder data */
  data: ContextMenuCommandBuilder;

  /**
   * Execute the context menu command
   * @param client - The SafeguardClient instance
   * @param interaction - The context menu interaction
   */
  execute: (
    client: SafeguardClient,
    interaction: UserContextMenuCommandInteraction | MessageContextMenuCommandInteraction
  ) => Awaitable<void>;
}

/**
 * Type for the commands collection stored on the client
 */
export type CommandsCollection = Map<string, SafeguardCommand>;
export type ContextMenusCollection = Map<string, ContextMenuCommand>;
