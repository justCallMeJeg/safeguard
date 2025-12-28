import { ApplicationCommandType, ContextMenuCommandBuilder, MessageFlags } from "discord.js";
import type { ContextMenuCommand } from "../types/commands";
import { Embeds } from "../structures/Embeds";

/**
 * User Info context menu - Right-click on a user to see their info
 */
const contextMenu: ContextMenuCommand = {
  data: new ContextMenuCommandBuilder().setName("User Info").setType(ApplicationCommandType.User),

  category: "utility",

  async execute(client, interaction) {
    // Type guard for user context menu
    if (!interaction.isUserContextMenuCommand()) return;

    const { targetUser, targetMember } = interaction;

    const fields = [
      { name: "Username", value: targetUser.tag, inline: true },
      { name: "ID", value: targetUser.id, inline: true },
      {
        name: "Created",
        value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`,
        inline: true,
      },
    ];

    // Add member-specific info if in a guild
    if (targetMember && "joinedAt" in targetMember && targetMember.joinedAt) {
      fields.push({
        name: "Joined",
        value: `<t:${Math.floor(targetMember.joinedAt.getTime() / 1000)}:R>`,
        inline: true,
      });
    }

    await interaction.reply({
      embeds: [
        Embeds.custom({
          title: `👤 ${targetUser.username}`,
          thumbnail: targetUser.displayAvatarURL({ size: 256 }),
          fields,
          color: targetUser.accentColor ?? 0x5865f2,
        }),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default contextMenu;
