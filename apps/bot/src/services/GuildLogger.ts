import { type EmbedBuilder, type Guild, type TextChannel } from "discord.js";
import { guildSettings } from "./GuildSettingsService";
import { Logger } from "../structures/Logger";

export class GuildLogger {
  private static instance: GuildLogger | null = null;

  private constructor() {}

  static getInstance(): GuildLogger {
    if (!this.instance) {
      this.instance = new GuildLogger();
    }
    return this.instance;
  }

  /**
   * Log to the General Logs channel
   */
  async logGeneral(guild: Guild, embed: EmbedBuilder): Promise<void> {
    await this.logToChannel(guild, "logsChannel", embed);
  }

  /**
   * Log to the Moderation Logs channel
   */
  async logModeration(guild: Guild, embed: EmbedBuilder): Promise<void> {
    await this.logToChannel(guild, "modLogsChannel", embed);
  }

  /**
   * Log to the Member Logs channel
   */
  async logMember(guild: Guild, embed: EmbedBuilder): Promise<void> {
    await this.logToChannel(guild, "memberLogsChannel", embed);
  }

  /**
   * Internal helper to send the log
   */
  private async logToChannel(
    guild: Guild,
    channelType: "logsChannel" | "modLogsChannel" | "memberLogsChannel",
    embed: EmbedBuilder
  ): Promise<void> {
    try {
      // 1. Get settings
      const settings = await guildSettings.get(guild.id);

      // 2. Check if logging is globally enabled for this guild
      if (!settings || !settings.loggingEnabled) {
        return;
      }

      // 3. Get the specific channel ID
      const channelId = settings[channelType];
      if (!channelId) {
        return;
      }

      // 4. Resolve channel
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) {
        return;
      }

      // 5. Send log
      await (channel as TextChannel).send({ embeds: [embed] });
    } catch (error) {
      Logger.error("GuildLogger", `Failed to log to ${channelType} in guild ${guild.id}: ${error}`);
    }
  }
}

export const guildLogger = GuildLogger.getInstance();
