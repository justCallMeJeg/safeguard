import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { SafeguardCommand } from "../../types/commands";
import { Embeds, Colors } from "../../structures/Embeds";

const command: SafeguardCommand = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a member")
    .addUserOption((option) =>
      option.setName("user").setDescription("The user to warn").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("reason").setDescription("Reason for the warning").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),

  category: "moderation",
  guildOnly: true,

  permissions: {
    user: [PermissionFlagsBits.ModerateMembers],
    bot: [PermissionFlagsBits.ModerateMembers],
  },

  defer: {
    enabled: true,
    ephemeral: true,
  },

  async execute(client, interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason", true);
    const guild = interaction.guild!;

    // Resolving the member object if needed, mainly for DM
    const member = await guild.members.fetch(user.id).catch(() => null);

    // Send DM to user if they are in the server
    if (member) {
      try {
        const dmEmbed = Embeds.custom({
          title: `You were warned in ${guild.name}`,
          fields: [{ name: "Reason", value: reason, inline: false }],
          color: Colors.Warning,
          timestamp: true,
        });
        await member.send({ embeds: [dmEmbed] });
      } catch {
        // Ignore if DM fails
      }
    }

    // Log to Database (This effectively "creates" the warning record)
    try {
      await client.auditLogs.create({
        guildId: guild.id,
        action: "MEMBER_WARN",
        executor: interaction.user.id,
        targetId: user.id,
        reason: reason,
      });
    } catch (error) {
      console.error("Failed to log warning to database:", error);
    }

    // Log to Discord Channel
    const settings = await client.guildSettings.get(guild.id);
    if (settings?.modLogsChannel) {
      const logChannel = await guild.channels.fetch(settings.modLogsChannel).catch(() => null);
      if (logChannel && logChannel.isTextBased()) {
        const logEmbed = Embeds.custom({
          title: "⚠️ Member Warned",
          fields: [
            { name: "User", value: `${user.tag} (${user.id})`, inline: true },
            { name: "Moderator", value: `${interaction.user.tag}`, inline: true },
            { name: "Reason", value: reason, inline: false },
          ],
          color: Colors.Warning,
          timestamp: true,
          thumbnail: user.displayAvatarURL(),
        });
        await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
      }
    }

    // Confirm to Interaction
    await interaction.editReply({
      embeds: [Embeds.success(`**${user.tag}** has been warned.`)],
    });
  },
};

export default command;
