import {
  EmbedBuilder,
  type APIEmbed,
  type ColorResolvable,
  type EmbedAuthorOptions,
  type EmbedFooterOptions,
} from "discord.js";

/**
 * Safeguard brand colors
 */
export const Colors = {
  Primary: 0x5865f2, // Discord Blurple
  Success: 0x57f287, // Green
  Warning: 0xfee75c, // Yellow
  Error: 0xed4245, // Red
  Info: 0x5865f2, // Blurple
  Moderation: 0xeb459e, // Fuchsia
} as const;

/**
 * Embed options for creating branded embeds
 */
export interface EmbedOptions {
  title?: string;
  description?: string;
  color?: ColorResolvable;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  thumbnail?: string;
  image?: string;
  author?: EmbedAuthorOptions;
  footer?: EmbedFooterOptions;
  timestamp?: boolean | Date;
}

/**
 * Utility class for creating consistent, branded embeds
 */
export class Embeds {
  /**
   * Create a base embed with Safeguard branding
   */
  private static create(options: EmbedOptions): EmbedBuilder {
    const embed = new EmbedBuilder();

    if (options.title) embed.setTitle(options.title);
    if (options.description) embed.setDescription(options.description);
    if (options.color) embed.setColor(options.color);
    if (options.fields) embed.addFields(options.fields);
    if (options.thumbnail) embed.setThumbnail(options.thumbnail);
    if (options.image) embed.setImage(options.image);
    if (options.author) embed.setAuthor(options.author);
    if (options.footer) embed.setFooter(options.footer);

    if (options.timestamp) {
      embed.setTimestamp(options.timestamp === true ? new Date() : options.timestamp);
    }

    return embed;
  }

  /**
   * Create a success embed (green)
   * @param message - The success message
   * @param options - Additional embed options
   */
  static success(message: string, options?: Partial<EmbedOptions>): EmbedBuilder {
    return this.create({
      description: `✅ ${message}`,
      color: Colors.Success,
      timestamp: true,
      ...options,
    });
  }

  /**
   * Create an error embed (red)
   * @param message - The error message
   * @param options - Additional embed options
   */
  static error(message: string, options?: Partial<EmbedOptions>): EmbedBuilder {
    return this.create({
      description: `❌ ${message}`,
      color: Colors.Error,
      timestamp: true,
      ...options,
    });
  }

  /**
   * Create a warning embed (yellow)
   * @param message - The warning message
   * @param options - Additional embed options
   */
  static warning(message: string, options?: Partial<EmbedOptions>): EmbedBuilder {
    return this.create({
      description: `⚠️ ${message}`,
      color: Colors.Warning,
      timestamp: true,
      ...options,
    });
  }

  /**
   * Create an info embed (blurple)
   * @param message - The info message
   * @param options - Additional embed options
   */
  static info(message: string, options?: Partial<EmbedOptions>): EmbedBuilder {
    return this.create({
      description: `ℹ️ ${message}`,
      color: Colors.Info,
      timestamp: true,
      ...options,
    });
  }

  /**
   * Create a moderation embed (fuchsia)
   * @param title - The embed title
   * @param options - Additional embed options
   */
  static moderation(title: string, options?: Partial<EmbedOptions>): EmbedBuilder {
    return this.create({
      title: `🛡️ ${title}`,
      color: Colors.Moderation,
      timestamp: true,
      ...options,
    });
  }

  /**
   * Create a custom embed with Safeguard branding
   * @param options - Embed options
   */
  static custom(options: EmbedOptions): EmbedBuilder {
    return this.create({
      color: Colors.Primary,
      timestamp: true,
      ...options,
    });
  }

  /**
   * Create an embed from raw API data
   * @param data - Raw embed data
   */
  static fromData(data: APIEmbed): EmbedBuilder {
    return EmbedBuilder.from(data);
  }

  /**
   * Create a loading embed
   * @param message - Loading message (default: "Loading...")
   */
  static loading(message = "Loading..."): EmbedBuilder {
    return this.create({
      description: `⏳ ${message}`,
      color: Colors.Info,
    });
  }

  /**
   * Create a permission denied embed
   * @param message - Optional custom message
   */
  static permissionDenied(message = "You don't have permission to do this."): EmbedBuilder {
    return this.error(message, {
      title: "Permission Denied",
    });
  }

  /**
   * Create a cooldown embed
   * @param seconds - Remaining cooldown in seconds
   */
  static cooldown(seconds: number): EmbedBuilder {
    return this.warning(`Please wait **${seconds}** seconds before using this again.`, {
      title: "Cooldown",
    });
  }
}
