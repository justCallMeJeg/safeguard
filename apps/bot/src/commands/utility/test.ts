import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { SafeguardCommand } from "../../types/commands";
import { Embeds } from "../../structures/Embeds";

/**
 * Test command - Demonstrates all interaction types
 */
const command: SafeguardCommand = {
  data: new SlashCommandBuilder()
    .setName("test")
    .setDescription("Test all interaction types")
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("Type of interaction to test")
        .setRequired(true)
        .addChoices(
          { name: "Buttons", value: "buttons" },
          { name: "Select Menu", value: "select" },
          { name: "Modal", value: "modal" },
          { name: "Autocomplete", value: "autocomplete" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("search")
        .setDescription("Test autocomplete (type something)")
        .setAutocomplete(true)
    ),

  category: "utility",

  async execute(client, interaction) {
    const type = interaction.options.getString("type", true);
    const searchValue = interaction.options.getString("search");

    switch (type) {
      case "buttons": {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("test:primary")
            .setLabel("Primary")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("test:secondary")
            .setLabel("Secondary")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("test:success")
            .setLabel("Success")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("test:danger")
            .setLabel("Danger")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setLabel("Link")
            .setStyle(ButtonStyle.Link)
            .setURL("https://discord.js.org")
        );

        await interaction.reply({
          embeds: [Embeds.info("Click any button below to test!")],
          components: [row],
        });
        break;
      }

      case "select": {
        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("test:select")
            .setPlaceholder("Choose an option...")
            .setMinValues(1)
            .setMaxValues(3)
            .addOptions(
              { label: "Option 1", value: "option1", emoji: "1️⃣" },
              { label: "Option 2", value: "option2", emoji: "2️⃣" },
              { label: "Option 3", value: "option3", emoji: "3️⃣" },
              { label: "Option 4", value: "option4", emoji: "4️⃣" },
              { label: "Option 5", value: "option5", emoji: "5️⃣" }
            )
        );

        await interaction.reply({
          embeds: [Embeds.info("Select one or more options below!")],
          components: [row],
        });
        break;
      }

      case "modal": {
        const modal = new ModalBuilder()
          .setCustomId("test:modal")
          .setTitle("Test Modal")
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId("title")
                .setLabel("Title")
                .setPlaceholder("Enter a title...")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(100)
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId("description")
                .setLabel("Description")
                .setPlaceholder("Enter a description...")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(1000)
            )
          );

        await interaction.showModal(modal);
        break;
      }

      case "autocomplete": {
        await interaction.reply({
          embeds: [
            Embeds.success(
              searchValue
                ? `You selected: **${searchValue}**`
                : "Use the `search` option and start typing to test autocomplete!"
            ),
          ],
        });
        break;
      }
    }
  },

  async autocomplete(client, interaction) {
    const focused = interaction.options.getFocused();

    // Sample data for autocomplete
    const choices = ["Apple", "Banana", "Cherry", "Date", "Elderberry", "Fig", "Grape", "Honeydew"];

    // Filter based on user input
    const filtered = choices.filter((choice) =>
      choice.toLowerCase().includes(focused.toLowerCase())
    );

    await interaction.respond(
      filtered.slice(0, 25).map((choice) => ({
        name: choice,
        value: choice,
      }))
    );
  },
};

export default command;
