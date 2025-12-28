import {
  type ChatInputCommandInteraction,
  type MessageContextMenuCommandInteraction,
  type UserContextMenuCommandInteraction,
  type InteractionReplyOptions,
  type InteractionEditReplyOptions,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import { Embeds } from "./Embeds";

type AnyCommandInteraction =
  | ChatInputCommandInteraction
  | UserContextMenuCommandInteraction
  | MessageContextMenuCommandInteraction;

/**
 * Response helper utilities for cleaner command responses
 */
export class Respond {
  /**
   * Send a success response
   */
  static async success(
    interaction: AnyCommandInteraction,
    message: string,
    options?: Partial<InteractionReplyOptions>
  ): Promise<void> {
    const payload: InteractionReplyOptions = {
      embeds: [Embeds.success(message)],
      ...options,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(payload as InteractionEditReplyOptions);
    } else {
      await interaction.reply(payload);
    }
  }

  /**
   * Send an error response (ephemeral by default)
   */
  static async error(
    interaction: AnyCommandInteraction,
    message: string,
    options?: Partial<InteractionReplyOptions>
  ): Promise<void> {
    const payload: InteractionReplyOptions = {
      embeds: [Embeds.error(message)],
      flags: MessageFlags.Ephemeral,
      ...options,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(payload as InteractionEditReplyOptions);
    } else {
      await interaction.reply(payload);
    }
  }

  /**
   * Send a warning response
   */
  static async warning(
    interaction: AnyCommandInteraction,
    message: string,
    options?: Partial<InteractionReplyOptions>
  ): Promise<void> {
    const payload: InteractionReplyOptions = {
      embeds: [Embeds.warning(message)],
      ...options,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(payload as InteractionEditReplyOptions);
    } else {
      await interaction.reply(payload);
    }
  }

  /**
   * Send an info response
   */
  static async info(
    interaction: AnyCommandInteraction,
    message: string,
    options?: Partial<InteractionReplyOptions>
  ): Promise<void> {
    const payload: InteractionReplyOptions = {
      embeds: [Embeds.info(message)],
      ...options,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(payload as InteractionEditReplyOptions);
    } else {
      await interaction.reply(payload);
    }
  }

  /**
   * Send a loading response (for long operations)
   */
  static async loading(
    interaction: AnyCommandInteraction,
    message = "Processing..."
  ): Promise<void> {
    const payload: InteractionReplyOptions = {
      embeds: [Embeds.loading(message)],
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(payload as InteractionEditReplyOptions);
    } else {
      await interaction.reply(payload);
    }
  }

  /**
   * Send a confirmation prompt with buttons
   * Returns true if confirmed, false if cancelled, null if timed out
   */
  static async confirm(
    interaction: AnyCommandInteraction,
    message: string,
    options?: {
      timeout?: number;
      confirmLabel?: string;
      cancelLabel?: string;
      ephemeral?: boolean;
    }
  ): Promise<boolean | null> {
    const {
      timeout = 30000,
      confirmLabel = "Confirm",
      cancelLabel = "Cancel",
      ephemeral = true,
    } = options ?? {};

    const confirmId = `confirm:${interaction.id}`;
    const cancelId = `cancel:${interaction.id}`;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(confirmId)
        .setLabel(confirmLabel)
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(cancelId)
        .setLabel(cancelLabel)
        .setStyle(ButtonStyle.Secondary)
    );

    const replyOptions: InteractionReplyOptions = {
      embeds: [Embeds.warning(message)],
      components: [row],
      flags: ephemeral ? MessageFlags.Ephemeral : undefined,
    };

    const reply = await interaction.reply({
      ...replyOptions,
      withResponse: true,
    });

    try {
      const response = await reply.resource?.message?.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === interaction.user.id,
        time: timeout,
      });

      if (!response) return null;

      // Acknowledge the button click
      await response.deferUpdate();

      // Clear components
      await interaction.editReply({ components: [] });

      return response.customId === confirmId;
    } catch {
      // Timeout - clear components
      await interaction.editReply({
        embeds: [Embeds.warning("Confirmation timed out.")],
        components: [],
      });
      return null;
    }
  }

  /**
   * Send a permission denied response
   */
  static async permissionDenied(
    interaction: AnyCommandInteraction,
    message = "You don't have permission to do this."
  ): Promise<void> {
    await this.error(interaction, message);
  }

  /**
   * Send a cooldown response
   */
  static async cooldown(interaction: AnyCommandInteraction, remainingMs: number): Promise<void> {
    const seconds = Math.ceil(remainingMs / 1000);
    await interaction.reply({
      embeds: [Embeds.cooldown(seconds)],
      flags: MessageFlags.Ephemeral,
    });
  }
}
