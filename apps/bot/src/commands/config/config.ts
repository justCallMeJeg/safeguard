import {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { SafeguardCommand } from "../../types/commands";
import type { SafeguardClient } from "../../structures/SafeguardClient";
import { Embeds, Colors } from "../../structures/Embeds";
import type { Guild } from "@safeguard/database";

/**
 * Format a boolean as an emoji status
 */
function formatStatus(enabled: boolean): string {
  return enabled ? "✅ Enabled" : "❌ Disabled";
}

/**
 * Format a channel mention or "Not set"
 */
function formatChannel(channelId: string | null): string {
  return channelId ? `<#${channelId}>` : "`Not set`";
}

/**
 * Format a role mention or "Not set"
 */
function formatRole(roleId: string | null): string {
  return roleId ? `<@&${roleId}>` : "`Not set`";
}

/**
 * Config command - Manage server settings via subcommands.
 *
 * Subcommands:
 * - /config view - View current settings
 * - /config antinuke <enable|disable> - Toggle antinuke
 * - /config logging channel <type> <channel> - Set logging channels
 * - /config logging toggle <enable|disable> - Toggle logging
 * - /config roles <type> <role> - Set mod/admin roles
 * - /config whitelist add <user> - Add to whitelist
 * - /config whitelist remove <user> - Remove from whitelist
 * - /config whitelist list - List whitelisted users
 */
const command: SafeguardCommand = {
  data: new SlashCommandBuilder()
    .setName("config")
    .setDescription("Manage server configuration")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)

    // /config view
    .addSubcommand((sub) => sub.setName("view").setDescription("View current server configuration"))

    // /config antinuke
    .addSubcommand((sub) =>
      sub
        .setName("antinuke")
        .setDescription("Toggle antinuke protection")
        .addStringOption((opt) =>
          opt
            .setName("action")
            .setDescription("Enable or disable antinuke")
            .setRequired(true)
            .addChoices({ name: "Enable", value: "enable" }, { name: "Disable", value: "disable" })
        )
    )

    // /config logging subcommand group
    .addSubcommandGroup((group) =>
      group
        .setName("logging")
        .setDescription("Configure logging settings")
        .addSubcommand((sub) =>
          sub
            .setName("channel")
            .setDescription("Set a logging channel")
            .addStringOption((opt) =>
              opt
                .setName("type")
                .setDescription("Type of logs")
                .setRequired(true)
                .addChoices(
                  { name: "General Logs", value: "logs" },
                  { name: "Moderation Logs", value: "mod" },
                  { name: "Member Join/Leave", value: "member" }
                )
            )
            .addChannelOption((opt) =>
              opt
                .setName("channel")
                .setDescription("Channel for logs (leave empty to disable)")
                .addChannelTypes(ChannelType.GuildText)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("toggle")
            .setDescription("Enable or disable logging")
            .addStringOption((opt) =>
              opt
                .setName("action")
                .setDescription("Enable or disable logging")
                .setRequired(true)
                .addChoices(
                  { name: "Enable", value: "enable" },
                  { name: "Disable", value: "disable" }
                )
            )
        )
    )

    // /config roles subcommand group
    .addSubcommandGroup((group) =>
      group
        .setName("roles")
        .setDescription("Configure staff roles")
        .addSubcommand((sub) =>
          sub
            .setName("set")
            .setDescription("Set a staff role")
            .addStringOption((opt) =>
              opt
                .setName("type")
                .setDescription("Type of role")
                .setRequired(true)
                .addChoices(
                  { name: "Moderator Role", value: "mod" },
                  { name: "Admin Role", value: "admin" },
                  { name: "Muted Role", value: "muted" }
                )
            )
            .addRoleOption((opt) =>
              opt.setName("role").setDescription("Role to set (leave empty to clear)")
            )
        )
        .addSubcommand((sub) => sub.setName("view").setDescription("View configured roles"))
    )

    // /config whitelist subcommand group
    .addSubcommandGroup((group) =>
      group
        .setName("whitelist")
        .setDescription("Manage antinuke whitelist")
        .addSubcommand((sub) =>
          sub
            .setName("add")
            .setDescription("Add a user to the whitelist")
            .addUserOption((opt) =>
              opt.setName("user").setDescription("User to whitelist").setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("remove")
            .setDescription("Remove a user from the whitelist")
            .addUserOption((opt) =>
              opt.setName("user").setDescription("User to remove").setRequired(true)
            )
        )
        .addSubcommand((sub) => sub.setName("list").setDescription("List all whitelisted users"))
    ),

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
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    // Get or create guild settings
    // Get guild settings
    let settings: Guild | null = null;
    try {
      settings = await client.guildSettings.get(guildId);
    } catch {
      // Fallback
    }

    if (!settings) {
      await interaction.editReply({
        embeds: [
          Embeds.info(
            "**Server Not Configured**\n\nThis server has not been configured yet. Please run `/setup` to initialize the bot."
          ),
        ],
      });
      return;
    }

    // Route to appropriate handler
    if (!subcommandGroup) {
      // Direct subcommands (view, antinuke)
      switch (subcommand) {
        case "view":
          await handleView(interaction, settings);
          break;
        case "antinuke":
          await handleAntinuke(client, interaction, settings);
          break;
      }
    } else {
      // Subcommand groups
      switch (subcommandGroup) {
        case "logging":
          await handleLogging(client, interaction, settings, subcommand);
          break;
        case "roles":
          await handleRoles(client, interaction, settings, subcommand);
          break;
        case "whitelist":
          await handleWhitelist(client, interaction, settings, subcommand);
          break;
      }
    }
  },
};

// ============================================================================
// Handler Functions
// ============================================================================

async function handleView(
  interaction: ChatInputCommandInteraction,
  settings: Guild
): Promise<void> {
  const embed = Embeds.custom({
    title: "⚙️ Server Configuration",
    color: Colors.Primary,
    fields: [
      {
        name: "🛡️ Features",
        value: [
          `**Antinuke:** ${formatStatus(settings.antinukeEnabled)}`,
          `**Logging:** ${formatStatus(settings.loggingEnabled)}`,
          `**Welcome:** ${formatStatus(settings.welcomeEnabled)}`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "📝 Log Channels",
        value: [
          `**General:** ${formatChannel(settings.logsChannel)}`,
          `**Moderation:** ${formatChannel(settings.modLogsChannel)}`,
          `**Members:** ${formatChannel(settings.memberLogsChannel)}`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "👥 Roles",
        value: [
          `**Admin:** ${formatRole(settings.adminRole)}`,
          `**Moderator:** ${formatRole(settings.modRole)}`,
          `**Muted:** ${formatRole(settings.mutedRole)}`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "📋 Whitelist",
        value:
          settings.whitelist.length > 0
            ? `${settings.whitelist.length} user(s) whitelisted`
            : "No users whitelisted",
        inline: false,
      },
    ],
  });

  await interaction.editReply({ embeds: [embed] });
}

async function handleAntinuke(
  client: SafeguardClient,
  interaction: ChatInputCommandInteraction,
  settings: Guild
): Promise<void> {
  const action = interaction.options.getString("action", true);
  const enable = action === "enable";

  if (settings.antinukeEnabled === enable) {
    await interaction.editReply({
      embeds: [Embeds.warning(`Antinuke is already ${enable ? "enabled" : "disabled"}.`)],
    });
    return;
  }

  const updated = enable
    ? await client.guildSettings.enableAntinuke(interaction.guildId!)
    : await client.guildSettings.disableAntinuke(interaction.guildId!);

  if (!updated) {
    await interaction.editReply({
      embeds: [Embeds.error("Failed to update antinuke setting.")],
    });
    return;
  }

  await interaction.editReply({
    embeds: [
      Embeds.success(`Antinuke protection has been **${enable ? "enabled" : "disabled"}**.`),
    ],
  });
}

async function handleLogging(
  client: SafeguardClient,
  interaction: ChatInputCommandInteraction,
  settings: Guild,
  subcommand: string
): Promise<void> {
  const guildId = interaction.guildId!;

  if (subcommand === "toggle") {
    const action = interaction.options.getString("action", true);
    const enable = action === "enable";

    const updated = await client.guildSettings.update(guildId, {
      loggingEnabled: enable,
    });

    if (!updated) {
      await interaction.editReply({
        embeds: [Embeds.error("Failed to update logging setting.")],
      });
      return;
    }

    await interaction.editReply({
      embeds: [Embeds.success(`Logging has been **${enable ? "enabled" : "disabled"}**.`)],
    });
  } else if (subcommand === "channel") {
    const type = interaction.options.getString("type", true);
    const channel = interaction.options.getChannel("channel");
    const channelId = channel?.id ?? null;

    const updateData: Partial<Guild> = {};
    let channelName: string;

    switch (type) {
      case "logs":
        updateData.logsChannel = channelId;
        channelName = "General logs";
        break;
      case "mod":
        updateData.modLogsChannel = channelId;
        channelName = "Moderation logs";
        break;
      case "member":
        updateData.memberLogsChannel = channelId;
        channelName = "Member logs";
        break;
      default:
        return;
    }

    const updated = await client.guildSettings.update(guildId, updateData);

    if (!updated) {
      await interaction.editReply({
        embeds: [Embeds.error("Failed to update logging channel.")],
      });
      return;
    }

    if (channelId) {
      await interaction.editReply({
        embeds: [Embeds.success(`${channelName} channel set to <#${channelId}>.`)],
      });
    } else {
      await interaction.editReply({
        embeds: [Embeds.success(`${channelName} channel has been cleared.`)],
      });
    }
  }
}

async function handleRoles(
  client: SafeguardClient,
  interaction: ChatInputCommandInteraction,
  settings: Guild,
  subcommand: string
): Promise<void> {
  const guildId = interaction.guildId!;

  if (subcommand === "view") {
    const embed = Embeds.custom({
      title: "👥 Configured Roles",
      fields: [
        {
          name: "Admin Role",
          value: formatRole(settings.adminRole),
          inline: true,
        },
        {
          name: "Moderator Role",
          value: formatRole(settings.modRole),
          inline: true,
        },
        {
          name: "Muted Role",
          value: formatRole(settings.mutedRole),
          inline: true,
        },
      ],
    });

    await interaction.editReply({ embeds: [embed] });
  } else if (subcommand === "set") {
    const type = interaction.options.getString("type", true);
    const role = interaction.options.getRole("role");
    const roleId = role?.id ?? null;

    const updateData: Partial<Guild> = {};
    let roleName: string;

    switch (type) {
      case "mod":
        updateData.modRole = roleId;
        roleName = "Moderator";
        break;
      case "admin":
        updateData.adminRole = roleId;
        roleName = "Admin";
        break;
      case "muted":
        updateData.mutedRole = roleId;
        roleName = "Muted";
        break;
      default:
        return;
    }

    const updated = await client.guildSettings.update(guildId, updateData);

    if (!updated) {
      await interaction.editReply({
        embeds: [Embeds.error("Failed to update role setting.")],
      });
      return;
    }

    if (roleId) {
      await interaction.editReply({
        embeds: [Embeds.success(`${roleName} role set to <@&${roleId}>.`)],
      });
    } else {
      await interaction.editReply({
        embeds: [Embeds.success(`${roleName} role has been cleared.`)],
      });
    }
  }
}

async function handleWhitelist(
  client: SafeguardClient,
  interaction: ChatInputCommandInteraction,
  settings: Guild,
  subcommand: string
): Promise<void> {
  const guildId = interaction.guildId!;

  switch (subcommand) {
    case "add": {
      const user = interaction.options.getUser("user", true);

      if (settings.whitelist.includes(user.id)) {
        await interaction.editReply({
          embeds: [Embeds.warning(`${user} is already whitelisted.`)],
        });
        return;
      }

      const updated = await client.guildSettings.addToWhitelist(guildId, user.id);

      if (!updated) {
        await interaction.editReply({
          embeds: [Embeds.error("Failed to add user to whitelist.")],
        });
        return;
      }

      await interaction.editReply({
        embeds: [Embeds.success(`${user} has been added to the whitelist.`)],
      });
      break;
    }

    case "remove": {
      const user = interaction.options.getUser("user", true);

      if (!settings.whitelist.includes(user.id)) {
        await interaction.editReply({
          embeds: [Embeds.warning(`${user} is not on the whitelist.`)],
        });
        return;
      }

      const updated = await client.guildSettings.removeFromWhitelist(guildId, user.id);

      if (!updated) {
        await interaction.editReply({
          embeds: [Embeds.error("Failed to remove user from whitelist.")],
        });
        return;
      }

      await interaction.editReply({
        embeds: [Embeds.success(`${user} has been removed from the whitelist.`)],
      });
      break;
    }

    case "list": {
      if (settings.whitelist.length === 0) {
        await interaction.editReply({
          embeds: [Embeds.info("No users are currently whitelisted.")],
        });
        return;
      }

      const userList = settings.whitelist.map((id) => `<@${id}>`).join("\n");

      const embed = Embeds.custom({
        title: "📋 Whitelisted Users",
        description: userList,
        fields: [
          {
            name: "Total",
            value: `${settings.whitelist.length} user(s)`,
            inline: true,
          },
        ],
      });

      await interaction.editReply({ embeds: [embed] });
      break;
    }
  }
}

export default command;
