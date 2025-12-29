/**
 * Guild settings types for the Safeguard bot.
 * These types mirror the Prisma Guild model but provide
 * a cleaner interface for the service layer.
 */

/**
 * Feature toggles for a guild
 */
export interface GuildFeatures {
  /** Enable antinuke protection */
  antinukeEnabled: boolean;
  /** Enable logging */
  loggingEnabled: boolean;
  /** Enable welcome messages */
  welcomeEnabled: boolean;
}

/**
 * Channel configuration for a guild
 */
export interface GuildChannels {
  /** General bot logs channel */
  logsChannel: string | null;
  /** Moderation action logs channel */
  modLogsChannel: string | null;
  /** Member join/leave logs channel */
  memberLogsChannel: string | null;
}

/**
 * Role configuration for a guild
 */
export interface GuildRoles {
  /** Role applied to muted members */
  mutedRole: string | null;
  /** Moderator role (permission level) */
  modRole: string | null;
  /** Admin role (higher permission level) */
  adminRole: string | null;
}

/**
 * Complete guild settings object
 */
export interface GuildSettings {
  /** Discord guild ID */
  id: string;

  /** Feature toggles */
  features: GuildFeatures;

  /** Channel configuration */
  channels: GuildChannels;

  /** Role configuration */
  roles: GuildRoles;

  /** Whitelist of user/role IDs exempt from antinuke */
  whitelist: string[];

  /** When the guild was first registered */
  createdAt: Date;

  /** When settings were last updated */
  updatedAt: Date;
}

/**
 * Partial guild settings for updates
 * All fields are optional
 */
export interface GuildSettingsUpdate {
  features?: Partial<GuildFeatures>;
  channels?: Partial<GuildChannels>;
  roles?: Partial<GuildRoles>;
  whitelist?: string[];
}

/**
 * Default settings for new guilds
 */
export const DEFAULT_GUILD_SETTINGS: Omit<GuildSettings, "id" | "createdAt" | "updatedAt"> = {
  features: {
    antinukeEnabled: false,
    loggingEnabled: true,
    welcomeEnabled: false,
  },
  channels: {
    logsChannel: null,
    modLogsChannel: null,
    memberLogsChannel: null,
  },
  roles: {
    mutedRole: null,
    modRole: null,
    adminRole: null,
  },
  whitelist: [],
};
