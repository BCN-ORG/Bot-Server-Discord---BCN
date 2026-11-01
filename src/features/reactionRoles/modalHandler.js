/**
 * Modal handler for reaction role setup
 */

import { setConfig } from './controller.js';

/**
 * Xu ly modal submit cho reaction role
 * @param {ModalSubmitInteraction} interaction
 */
export async function handleReactionRoleModal(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    // Parse customId: reaction_role_modal:messageId:roleId:emoji
    const parts = interaction.customId.split(':');
    const messageId = parts[1];
    const roleId = parts[2];
    const emoji = decodeURIComponent(parts[3]);

    if (!messageId || !roleId || !emoji) {
      await interaction.editReply({
        content: '❌ Không tìm thấy thông tin. Vui lòng thử lại.'
      });
      return;
    }

    // Lay data tu modal
    const limitStr = interaction.fields.getTextInputValue('limit').trim();
    const durationOrEvery = interaction.fields.getTextInputValue('duration_or_every')?.trim() || '';
    const priceStr = interaction.fields.getTextInputValue('price')?.trim() || '0';

    // Validate limit
    const limit = parseInt(limitStr, 10);
    if (isNaN(limit) || limit < 1) {
      await interaction.editReply({
        content: '❌ Limit phải là số nguyên dương (ví dụ: 10)'
      });
      return;
    }

    // Validate price
    const price = parseInt(priceStr, 10);
    if (isNaN(price) || price < 0) {
      await interaction.editReply({
        content: '❌ Giá phải là số nguyên không âm (ví dụ: 0, 100)'
      });
      return;
    }

    // Parse duration or every
    let durationDays = null;
    let every = null;

    if (durationOrEvery) {
      // Check if it's HH:mm format
      if (/^\d{1,2}:\d{2}$/.test(durationOrEvery)) {
        every = durationOrEvery;
      } else {
        // Assume it's days
        durationDays = parseInt(durationOrEvery, 10);
        if (isNaN(durationDays) || durationDays < 1) {
          await interaction.editReply({
            content: '❌ Thời hạn phải là số ngày (ví dụ: 30) HOẶC giờ (ví dụ: 08:00)'
          });
          return;
        }
      }
    }

    // Get role from guild
    const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
    if (!role) {
      await interaction.editReply({
        content: `❌ Không tìm thấy role với ID \`${roleId}\``
      });
      return;
    }

    // Call setConfig
    const result = await setConfig({
      guild: interaction.guild,
      messageId,
      role,
      limit,
      emoji,
      durationDays,
      every,
      price
    });

    await interaction.editReply({
      content: `✅ ${result}`
    });

  } catch (error) {
    console.error('[ERROR] Reaction role modal handler error:', error);

    const errorMessage = error.message || 'Đã xảy ra lỗi';

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        content: `❌ **Lỗi:** ${errorMessage}`
      });
    } else {
      await interaction.reply({
        content: `❌ **Lỗi:** ${errorMessage}`,
        ephemeral: true
      });
    }
  }
}
