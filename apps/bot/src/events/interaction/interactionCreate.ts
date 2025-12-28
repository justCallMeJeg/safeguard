import { Events, MessageFlags, PermissionsBitField, type Interaction } from "discord.js";
import type { SafeguardEvent } from "../../types/events";
import { Logger } from "../../structures/Logger";
import { findComponent } from "../../handlers/componentHandler";
import type { SafeguardClient } from "../../structures/SafeguardClient";

// Helper functions to find components with proper typing
const findButton = (client: SafeguardClient, customId: string) =>
  findComponent(client.buttons, customId);
const findModal = (client: SafeguardClient, customId: string) =>
  findComponent(client.modals, customId);
const findSelectMenu = (client: SafeguardClient, customId: string) =>
  findComponent(client.selectMenus, customId);

/**
 * Handles the interactionCreate event.
 * Routes slash commands and other interactions to their handlers.
 */
const event: SafeguardEvent<"interactionCreate"> = {
  name: Events.InteractionCreate,
  once: false,
  priority: 50, // Medium priority

  async execute(client, interaction: Interaction) {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      const { commandName, user, guild } = interaction;

      // Get the command from the collection
      const command = client.commands.get(commandName);

      if (!command) {
        Logger.warn("Commands", `Unknown command: /${commandName}`);
        await interaction.reply({
          content: "❌ This command no longer exists.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Check if command is owner-only
      if (command.ownerOnly && !client.ownerIds.has(user.id)) {
        await interaction.reply({
          content: "❌ This command is restricted to bot owners.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Check if command is guild-only
      if (command.guildOnly !== false && !guild) {
        await interaction.reply({
          content: "❌ This command can only be used in a server.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Check user permissions
      if (command.permissions?.user && guild && interaction.member) {
        const memberPermissions = interaction.member.permissions;

        if (memberPermissions instanceof PermissionsBitField) {
          const missing = command.permissions.user.filter((perm) => !memberPermissions.has(perm));

          if (missing.length > 0) {
            await interaction.reply({
              content: "❌ You don't have permission to use this command.",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
        }
      }

      // Check bot permissions
      if (command.permissions?.bot && guild) {
        const botMember = guild.members.me;

        if (botMember) {
          const missing = command.permissions.bot.filter(
            (perm) => !botMember.permissions.has(perm)
          );

          if (missing.length > 0) {
            await interaction.reply({
              content: "❌ I don't have the required permissions to execute this command.",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
        }
      }

      // Check cooldown
      if (command.cooldown) {
        const remaining = client.cooldowns.check(`cmd:${commandName}`, command.cooldown.scope, [
          interaction,
        ]);

        if (remaining > 0) {
          const seconds = Math.ceil(remaining / 1000);
          await interaction.reply({
            content:
              command.cooldown.message ??
              `⏳ Please wait ${seconds}s before using this command again.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        // Set cooldown
        client.cooldowns.set(
          `cmd:${commandName}`,
          command.cooldown.scope,
          command.cooldown.duration,
          [interaction]
        );
      }

      // Execute the command
      try {
        // Auto-defer if configured
        if (command.defer) {
          const ephemeral =
            typeof command.defer === "object" ? (command.defer.ephemeral ?? false) : false;
          await interaction.deferReply({ flags: ephemeral ? MessageFlags.Ephemeral : undefined });
        }

        Logger.command(commandName, `Executed by ${user.tag} in ${guild?.name ?? "DMs"}`);
        await command.execute(client, interaction);
      } catch (error) {
        Logger.error(
          `Command:${commandName}`,
          error instanceof Error ? error : new Error(String(error))
        );

        const errorMessage = "❌ An error occurred while executing this command.";

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral });
        } else {
          await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
        }
      }

      return;
    }

    // Handle user context menu commands
    if (interaction.isUserContextMenuCommand()) {
      const { commandName, user, targetUser } = interaction;
      const contextMenu = client.contextMenus.get(commandName);

      if (!contextMenu) {
        Logger.warn("ContextMenu", `Unknown context menu: ${commandName}`);
        return;
      }

      // Check owner-only
      if (contextMenu.ownerOnly && !client.ownerIds.has(user.id)) {
        await interaction.reply({
          content: "❌ This action is restricted to bot owners.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      try {
        // Auto-defer if configured
        if (contextMenu.defer) {
          const ephemeral =
            typeof contextMenu.defer === "object" ? (contextMenu.defer.ephemeral ?? false) : false;
          await interaction.deferReply({ flags: ephemeral ? MessageFlags.Ephemeral : undefined });
        }

        Logger.debug("ContextMenu", `${commandName} on ${targetUser.tag} by ${user.tag}`);
        await contextMenu.execute(client, interaction);
      } catch (error) {
        Logger.error(
          `ContextMenu:${commandName}`,
          error instanceof Error ? error : new Error(String(error))
        );

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "❌ An error occurred while processing this action.",
            flags: MessageFlags.Ephemeral,
          });
        }
      }

      return;
    }

    // Handle message context menu commands
    if (interaction.isMessageContextMenuCommand()) {
      const { commandName, user } = interaction;
      const contextMenu = client.contextMenus.get(commandName);

      if (!contextMenu) {
        Logger.warn("ContextMenu", `Unknown context menu: ${commandName}`);
        return;
      }

      // Check owner-only
      if (contextMenu.ownerOnly && !client.ownerIds.has(user.id)) {
        await interaction.reply({
          content: "❌ This action is restricted to bot owners.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      try {
        // Auto-defer if configured
        if (contextMenu.defer) {
          const ephemeral =
            typeof contextMenu.defer === "object" ? (contextMenu.defer.ephemeral ?? false) : false;
          await interaction.deferReply({ flags: ephemeral ? MessageFlags.Ephemeral : undefined });
        }

        Logger.debug("ContextMenu", `${commandName} on message by ${user.tag}`);
        await contextMenu.execute(client, interaction);
      } catch (error) {
        Logger.error(
          `ContextMenu:${commandName}`,
          error instanceof Error ? error : new Error(String(error))
        );

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "❌ An error occurred while processing this action.",
            flags: MessageFlags.Ephemeral,
          });
        }
      }

      return;
    }

    // Handle autocomplete interactions
    if (interaction.isAutocomplete()) {
      const { commandName } = interaction;
      const command = client.commands.get(commandName);

      if (!command?.autocomplete) return;

      try {
        await command.autocomplete(client, interaction);
      } catch (error) {
        Logger.error(
          `Autocomplete:${commandName}`,
          error instanceof Error ? error : new Error(String(error))
        );
      }

      return;
    }

    // Handle button interactions
    if (interaction.isButton()) {
      const { customId, user } = interaction;

      // Find the button handler
      const button = findButton(client, customId);

      if (!button) {
        Logger.debug("Button", `No handler for: ${customId}`);
        return;
      }

      try {
        Logger.debug("Button", `${customId} clicked by ${user.tag}`);
        await button.execute(client, interaction);
      } catch (error) {
        Logger.error(
          `Button:${customId}`,
          error instanceof Error ? error : new Error(String(error))
        );

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "❌ An error occurred while processing this button.",
            flags: MessageFlags.Ephemeral,
          });
        }
      }

      return;
    }

    // Handle select menu interactions
    if (interaction.isAnySelectMenu()) {
      const { customId, user } = interaction;

      // Find the select menu handler
      const selectMenu = findSelectMenu(client, customId);

      if (!selectMenu) {
        Logger.debug("SelectMenu", `No handler for: ${customId}`);
        return;
      }

      try {
        Logger.debug("SelectMenu", `${customId} selected by ${user.tag}`);
        await selectMenu.execute(client, interaction);
      } catch (error) {
        Logger.error(
          `SelectMenu:${customId}`,
          error instanceof Error ? error : new Error(String(error))
        );

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "❌ An error occurred while processing this selection.",
            flags: MessageFlags.Ephemeral,
          });
        }
      }

      return;
    }

    // Handle modal submissions
    if (interaction.isModalSubmit()) {
      const { customId, user } = interaction;

      // Find the modal handler
      const modal = findModal(client, customId);

      if (!modal) {
        Logger.debug("Modal", `No handler for: ${customId}`);
        return;
      }

      try {
        Logger.debug("Modal", `${customId} submitted by ${user.tag}`);
        await modal.execute(client, interaction);
      } catch (error) {
        Logger.error(
          `Modal:${customId}`,
          error instanceof Error ? error : new Error(String(error))
        );

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "❌ An error occurred while processing this form.",
            flags: MessageFlags.Ephemeral,
          });
        }
      }

      return;
    }
  },
};

export default event;
