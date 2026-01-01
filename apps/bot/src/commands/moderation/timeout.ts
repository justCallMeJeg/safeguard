import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { SafeguardCommand } from "../../types/commands";
import { Embeds, Colors } from "../../structures/Embeds";
import { parseDuration } from "../../utils/time";

const command: SafeguardCommand = {
  data: new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout (mute) a member")
    .addUserOption((option) =>
      option.setName("user").setDescription("The user to timeout").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("duration").setDescription("Duration (e.g. 1h, 30m, 1d)").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("reason").setDescription("Reason for the timeout").setRequired(false)
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
    const durationInput = interaction.options.getString("duration", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";
    const guild = interaction.guild!;

    // Resolve duration
    const durationMs = parseDuration(durationInput);
    if (!durationMs) {
      await interaction.editReply({
        embeds: [Embeds.error("Invalid duration format. Use format like `1h`, `30m`, `1d`.")],
      });
      return;
    }

    // Discord limit: 28 days
    if (durationMs > 28 * 24 * 60 * 60 * 1000) {
      await interaction.editReply({
        embeds: [Embeds.error("Timeout duration cannot exceed 28 days.")],
      });
      return;
    }

    // Resolving the member object
    const member = await guild.members.fetch(user.id).catch(() => null);

    if (!member) {
      await interaction.editReply({
        embeds: [Embeds.error("User is not in the server.")],
      });
      return;
    }

    // Check hierarchy: Bot vs Member
    if (!member.moderatable) {
      await interaction.editReply({
        embeds: [Embeds.error("I cannot timeout this user. They may have a higher role than me.")],
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
          Embeds.error("You cannot timeout this user. They have a higher or equal role to you."),
        ],
      });
      return;
    }

    // Send DM to user
    try {
      const dmEmbed = Embeds.custom({
        title: `You were timed out in ${guild.name}`,
        fields: [
          { name: "Duration", value: durationInput, inline: true },
          { name: "Reason", value: reason, inline: true },
        ],
        color: Colors.Warning,
        timestamp: true,
      });
      await member.send({ embeds: [dmEmbed] });
    } catch {
      // Ignore if DM fails
    }

    // Perform Timeout
    try {
      await member.timeout(durationMs, reason);
    } catch (error) {
      await interaction.editReply({
        embeds: [Embeds.error("Failed to timeout the user. Please check my permissions.")],
      });
      return;
    }

    // Log to Database
    try {
      await client.auditLogs.create({
        guildId: guild.id,
        action: "MEMBER_TIMEOUT",
        executor: interaction.user.id,
        targetId: user.id,
        reason: reason,
        metadata: { duration: durationMs, durationString: durationInput },
      });
    } catch (error) {
      console.error("Failed to log timeout to database:", error);
    }

    // Log to Discord Channel
    const settings = await client.guildSettings.get(guild.id);
    if (settings?.modLogsChannel) {
      const logChannel = await guild.channels.fetch(settings.modLogsChannel).catch(() => null);
      if (logChannel && logChannel.isTextBased()) {
        const logEmbed = Embeds.custom({
          title: "🔇 Member Timed Out",
          fields: [
            { name: "User", value: `${user.tag} (${user.id})`, inline: true },
            { name: "Moderator", value: `${interaction.user.tag}`, inline: true },
            { name: "Duration", value: durationInput, inline: true },
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
      embeds: [Embeds.success(`**${user.tag}** has been timed out for **${durationInput}**.`)],
    });
  },
};

export default command;
