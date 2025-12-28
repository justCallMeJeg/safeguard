import { MessageFlags } from "discord.js";
import type { SelectMenuComponent } from "../../types/components";
import { Embeds } from "../../structures/Embeds";

/**
 * Test select menu handler
 */
const selectMenu: SelectMenuComponent = {
  customId: "test:select",

  async execute(_client, interaction) {
    if (!interaction.isStringSelectMenu()) return;

    const selected = interaction.values;

    await interaction.reply({
      embeds: [
        Embeds.success(
          `You selected: **${selected.join(", ")}**\n\nTotal: ${selected.length} option(s)`
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default selectMenu;
