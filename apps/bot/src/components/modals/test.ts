import type { ModalComponent } from "../../types/components";
import { Embeds } from "../../structures/Embeds";

/**
 * Test modal handler
 */
const modal: ModalComponent = {
  customId: "test:modal",

  async execute(_client, interaction) {
    const title = interaction.fields.getTextInputValue("title");
    const description =
      interaction.fields.getTextInputValue("description") || "*No description provided*";

    await interaction.reply({
      embeds: [
        Embeds.custom({
          title: `📝 ${title}`,
          description,
          fields: [
            { name: "Submitted By", value: interaction.user.tag, inline: true },
            { name: "Submitted At", value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
          ],
        }),
      ],
    });
  },
};

export default modal;
