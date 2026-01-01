import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { SafeguardCommand } from "../../types/commands";
import { Embeds, Colors } from "../../structures/Embeds";

const command: SafeguardCommand = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member from the server")
    .addUserOption((option) =>
      option.setName("user").setDescription("The user to kick").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("reason").setDescription("Reason for the kick").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setDMPermission(false),

  category: "moderation",
  guildOnly: true,

  permissions: {
    user: [PermissionFlagsBits.KickMembers],
    bot: [PermissionFlagsBits.KickMembers],
  },

  defer: {
    enabled: true,
    ephemeral: true,
  },

  async execute(client, interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";
    const guild = interaction.guild!;

    // Resolving the member object
    const member = await guild.members.fetch(user.id).catch(() => null);

    if (!member) {
      await interaction.editReply({
        embeds: [Embeds.error("User is not in the server.")],
      });
      return;
    }

    // Check hierarchy: Bot vs Member
    if (!member.kickable) {
      await interaction.editReply({
        embeds: [Embeds.error("I cannot kick this user. They may have a higher role than me.")],
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
          Embeds.error("You cannot kick this user. They have a higher or equal role to you."),
        ],
      });
      return;
    }

    // Send DM to user
    try {
      const dmEmbed = Embeds.custom({
        title: `You were kicked from ${guild.name}`,
        fields: [{ name: "Reason", value: reason, inline: false }],
        color: Colors.Error,
        timestamp: true,
      });
      await member.send({ embeds: [dmEmbed] });
    } catch {
      // Ignore if DM fails
    }

    // Perform Kick
    try {
      await member.kick(reason);
    } catch (error) {
      await interaction.editReply({
        embeds: [Embeds.error("Failed to kick the user. Please check my permissions.")],
      });
      console.error("Failed to kick user:", error);
      return;
    }

    // Log to Database
    try {
      await client.auditLogs.create({
        guildId: guild.id,
        action: "MEMBER_KICK",
        executor: interaction.user.id,
        targetId: user.id,
        reason: reason,
      });
    } catch (error) {
      console.error("Failed to log kick to database:", error);
    }

    // Log to Discord Channel
    const logEmbed = Embeds.custom({
      title: "👞 Member Kicked",
      fields: [
        { name: "User", value: `${user.tag} (${user.id})`, inline: true },
        { name: "Moderator", value: `${interaction.user.tag}`, inline: true },
        { name: "Reason", value: reason, inline: false },
      ],
      color: Colors.Warning,
      timestamp: true,
      thumbnail: user.displayAvatarURL(),
    });

    await client.guildLogger.logModeration(guild, logEmbed);

    // Confirm to Interaction
    await interaction.editReply({
      embeds: [Embeds.success(`**${user.tag}** has been kicked.`)],
    });
  },
};

export default command;
