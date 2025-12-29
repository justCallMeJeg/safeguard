import { existsSync, readFileSync, watch, type FSWatcher } from "fs";
import { join } from "path";
import { ZodError } from "zod";
import { Logger } from "../structures/Logger";
import { defaultConfig, envMapping, configFiles } from "./defaults";
import {
  SafeguardConfigSchema,
  normalizeConfig,
  type SafeguardConfig,
  type PartialSafeguardConfig,
} from "./schema";

/**
 * Configuration manager for Safeguard bot.
 * Handles loading, validation, and hot-reloading of configuration.
 */
export class ConfigManager {
  private static instance: ConfigManager | null = null;

  /** The validated configuration */
  private config: SafeguardConfig | null = null;

  /** File watcher for hot-reload */
  private watcher: FSWatcher | null = null;

  /** Base directory for config files */
  private readonly baseDir: string;

  /** Whether hot-reload is enabled */
  private readonly hotReloadEnabled: boolean;

  /** Callbacks to notify on config changes */
  private changeListeners: Array<(config: SafeguardConfig) => void> = [];

  private constructor(baseDir: string, hotReload = true) {
    this.baseDir = baseDir;
    this.hotReloadEnabled = hotReload && process.env.NODE_ENV !== "production";
  }

  /**
   * Get or create the singleton ConfigManager instance
   */
  static getInstance(baseDir?: string): ConfigManager {
    if (!this.instance) {
      // Default to the bot's root directory (apps/bot)
      const dir = baseDir ?? join(import.meta.dir, "..", "..");
      this.instance = new ConfigManager(dir);
    }
    return this.instance;
  }

  /**
   * Initialize the configuration system
   * Must be called before accessing config
   */
  async initialize(): Promise<SafeguardConfig> {
    Logger.info("Config", "Initializing configuration system...");

    try {
      // Load and validate config
      this.config = this.loadConfig();

      // Setup hot-reload if enabled
      if (this.hotReloadEnabled) {
        this.setupHotReload();
      }

      Logger.success("Config", "Configuration loaded successfully");
      return this.config;
    } catch (error) {
      if (error instanceof ZodError) {
        this.logValidationErrors(error);
      }
      throw error;
    }
  }

  /**
   * Get the current configuration
   * @throws Error if not initialized
   */
  get(): SafeguardConfig {
    if (!this.config) {
      throw new Error("ConfigManager not initialized. Call initialize() first.");
    }
    return this.config;
  }

  /**
   * Get a specific config value by path
   * @param path - Dot-notation path like "settings.colors.primary"
   */
  getValue<T>(path: string): T | undefined {
    const config = this.get();
    const parts = path.split(".");
    let current: unknown = config;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current as T;
  }

  /**
   * Register a callback for config changes
   */
  onChange(callback: (config: SafeguardConfig) => void): () => void {
    this.changeListeners.push(callback);
    return () => {
      this.changeListeners = this.changeListeners.filter((cb) => cb !== callback);
    };
  }

  /**
   * Force reload the configuration
   */
  reload(): SafeguardConfig {
    Logger.info("Config", "Reloading configuration...");

    try {
      const oldConfig = this.config;
      this.config = this.loadConfig();

      // Notify listeners if config changed
      if (JSON.stringify(oldConfig) !== JSON.stringify(this.config)) {
        Logger.success("Config", "Configuration reloaded with changes");
        this.notifyListeners();
      } else {
        Logger.info("Config", "Configuration unchanged");
      }

      return this.config;
    } catch (error) {
      if (error instanceof ZodError) {
        this.logValidationErrors(error);
      }
      Logger.error("Config", "Failed to reload configuration, keeping previous config");
      throw error;
    }
  }

  /**
   * Load and merge configuration from all sources
   */
  private loadConfig(): SafeguardConfig {
    // Start with defaults
    let merged: PartialSafeguardConfig = this.deepClone(defaultConfig);

    // Load and merge config files
    for (const filename of configFiles) {
      const filePath = join(this.baseDir, filename);
      const fileConfig = this.loadJsonFile(filePath);
      if (fileConfig) {
        merged = this.deepMerge(merged, fileConfig);
        Logger.debug("Config", `Loaded config from ${filename}`);
      }
    }

    // Override with environment variables
    merged = this.applyEnvOverrides(merged);

    // Validate with Zod, then normalize to ensure all nested objects exist
    const parsed = SafeguardConfigSchema.parse(merged);
    return normalizeConfig(parsed);
  }

