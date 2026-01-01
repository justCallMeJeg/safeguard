import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type TextChannel,
} from "discord.js";
import type { SafeguardCommand } from "../../types/commands";
import { Embeds, Colors } from "../../structures/Embeds";

const command: SafeguardCommand = {
  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete a number of messages")
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("Number of messages to delete (1-100)")
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Only delete messages from this user")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  category: "moderation",
  guildOnly: true,

  permissions: {
    user: [PermissionFlagsBits.ManageMessages],
    bot: [PermissionFlagsBits.ManageMessages],
  },

  defer: {
    enabled: true,
    ephemeral: true,
  },

  async execute(client, interaction: ChatInputCommandInteraction) {
    const amount = interaction.options.getInteger("amount", true);
    const user = interaction.options.getUser("user");
    const channel = interaction.channel as TextChannel;
    const guild = interaction.guild!;

    if (!channel.isTextBased() || channel.isDMBased()) {
      await interaction.editReply({
        embeds: [Embeds.error("This command can only be used in text channels.")],
      });
      return;
    }

    // Fetch messages
    const messages = await channel.messages.fetch({ limit: amount });

    // Filter by user if specified
    const filteredMessages = user ? messages.filter((m) => m.author.id === user.id) : messages;

    if (filteredMessages.size === 0) {
      await interaction.editReply({
        embeds: [Embeds.info("No messages found to delete.")],
      });
      return;
    }

    // Perform Delete
    try {
      const deleted = await channel.bulkDelete(filteredMessages, true);

      // Log to Database
      try {
        await client.auditLogs.create({
          guildId: guild.id,
          action: "CHANNEL_PURGE",
          executor: interaction.user.id,
          targetId: channel.id,
          reason: `Purged ${deleted.size} messages`,
          metadata: { amount: deleted.size, filterUser: user?.id },
        });
      } catch (error) {
        console.error("Failed to log purge to database:", error);
      }

      // Log to Discord Channel (only if not self-logging spam)
      const settings = await client.guildSettings.get(guild.id);
      if (settings?.modLogsChannel && settings.modLogsChannel !== channel.id) {
        const logEmbed = Embeds.custom({
          title: "🧹 Messages Purged",
          fields: [
            { name: "Channel", value: `<#${channel.id}>`, inline: true },
            { name: "Moderator", value: `${interaction.user.tag}`, inline: true },
            { name: "Amount", value: `${deleted.size}`, inline: true },
            ...(user ? [{ name: "Filter User", value: `${user.tag}`, inline: true }] : []),
          ],
          color: Colors.Info,
          timestamp: true,
        });

        // Note: We still fetch settings above for the channel ID check,
        // but prefer using GuildLogger for consistency and enable/disable checks
        // However, GuildLogger doesn't support the "different channel" check internally.
        // For purge, we might just double check or let GuildLogger handle it.
        // But since we want to avoid logging TO the channel we just purged (if it happens to be the log channel),
        // we keep the check.
        // ACTUALLY, GuildLogger just logs to modLogsChannel. If modLogsChannel IS the current channel, it's fine
        // (the log message comes after the purge).

        await client.guildLogger.logModeration(guild, logEmbed);
      }

      await interaction.editReply({
        embeds: [Embeds.success(`Deleted **${deleted.size}** messages.`)],
      });
    } catch (error) {
      await interaction.editReply({
        embeds: [
          Embeds.error(
            "Failed to delete messages. Messages older than 14 days cannot be bulk deleted."
          ),
        ],
      });
      console.error("Failed to delete messages:", error);
    }
  },
};

export default command;
