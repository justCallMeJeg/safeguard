import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  StringSelectMenuBuilder,
  ChannelType,
  ComponentType,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
} from "discord.js";
import type { SafeguardCommand } from "../../types/commands";
import { Embeds, Colors } from "../../structures/Embeds";
import type { Guild } from "@safeguard/database";

/**
 * Setup Wizard Command - Interactive configuration for server settings.
 */
const command: SafeguardCommand = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Interactive setup wizard for server configuration")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  category: "config",
  guildOnly: true,

  permissions: {
    user: [PermissionFlagsBits.Administrator],
  },

  defer: {
    enabled: true,
    ephemeral: true,
  },

  async execute(client, interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;

    // Initial fetch of settings to show defaults
    let currentSettings: Guild | null = null;

    try {
      // Check if settings already exist
      currentSettings = await client.guildSettings.get(guildId);

      if (currentSettings) {
        // Warn user that config exists
        const confirmEmbed = Embeds.warning(
          "**Configuration Already Exists**\n\nThis server is already configured. Running the setup wizard will overwrite your existing settings.\n\nDo you want to continue?"
        );

        const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("setup_confirm_continue")
            .setLabel("Continue")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId("setup_confirm_cancel")
            .setLabel("Cancel")
            .setStyle(ButtonStyle.Secondary)
        );

        const response = await interaction.editReply({
          embeds: [confirmEmbed],
          components: [confirmRow],
        });

        try {
          const confirmation = await response.awaitMessageComponent({
            filter: (i) => i.user.id === interaction.user.id,
            time: 30_000,
            componentType: ComponentType.Button,
          });

          if (confirmation.customId === "setup_confirm_cancel") {
            await confirmation.update({
              content: "Setup cancelled.",
              embeds: [],
              components: [],
            });
            return;
          }

          // User clicked continue
          await confirmation.deferUpdate();
        } catch {
          await interaction.editReply({
            content: "Setup timed out.",
            embeds: [],
            components: [],
          });
          return;
        }
      } else {
        // Create default settings for the wizard session
        currentSettings = await client.guildSettings.getOrCreate(guildId);
      }
    } catch {
      await interaction.editReply({
        embeds: [Embeds.error("Failed to initialize setup. Please try again.")],
      });
      return;
    }

    // Session state
    const session = {
      adminRole: currentSettings.adminRole,
      modRole: currentSettings.modRole,
      mutedRole: currentSettings.mutedRole,
      logsChannel: currentSettings.logsChannel,
      modLogsChannel: currentSettings.modLogsChannel,
      memberLogsChannel: currentSettings.memberLogsChannel,
      antinuke: currentSettings.antinukeEnabled,
      logging: currentSettings.loggingEnabled,
    };

    // --- Step 1: Introduction ---
    const startEmbed = Embeds.custom({
      title: "🚀 Server Setup Wizard",
      description:
        "Welcome to Safeguard! This wizard will help you configure the essential settings for your server.\n\n**Steps:**\n1️⃣ Roles (Admin, Mod, Muted)\n2️⃣ Logging Channels\n3️⃣ Feature Toggles\n\nClick **Start** to begin.",
      color: Colors.Primary,
    });

    const startRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("setup_start")
        .setLabel("Start Setup")
        .setStyle(ButtonStyle.Success)
    );

    const message = await interaction.editReply({
      embeds: [startEmbed],
      components: [startRow],
    });

    const collector = message.createMessageComponentCollector({
      // Removed componentType filter to allow all component types
      time: 300_000, // 5 minutes
      filter: (i) => i.user.id === interaction.user.id,
    });

    // We'll manage flow manually with checks
    let step = 0; // 0: Start, 1: Roles, 2: Channels, 3: Features, 4: Summary

    // Helper to render steps
    const renderStep = async (i: MessageComponentInteraction) => {
      switch (step) {
        case 1: // Roles
          await showRolesStep(i);
          break;
        case 2: // Channels
          await showChannelsStep(i);
          break;
        case 3: // Features
          await showFeaturesStep(i);
          break;
        case 4: // Summary
          await showSummaryStep(i);
          break;
      }
    };

    // --- Step Renderers ---

    const showRolesStep = async (i: MessageComponentInteraction) => {
      const embed = Embeds.custom({
        title: "1️⃣ Configure Roles",
        description: "Select the roles for each permission level.",
        color: Colors.Primary,
      });

      const adminRow = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId("setup_role_admin")
          .setPlaceholder("Select Administrator Role")
      );
      if (session.adminRole) {
        // Attempt to pre-fill if supported by the builder version, using setDefaultRoles
        // Note: Typed as any to bypass potential type definition mismatches if local types are outdated
        // This is a temporary measure to ensure compilation if the method exists at runtime
        // However, safest is to use addDefaultRoles if available or just omit.
        // Let's omit defaults for now to GUARANTEE fix as per plan "simplify if unsure".
      }

      const modRow = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId("setup_role_mod")
          .setPlaceholder("Select Moderator Role")
      );

      const mutedRow = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId("setup_role_muted")
          .setPlaceholder("Select Muted Role")
      );

      const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("setup_next")
          .setLabel("Next")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("setup_cancel")
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Danger)
      );

      await i.update({
        embeds: [embed],
        components: [adminRow, modRow, mutedRow, navRow],
      });
    };

    const showChannelsStep = async (i: MessageComponentInteraction) => {
      const embed = Embeds.custom({
        title: "2️⃣ Configure Logging Channels",
        description: "Select the channels where logs will be sent.",
        color: Colors.Primary,
      });

      const logsRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("setup_channel_logs")
          .setPlaceholder("Select General Logs Channel")
          .addChannelTypes(ChannelType.GuildText)
      );

      const modLogsRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("setup_channel_mod")
          .setPlaceholder("Select Moderation Logs Channel")
          .addChannelTypes(ChannelType.GuildText)
      );

      const memberLogsRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("setup_channel_member")
          .setPlaceholder("Select Member Logs Channel")
          .addChannelTypes(ChannelType.GuildText)
      );

      const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("setup_back")
          .setLabel("Back")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("setup_next")
          .setLabel("Next")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("setup_cancel")
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Danger)
      );

      await i.update({
        embeds: [embed],
        components: [logsRow, modLogsRow, memberLogsRow, navRow],
      });
    };

    const showFeaturesStep = async (i: MessageComponentInteraction) => {
      const embed = Embeds.custom({
        title: "3️⃣ Enable Features",
        description: "Toggle the features you want to enable.",
        color: Colors.Primary,
      });

      const featuresRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("setup_features")
          .setPlaceholder("Select Active Features")
          .setMinValues(0)
          .setMaxValues(2)
          .addOptions([
            {
              label: "Antinuke Protection",
              value: "antinuke",
              description: "Prevent mass deletions and unauthorized changes",
              default: session.antinuke,
              emoji: "🛡️",
            },
            {
              label: "Logging System",
              value: "logging",
              description: "Log server events to configured channels",
              default: session.logging,
              emoji: "📝",
            },
          ])
      );

      const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("setup_back")
          .setLabel("Back")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("setup_next")
          .setLabel("Next")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("setup_cancel")
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Danger)
      );

      await i.update({
        embeds: [embed],
        components: [featuresRow, navRow],
      });
    };

    const showSummaryStep = async (i: MessageComponentInteraction) => {
      const embed = Embeds.custom({
        title: "✅ Review Configuration",
        description: "Please review your settings before saving.",
        fields: [
          {
            name: "👥 Roles",
            value: [
              `**Admin:** ${session.adminRole ? `<@&${session.adminRole}>` : "`Not set`"}`,
              `**Mod:** ${session.modRole ? `<@&${session.modRole}>` : "`Not set`"}`,
              `**Muted:** ${session.mutedRole ? `<@&${session.mutedRole}>` : "`Not set`"}`,
            ].join("\n"),
            inline: true,
          },
          {
            name: "📝 Channels",
            value: [
              `**General:** ${session.logsChannel ? `<#${session.logsChannel}>` : "`Not set`"}`,
              `**Mod:** ${session.modLogsChannel ? `<#${session.modLogsChannel}>` : "`Not set`"}`,
              `**Member:** ${session.memberLogsChannel ? `<#${session.memberLogsChannel}>` : "`Not set`"}`,
            ].join("\n"),
            inline: true,
          },
          {
            name: "🛡️ Features",
            value: [
              `**Antinuke:** ${session.antinuke ? "✅ Enabled" : "❌ Disabled"}`,
              `**Logging:** ${session.logging ? "✅ Enabled" : "❌ Disabled"}`,
            ].join("\n"),
            inline: false,
          },
        ],
        color: Colors.Success,
      });

      const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("setup_back")
          .setLabel("Back")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("setup_finish")
          .setLabel("Save & Finish")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("setup_cancel")
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Danger)
      );

      await i.update({
        embeds: [embed],
        components: [navRow],
      });
    };

    // --- Component Interactions ---

    collector.on("collect", async (i) => {
      try {
        // Navigation
        if (i.customId === "setup_start") {
          step = 1;
          await renderStep(i as MessageComponentInteraction);
        } else if (i.customId === "setup_next") {
          step++;
          await renderStep(i as MessageComponentInteraction);
        } else if (i.customId === "setup_back") {
          step--;
          await renderStep(i as MessageComponentInteraction);
        } else if (i.customId === "setup_cancel") {
          await i.update({
            content: "Setup cancelled.",
            embeds: [],
            components: [],
          });
          collector.stop("cancelled");
        } else if (i.customId === "setup_finish") {
          // Save logic
          collector.stop("finished");

          // Construct update payload
          const updateData: Partial<Guild> = {
            adminRole: session.adminRole,
            modRole: session.modRole,
            mutedRole: session.mutedRole,
            logsChannel: session.logsChannel,
            modLogsChannel: session.modLogsChannel,
            memberLogsChannel: session.memberLogsChannel,
            loggingEnabled: session.logging,
          };

          const success = await client.guildSettings.update(guildId, updateData);

          if (session.antinuke !== currentSettings.antinukeEnabled) {
            if (session.antinuke) {
              await client.guildSettings.enableAntinuke(guildId);
            } else {
              await client.guildSettings.disableAntinuke(guildId);
            }
          }

          if (success) {
            await i.update({
              content: null,
              embeds: [Embeds.success("✅ **Setup Complete!** configuration has been saved.")],
              components: [],
            });
          } else {
            await i.update({
              content: null,
              embeds: [Embeds.error("❌ Failed to save configuration. Please check the logs.")],
              components: [],
            });
          }
        }

        // Input Collection
        else if (i.isRoleSelectMenu()) {
          const roleId = i.values[0] ?? null;
          if (i.customId === "setup_role_admin") session.adminRole = roleId;
          if (i.customId === "setup_role_mod") session.modRole = roleId;
          if (i.customId === "setup_role_muted") session.mutedRole = roleId;

          await i.deferUpdate();
        } else if (i.isChannelSelectMenu()) {
          const channelId = i.values[0] ?? null;
          if (i.customId === "setup_channel_logs") session.logsChannel = channelId;
          if (i.customId === "setup_channel_mod") session.modLogsChannel = channelId;
          if (i.customId === "setup_channel_member") session.memberLogsChannel = channelId;

          await i.deferUpdate();
        } else if (i.isStringSelectMenu()) {
          if (i.customId === "setup_features") {
            session.antinuke = i.values.includes("antinuke");
            session.logging = i.values.includes("logging");
            await i.deferUpdate();
          }
        }
      } catch (error) {
        console.error(error);
        // Don't crash collector
      }
    });

    collector.on("end", (_, reason) => {
      if (reason === "time") {
        interaction
          .editReply({
            content: "Setup timed out.",
            embeds: [],
            components: [],
          })
          .catch(() => {});
      }
    });
  },
};

export default command;