  /**
   * Load a JSON config file
   */
  private loadJsonFile(filePath: string): PartialSafeguardConfig | null {
    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const content = readFileSync(filePath, "utf-8");
      return JSON.parse(content) as PartialSafeguardConfig;
    } catch (error) {
      Logger.warn(
        "Config",
        `Failed to parse ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  /**
   * Apply environment variable overrides
   */
  private applyEnvOverrides(config: PartialSafeguardConfig): PartialSafeguardConfig {
    const result = this.deepClone(config);

    for (const [envVar, path] of Object.entries(envMapping)) {
      const value = process.env[envVar];
      if (value !== undefined && value !== "") {
        this.setNestedValue(result, path, this.parseEnvValue(value));
        Logger.debug("Config", `Applied env override: ${envVar}`);
      }
    }

    return result;
  }

  /**
   * Parse environment variable value to appropriate type
   */
  private parseEnvValue(value: string): unknown {
    // Boolean
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;

    // Number - but NOT for large numbers (Discord snowflakes should stay as strings)
    // Discord IDs are typically 17-20 digits, so we skip number conversion for anything > 15 digits
    // JavaScript loses precision for integers > Number.MAX_SAFE_INTEGER (9007199254740991)
    const num = Number(value);
    if (!isNaN(num) && value.trim() !== "" && value.length <= 15) return num;

    // Array (comma-separated)
    if (value.includes(",")) {
      return value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    // String
    return value;
  }

  /**
   * Set a nested value in an object using dot notation
   */
  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split(".");
    let current: Record<string, unknown> = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!;
      if (!(part in current) || typeof current[part] !== "object") {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    const lastPart = parts[parts.length - 1];
    if (lastPart !== undefined) {
      current[lastPart] = value;
    }
  }

  /**
   * Setup file watcher for hot-reload
   */
  private setupHotReload(): void {
    const watchPaths = configFiles.map((f) => join(this.baseDir, f));

    for (const watchPath of watchPaths) {
      if (!existsSync(watchPath)) continue;

      try {
        const watcher = watch(watchPath, { persistent: false }, (eventType) => {
          if (eventType === "change") {
            Logger.info("Config", `Config file changed: ${watchPath}`);
            // Debounce reloads
            setTimeout(() => {
              try {
                this.reload();
              } catch {
                // Error already logged in reload()
              }
            }, 100);
          }
        });

        // Store watcher reference (we only track one for cleanup)
        if (!this.watcher) {
          this.watcher = watcher;
        }

        Logger.debug("Config", `Watching for changes: ${watchPath}`);
      } catch (error) {
        Logger.warn(
          "Config",
          `Failed to watch ${watchPath}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    if (this.watcher) {
      Logger.info("Config", "Hot-reload enabled for config files");
    }
  }

  /**
   * Notify all change listeners
   */
  private notifyListeners(): void {
    if (!this.config) return;

    for (const listener of this.changeListeners) {
      try {
        listener(this.config);
      } catch (error) {
        Logger.error(
          "Config",
          `Change listener error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * Log Zod validation errors in a user-friendly format
   */
  private logValidationErrors(error: ZodError): void {
    Logger.error("Config", "Configuration validation failed:");
    for (const issue of error.issues) {
      const path = issue.path.join(".");
      Logger.error("Config", `  - ${path}: ${issue.message}`);
    }
  }

  /**
   * Deep clone an object
   */
  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj)) as T;
  }

  /**
   * Deep merge two objects
   */
  private deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
    const result = { ...target };

    for (const key of Object.keys(source) as Array<keyof T>) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (
        sourceValue !== null &&
        sourceValue !== undefined &&
        typeof sourceValue === "object" &&
        !Array.isArray(sourceValue) &&
        targetValue !== null &&
        targetValue !== undefined &&
        typeof targetValue === "object" &&
        !Array.isArray(targetValue)
      ) {
        result[key] = this.deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        ) as T[keyof T];
      } else if (sourceValue !== undefined) {
        result[key] = sourceValue as T[keyof T];
      }
    }

    return result;
  }

  /**
   * Cleanup resources (call on shutdown)
   */
  destroy(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.changeListeners = [];
    ConfigManager.instance = null;
  }
}
