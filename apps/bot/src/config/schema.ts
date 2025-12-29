import { z } from "zod";

/**
 * Helper to parse comma-separated strings into arrays
 */
const commaSeparatedArray = z
  .string()
  .transform((val: string) =>
    val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  )
  .or(z.array(z.string()));

/**
 * Helper for hex color values (accepts 0x or # prefix, or plain number)
 */
const hexColor = z.union([z.string(), z.number()]).transform((val: string | number) => {
  if (typeof val === "number") return val;
  // Remove 0x or # prefix and parse as hex
  const cleaned = val.replace(/^(0x|#)/, "");
  return parseInt(cleaned, 16);
});

/**
 * Bot credentials and identity configuration
 */
export const BotConfigSchema = z.object({
  /** Discord bot token (required, from BOT_TOKEN env) */
  token: z.string().min(1, "Bot token is required"),

  /** Discord application client ID (required) */
  clientId: z.string().min(1, "Client ID is required"),

  /** Discord application public key */
  publicKey: z.string().optional(),

  /** Discord application client secret */
  clientSecret: z.string().optional(),

  /** Bot owner user IDs (can use commands with ownerOnly: true) */
  ownerIds: commaSeparatedArray.default([]),

  /** Development guild ID for instant command updates */
  devGuildId: z.string().optional(),
});

/**
 * Embed color configuration
 */
export const ColorsConfigSchema = z.object({
  primary: hexColor.default(0x5865f2), // Discord Blurple
  success: hexColor.default(0x57f287), // Green
  error: hexColor.default(0xed4245), // Red
  warning: hexColor.default(0xfee75c), // Yellow
  info: hexColor.default(0x5865f2), // Blurple
  moderation: hexColor.default(0xeb459e), // Fuchsia
});

/**
 * Cooldown configuration
 */
export const CooldownConfigSchema = z.object({
  /** Default command cooldown in milliseconds */
  defaultMs: z.number().min(0).default(3000),

  /** Role IDs that bypass cooldowns */
  bypassRoles: commaSeparatedArray.default([]),

  /** User IDs that bypass cooldowns (in addition to owners) */
  bypassUsers: commaSeparatedArray.default([]),
});

/**
 * Feature flags for enabling/disabling functionality
 */
export const FeaturesConfigSchema = z.object({
  /** Enable hot reload for commands/events in development */
  hotReload: z.boolean().default(true),

  /** Enable debug mode with extra logging */
  debugMode: z.boolean().default(false),

  /** Enable verbose logging of all events */
  verboseEvents: z.boolean().default(false),

  /** Auto-deploy commands to dev guild on startup */
  autoDeployDev: z.boolean().default(true),
});

/**
 * Bot settings configuration
 */
export const SettingsConfigSchema = z.object({
  /** Default command prefix (for future message commands) */
  defaultPrefix: z.string().default("!"),

  /** Embed colors */
  colors: ColorsConfigSchema.optional(),

  /** Cooldown settings */
  cooldowns: CooldownConfigSchema.optional(),

  /** Feature flags */
  features: FeaturesConfigSchema.optional(),
});

/**
 * Logging configuration
 */
export const LoggingConfigSchema = z.object({
  /** Log level: debug, info, warn, error */
  level: z.enum(["debug", "info", "warn", "error"]).default("info"),

  /** Show timestamps in logs */
  timestamps: z.boolean().default(true),

  /** Use colors in log output */
  colors: z.boolean().default(true),

  /** Compact log format */
  compact: z.boolean().default(false),
});

/**
 * Complete Safeguard configuration schema
 */
export const SafeguardConfigSchema = z.object({
  /** Bot credentials and identity */
  bot: BotConfigSchema,

  /** Bot settings and preferences */
  settings: SettingsConfigSchema.optional(),

  /** Logging configuration */
  logging: LoggingConfigSchema.optional(),
});

/**
 * Inferred TypeScript types from schemas
 */
export type BotConfig = z.infer<typeof BotConfigSchema>;
export type ColorsConfig = z.infer<typeof ColorsConfigSchema>;
export type CooldownConfig = z.infer<typeof CooldownConfigSchema>;
export type FeaturesConfig = z.infer<typeof FeaturesConfigSchema>;
export type SettingsConfig = z.infer<typeof SettingsConfigSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;

/** Raw parsed config (with optional nested objects) */
type RawSafeguardConfig = z.infer<typeof SafeguardConfigSchema>;

/**
 * Normalized SafeguardConfig with all nested objects guaranteed.
 * After parsing and applying defaults, these are always present.
 */
export interface SafeguardConfig {
  bot: BotConfig;
  settings: Required<SettingsConfig> & {
    colors: ColorsConfig;
    cooldowns: CooldownConfig;
    features: FeaturesConfig;
  };
  logging: LoggingConfig;
}

/**
 * Deep partial type for config overrides
 */
export type PartialSafeguardConfig = z.input<typeof SafeguardConfigSchema>;

/**
 * Apply defaults to optional nested objects
 */
export function normalizeConfig(raw: RawSafeguardConfig): SafeguardConfig {
  return {
    bot: raw.bot,
    settings: {
      defaultPrefix: raw.settings?.defaultPrefix ?? "!",
      colors: {
        primary: raw.settings?.colors?.primary ?? 0x5865f2,
        success: raw.settings?.colors?.success ?? 0x57f287,
        error: raw.settings?.colors?.error ?? 0xed4245,
        warning: raw.settings?.colors?.warning ?? 0xfee75c,
        info: raw.settings?.colors?.info ?? 0x5865f2,
        moderation: raw.settings?.colors?.moderation ?? 0xeb459e,
      },
      cooldowns: {
        defaultMs: raw.settings?.cooldowns?.defaultMs ?? 3000,
        bypassRoles: raw.settings?.cooldowns?.bypassRoles ?? [],
        bypassUsers: raw.settings?.cooldowns?.bypassUsers ?? [],
      },
      features: {
        hotReload: raw.settings?.features?.hotReload ?? true,
        debugMode: raw.settings?.features?.debugMode ?? false,
        verboseEvents: raw.settings?.features?.verboseEvents ?? false,
        autoDeployDev: raw.settings?.features?.autoDeployDev ?? true,
      },
    },
    logging: {
      level: raw.logging?.level ?? "info",
      timestamps: raw.logging?.timestamps ?? true,
      colors: raw.logging?.colors ?? true,
      compact: raw.logging?.compact ?? false,
    },
  };
}
