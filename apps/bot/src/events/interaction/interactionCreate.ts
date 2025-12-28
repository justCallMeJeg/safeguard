import { Events, type Interaction } from "discord.js";
import type { SafeguardEvent } from "../../types/events";
import { Logger } from "../../structures/Logger";

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

      Logger.command(commandName, `Executed by ${user.tag} in ${guild?.name ?? "DMs"}`);

      // TODO: Route to command handler
      // const command = client.commands.get(commandName);
      // if (command) {
      //   await command.execute(client, interaction);
      // }

      // Placeholder response until command handler is implemented
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: `🔧 Command \`/${commandName}\` received! Command handler coming soon.`,
          ephemeral: true,
        });
      }

      return;
    }

    // Handle autocomplete interactions
    if (interaction.isAutocomplete()) {
      const { commandName } = interaction;

      Logger.debug("Autocomplete", `${commandName} requested by ${interaction.user.tag}`);

      // TODO: Route to command's autocomplete handler
      // const command = client.commands.get(commandName);
      // if (command?.autocomplete) {
      //   await command.autocomplete(client, interaction);
      // }

      return;
    }

    // Handle button interactions
    if (interaction.isButton()) {
      const { customId, user } = interaction;

      Logger.debug("Button", `${customId} clicked by ${user.tag}`);

      // TODO: Route to button handler
      // const handler = client.buttons.get(customId);
      // if (handler) {
      //   await handler.execute(client, interaction);
      // }

      return;
    }

    // Handle select menu interactions
    if (interaction.isAnySelectMenu()) {
      const { customId, user } = interaction;

      Logger.debug("SelectMenu", `${customId} selected by ${user.tag}`);

      // TODO: Route to select menu handler

      return;
    }

    // Handle modal submissions
    if (interaction.isModalSubmit()) {
      const { customId, user } = interaction;

      Logger.debug("Modal", `${customId} submitted by ${user.tag}`);

      // TODO: Route to modal handler

      return;
    }
  },
};

export default event;
