/**
 * Context Menu Command for Reaction Role
 * Chuột phải vào message → Apps → Setup Reaction Role
 */

import {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  PermissionFlagsBits
} from 'discord.js';

export const data = new ContextMenuCommandBuilder()
  .setName('Setup Reaction Role')
  .setType(ApplicationCommandType.Message)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

export async function execute(interaction) {
  try {
    // Kiểm tra quyền
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({
        content: '❌ Bạn cần quyền Manage Roles để sử dụng lệnh này.',
        ephemeral: true
      });
      return;
    }

    const targetMessage = interaction.targetMessage;
    const messageId = targetMessage.id;

    // Tạo modal
    const modal = new ModalBuilder()
      .setCustomId(`reaction_role_modal:${messageId}`)
      .setTitle('Cấu hình Reaction Role');

    // Role ID input
    const roleInput = new TextInputBuilder()
      .setCustomId('role_id')
      .setLabel('Role ID (chuột phải role → Copy Role ID)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('123456789012345678')
      .setRequired(true);

    // Emoji input
    const emojiInput = new TextInputBuilder()
      .setCustomId('emoji')
      .setLabel('Emoji (ví dụ: ❤️ hoặc <:name:123456>)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('❤️')
      .setRequired(true);

    // Limit input
    const limitInput = new TextInputBuilder()
      .setCustomId('limit')
      .setLabel('Số người tối đa')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('10')
      .setRequired(true);

    // Duration/Every input
    const durationInput = new TextInputBuilder()
      .setCustomId('duration_or_every')
      .setLabel('Thời hạn (30 ngày hoặc 08:00)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('30 hoặc 08:00 hoặc để trống')
      .setRequired(false);

    // Price input
    const priceInput = new TextInputBuilder()
      .setCustomId('price')
      .setLabel('Giá (coins, để trống = miễn phí)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('0')
      .setRequired(false);

    // Add inputs to modal
    modal.addComponents(
      new ActionRowBuilder().addComponents(roleInput),
      new ActionRowBuilder().addComponents(emojiInput),
      new ActionRowBuilder().addComponents(limitInput),
      new ActionRowBuilder().addComponents(durationInput),
      new ActionRowBuilder().addComponents(priceInput)
    );

    await interaction.showModal(modal);

  } catch (error) {
    console.error('[ERROR] Reaction role context menu error:', error);

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: `❌ **Lỗi:** ${error.message}`,
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: `❌ **Lỗi:** ${error.message}`,
        ephemeral: true
      });
    }
  }
}
