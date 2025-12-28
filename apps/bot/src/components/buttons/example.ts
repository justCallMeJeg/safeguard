import { MessageFlags } from "discord.js";
import type { ButtonComponent } from "../../types/components";
import { Embeds } from "../../structures/Embeds";

/**
 * Example button handler - demonstrates prefix matching
 * Handles buttons with customId starting with "example:"
 */
const button: ButtonComponent = {
  customId: "example:",
  isPrefix: true, // Match any button ID starting with "example:"

  async execute(_client, interaction) {
    // Extract the action from the customId (e.g., "example:confirm" -> "confirm")
    const action = interaction.customId.replace("example:", "");

    switch (action) {
      case "confirm":
        await interaction.reply({
          embeds: [Embeds.success("Action confirmed!")],
          flags: MessageFlags.Ephemeral,
        });
        break;

      case "cancel":
        await interaction.reply({
          embeds: [Embeds.warning("Action cancelled.")],
          flags: MessageFlags.Ephemeral,
        });
        break;

      default:
        await interaction.reply({
          embeds: [Embeds.info(`Button action: ${action}`)],
          flags: MessageFlags.Ephemeral,
        });
    }
  },
};

export default button;
