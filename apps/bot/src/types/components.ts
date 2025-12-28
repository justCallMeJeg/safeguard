import type {
  Awaitable,
  ButtonInteraction,
  ModalSubmitInteraction,
  AnySelectMenuInteraction,
  StringSelectMenuInteraction,
  UserSelectMenuInteraction,
  RoleSelectMenuInteraction,
  ChannelSelectMenuInteraction,
  MentionableSelectMenuInteraction,
} from "discord.js";
import type { SafeguardClient } from "../structures/SafeguardClient";

/**
 * Base component interface
 */
export interface BaseComponent<T> {
  /** Unique identifier or pattern for this component */
  customId: string | RegExp;

  /** If true, the customId is treated as a prefix match */
  isPrefix?: boolean;

  /** Execute the component interaction */
  execute: (client: SafeguardClient, interaction: T) => Awaitable<void>;
}

/**
 * Button component handler
 */
export type ButtonComponent = BaseComponent<ButtonInteraction>;

/**
 * Modal submit handler
 */
export type ModalComponent = BaseComponent<ModalSubmitInteraction>;

/**
 * Select menu component handler (any type)
 */
export type SelectMenuComponent = BaseComponent<AnySelectMenuInteraction>;

/**
 * String select menu handler
 */
export type StringSelectComponent = BaseComponent<StringSelectMenuInteraction>;

/**
 * User select menu handler
 */
export type UserSelectComponent = BaseComponent<UserSelectMenuInteraction>;

/**
 * Role select menu handler
 */
export type RoleSelectComponent = BaseComponent<RoleSelectMenuInteraction>;

/**
 * Channel select menu handler
 */
export type ChannelSelectComponent = BaseComponent<ChannelSelectMenuInteraction>;

/**
 * Mentionable select menu handler
 */
export type MentionableSelectComponent = BaseComponent<MentionableSelectMenuInteraction>;

/**
 * Union type for all components
 */
export type SafeguardComponent =
  | ButtonComponent
  | ModalComponent
  | SelectMenuComponent
  | StringSelectComponent
  | UserSelectComponent
  | RoleSelectComponent
  | ChannelSelectComponent
  | MentionableSelectComponent;

/**
 * Component type for collection keys
 */
export type ComponentType = "button" | "modal" | "selectMenu";

/**
 * Collection types for components
 */
export type ButtonsCollection = Map<string, ButtonComponent>;
export type ModalsCollection = Map<string, ModalComponent>;
export type SelectMenusCollection = Map<string, SelectMenuComponent>;
