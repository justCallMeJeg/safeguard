import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { SafeguardCommand } from "../../types/commands";
import { Embeds, Colors } from "../../structures/Embeds";

const command: SafeguardCommand = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user from the server")
    .addUserOption((option) =>
      option.setName("user").setDescription("The user to ban").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("reason").setDescription("Reason for the ban").setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("delete_messages")
        .setDescription("Delete messages history")
        .setRequired(false)
        .addChoices(
          { name: "Don't delete", value: "0" },
          { name: "Previous Hour", value: "3600" },
          { name: "Previous 6 Hours", value: "21600" },
          { name: "Previous 12 Hours", value: "43200" },
          { name: "Previous 24 Hours", value: "86400" },
          { name: "Previous 3 Days", value: "259200" },
          { name: "Previous 7 Days", value: "604800" }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false),

  category: "moderation",
  guildOnly: true,

  permissions: {
    user: [PermissionFlagsBits.BanMembers],
    bot: [PermissionFlagsBits.BanMembers],
  },

  defer: {
    enabled: true,
    ephemeral: true,
  },

  async execute(client, interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";
    const deleteSeconds = parseInt(interaction.options.getString("delete_messages") ?? "0");
    const guild = interaction.guild!;

    // Resolving the member object if they are in the server
    const member = await guild.members.fetch(user.id).catch(() => null);

    // If member is in server, perform hierarchy checks
    if (member) {
      // Check hierarchy: Bot vs Member
      if (!member.bannable) {
        await interaction.editReply({
          embeds: [Embeds.error("I cannot ban this user. They may have a higher role than me.")],
        });
        return;
      }

      // Check hierarchy: Executor vs Member
      const executor = await guild.members.fetch(interaction.user.id);
      if (
        member.roles.highest.position >= executor.roles.highest.position &&
        interaction.user.id !== guild.ownerId
      ) {
        await interaction.editReply({
          embeds: [
            Embeds.error("You cannot ban this user. They have a higher or equal role to you."),
          ],
        });
        return;
      }

      // Send DM to user
      try {
        const dmEmbed = Embeds.custom({
          title: `You were banned from ${guild.name}`,
          fields: [{ name: "Reason", value: reason, inline: false }],
          color: Colors.Error,
          timestamp: true,
        });
        await member.send({ embeds: [dmEmbed] });
      } catch {
        // Ignore if DM fails
      }
    }

    // Perform Ban
    try {
      await guild.members.ban(user, { reason, deleteMessageSeconds: deleteSeconds });
    } catch {
      await interaction.editReply({
        embeds: [Embeds.error("Failed to ban the user. Please check my permissions.")],
      });
      return;
    }

    // Log to Database
    try {
      await client.auditLogs.create({
        guildId: guild.id,
        action: "MEMBER_BAN",
        executor: interaction.user.id,
        targetId: user.id,
        reason: reason,
        metadata: { deleteMessageSeconds: deleteSeconds },
      });
    } catch (error) {
      console.error("Failed to log ban to database:", error);
    }

    // Log to Discord Channel
    const logEmbed = Embeds.custom({
      title: "🔨 Member Banned",
      fields: [
        { name: "User", value: `${user.tag} (${user.id})`, inline: true },
        { name: "Moderator", value: `${interaction.user.tag}`, inline: true },
        { name: "Reason", value: reason, inline: false },
      ],
      color: Colors.Error,
      timestamp: true,
      thumbnail: user.displayAvatarURL(),
    });

    await client.guildLogger.logModeration(guild, logEmbed);

    // Confirm to Interaction
    await interaction.editReply({
      embeds: [Embeds.success(`**${user.tag}** has been banned.`)],
    });
  },
};

export default command;
