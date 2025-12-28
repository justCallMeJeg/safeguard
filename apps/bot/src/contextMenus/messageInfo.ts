import { ApplicationCommandType, ContextMenuCommandBuilder, MessageFlags } from "discord.js";
import type { ContextMenuCommand } from "../types/commands";
import { Embeds } from "../structures/Embeds";

/**
 * Message Info context menu - Right-click on a message to see its info
 */
const contextMenu: ContextMenuCommand = {
  data: new ContextMenuCommandBuilder()
    .setName("Message Info")
    .setType(ApplicationCommandType.Message),

  category: "utility",

  async execute(client, interaction) {
    // Type guard for message context menu
    if (!interaction.isMessageContextMenuCommand()) return;

    const { targetMessage } = interaction;

    const fields = [
      { name: "Author", value: targetMessage.author.tag, inline: true },
      { name: "Message ID", value: targetMessage.id, inline: true },
      { name: "Channel", value: `<#${targetMessage.channelId}>`, inline: true },
      {
        name: "Created",
        value: `<t:${Math.floor(targetMessage.createdTimestamp / 1000)}:R>`,
        inline: true,
      },
      {
        name: "Edited",
        value: targetMessage.editedTimestamp
          ? `<t:${Math.floor(targetMessage.editedTimestamp / 1000)}:R>`
          : "Never",
        inline: true,
      },
      { name: "Attachments", value: `${targetMessage.attachments.size}`, inline: true },
    ];

    // Add content preview if available
    const content = targetMessage.content;
    const contentPreview = content
      ? content.length > 100
        ? `${content.substring(0, 100)}...`
        : content
      : "*No text content*";

    await interaction.reply({
      embeds: [
        Embeds.custom({
          title: "📨 Message Info",
          description: `**Content:**\n${contentPreview}`,
          fields,
          footer: { text: `Message ID: ${targetMessage.id}` },
        }),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default contextMenu;
