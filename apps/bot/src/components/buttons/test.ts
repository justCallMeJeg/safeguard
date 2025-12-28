import { MessageFlags } from "discord.js";
import type { ButtonComponent } from "../../types/components";
import { Embeds } from "../../structures/Embeds";

/**
 * Test button handler - Handles all test:* button interactions
 */
const button: ButtonComponent = {
  customId: "test:",
  isPrefix: true,

  async execute(_client, interaction) {
    const action = interaction.customId.replace("test:", "");

    const styleMap: Record<string, string> = {
      primary: "Primary (Blue)",
      secondary: "Secondary (Gray)",
      success: "Success (Green)",
      danger: "Danger (Red)",
    };

    await interaction.reply({
      embeds: [Embeds.success(`You clicked the **${styleMap[action] ?? action}** button!`)],
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default button;
