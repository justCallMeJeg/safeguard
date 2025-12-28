import { readdirSync, statSync, watch } from "fs";
import { join, relative } from "path";
import type { SafeguardClient } from "../structures/SafeguardClient";
import type { ButtonComponent, ModalComponent, SelectMenuComponent } from "../types/components";
import { Logger } from "../structures/Logger";

/** Base paths for component directories */
const COMPONENTS_DIR = join(import.meta.dir, "..", "components");
const BUTTONS_DIR = join(COMPONENTS_DIR, "buttons");
const MODALS_DIR = join(COMPONENTS_DIR, "modals");
const SELECT_MENUS_DIR = join(COMPONENTS_DIR, "selectMenus");

/**
 * Get all TypeScript files in a directory (non-recursive for components)
 */
function getComponentFiles(dir: string): string[] {
  const files: string[] = [];

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isFile() && entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist yet, that's fine
  }

  return files;
}

/**
 * Load button components
 */
async function loadButtons(client: SafeguardClient): Promise<void> {
  const files = getComponentFiles(BUTTONS_DIR);

  for (const file of files) {
    try {
      const module = await import(file);
      const button: ButtonComponent | undefined = module.default ?? module.button;

      if (!button?.customId || !button.execute) {
        Logger.warn("Components", `Invalid button in: ${relative(COMPONENTS_DIR, file)}`);
        continue;
      }

      const key = button.customId instanceof RegExp ? button.customId.source : button.customId;
      client.buttons.set(key, button);

      Logger.debug("Components", `Loaded button: ${key}`);
    } catch (error) {
      Logger.error(
        "Components",
        error instanceof Error ? error : new Error(`Failed to load: ${file}`)
      );
    }
  }
}

/**
 * Load modal components
 */
async function loadModals(client: SafeguardClient): Promise<void> {
  const files = getComponentFiles(MODALS_DIR);

  for (const file of files) {
    try {
      const module = await import(file);
      const modal: ModalComponent | undefined = module.default ?? module.modal;

      if (!modal?.customId || !modal.execute) {
        Logger.warn("Components", `Invalid modal in: ${relative(COMPONENTS_DIR, file)}`);
        continue;
      }

      const key = modal.customId instanceof RegExp ? modal.customId.source : modal.customId;
      client.modals.set(key, modal);

      Logger.debug("Components", `Loaded modal: ${key}`);
    } catch (error) {
      Logger.error(
        "Components",
        error instanceof Error ? error : new Error(`Failed to load: ${file}`)
      );
    }
  }
}

/**
 * Load select menu components
 */
async function loadSelectMenus(client: SafeguardClient): Promise<void> {
  const files = getComponentFiles(SELECT_MENUS_DIR);

  for (const file of files) {
    try {
      const module = await import(file);
      const selectMenu: SelectMenuComponent | undefined = module.default ?? module.selectMenu;

      if (!selectMenu?.customId || !selectMenu.execute) {
        Logger.warn("Components", `Invalid select menu in: ${relative(COMPONENTS_DIR, file)}`);
        continue;
      }

      const key =
        selectMenu.customId instanceof RegExp ? selectMenu.customId.source : selectMenu.customId;
      client.selectMenus.set(key, selectMenu);

      Logger.debug("Components", `Loaded select menu: ${key}`);
    } catch (error) {
      Logger.error(
        "Components",
        error instanceof Error ? error : new Error(`Failed to load: ${file}`)
      );
    }
  }
}

/**
 * Load all components (buttons, modals, select menus)
 */
export async function loadComponents(client: SafeguardClient): Promise<void> {
  await loadButtons(client);
  await loadModals(client);
  await loadSelectMenus(client);

  const total = client.buttons.size + client.modals.size + client.selectMenus.size;

  if (total > 0) {
    Logger.success(
      "Components",
      `Loaded ${client.buttons.size} button(s), ${client.modals.size} modal(s), ${client.selectMenus.size} select menu(s)`
    );
  }
}

/**
 * Find a component by customId (supports prefix matching and regex)
 */
export function findComponent<T extends { customId: string | RegExp; isPrefix?: boolean }>(
  collection: Map<string, T>,
  customId: string
): T | undefined {
  // Direct match first
  const direct = collection.get(customId);
  if (direct) return direct;

  // Check for prefix or regex matches
  for (const [_key, component] of collection) {
    if (component.customId instanceof RegExp) {
      if (component.customId.test(customId)) return component;
    } else if (component.isPrefix && customId.startsWith(component.customId)) {
      return component;
    }
  }

  return undefined;
}

/**
 * Setup hot reloading for components
 */
export async function setupComponentHotReload(client: SafeguardClient): Promise<void> {
  const watchDir = (
    dir: string,
    loadFn: (client: SafeguardClient) => Promise<void>,
    name: string
  ) => {
    try {
      const watcher = watch(dir, async (eventType, filename) => {
        if (!filename || !filename.endsWith(".ts")) return;

        // Debounce
        const debounceKey = `hotreload:component:${dir}:${filename}`;
        if ((globalThis as Record<string, unknown>)[debounceKey]) return;
        (globalThis as Record<string, unknown>)[debounceKey] = true;

        setTimeout(() => {
          delete (globalThis as Record<string, unknown>)[debounceKey];
        }, 100);

        Logger.debug("HotReload", `${name} changed: ${filename}`);

        // Clear collections and reload
        if (name === "Button") client.buttons.clear();
        if (name === "Modal") client.modals.clear();
        if (name === "SelectMenu") client.selectMenus.clear();

        await loadFn(client);
        Logger.success("HotReload", `Reloaded ${name.toLowerCase()}s`);
      });

      process.on("SIGINT", () => watcher.close());
      process.on("SIGTERM", () => watcher.close());
    } catch {
      // Directory doesn't exist, skip watching
    }
  };

  watchDir(BUTTONS_DIR, loadButtons, "Button");
  watchDir(MODALS_DIR, loadModals, "Modal");
  watchDir(SELECT_MENUS_DIR, loadSelectMenus, "SelectMenu");
}
