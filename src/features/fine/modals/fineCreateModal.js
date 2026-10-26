import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } from 'discord.js';
import { createAndNotifyFine } from '../services/fineService.js';

/**
 * Create fine modal
 */
export function createFineModal(userId) {
  const modal = new ModalBuilder()
    .setCustomId(`fine_create_modal:${userId}`)
    .setTitle('Lập Biên Bản Phạt');

  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('Lý do')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Nhập lý do lập biên bản phạt...')
    .setRequired(true)
    .setMaxLength(500);

  const amountInput = new TextInputBuilder()
    .setCustomId('amount')
    .setLabel('Số tiền (coins)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('VD: 100')
    .setRequired(true)
    .setMaxLength(10);

  const reasonRow = new ActionRowBuilder().addComponents(reasonInput);
  const amountRow = new ActionRowBuilder().addComponents(amountInput);

  modal.addComponents(reasonRow, amountRow);

  return modal;
}

/**
 * Handle modal submit
 */
export async function handleFineModalSubmit(interaction, client) {
  // Defer immediately to prevent timeout
  await interaction.deferReply({ ephemeral: true });

  try {
    // Extract userId from customId
    const userId = interaction.customId.split(':')[1];
    
    // Get form values
    const reason = interaction.fields.getTextInputValue('reason');
    const amountStr = interaction.fields.getTextInputValue('amount');
    
    // Validate amount
    const amount = parseInt(amountStr, 10);
    if (isNaN(amount) || amount <= 0) {
      const errorEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ Lỗi')
        .setDescription('Số tiền phải là số nguyên dương!')
        .setFooter({ text: 'Vui lòng thử lại' });

      await interaction.editReply({
        embeds: [errorEmbed]
      });
      return;
    }

    // Get violator member
    const violator = await interaction.guild.members.fetch(userId);
    
    if (!violator) {
      const errorEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ Lỗi')
        .setDescription('Không tìm thấy thành viên này!')
        .setFooter({ text: 'Vui lòng thử lại' });

      await interaction.editReply({
        embeds: [errorEmbed]
      });
      return;
    }

    // Create fine and send notifications
    const fine = await createAndNotifyFine(
      client,
      interaction.guild.id,
      userId,
      violator,
      reason,
      amount,
      interaction.user.id
    );

    // Success response
    const successEmbed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('✅ Lập Biên Bản Thành Công')
      .addFields(
        { name: '📋 Mã biên bản', value: fine.fineId, inline: true },
        { name: '👤 Người bị phạt', value: `${violator}`, inline: true },
        { name: '💰 Số tiền', value: `${fine.amount.toLocaleString('vi-VN')} coins`, inline: true },
        { name: '📝 Lý do', value: fine.reason, inline: false }
      )
      .setDescription(
        `✉️ Đã gửi thông báo đến người vi phạm\n` +
        `📢 Đã thông báo công khai trên các kênh`
      )
      .setTimestamp();

    await interaction.editReply({
      embeds: [successEmbed]
    });

  } catch (error) {
    console.error('[Fine Modal] Error handling submit:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('❌ Lỗi')
      .setDescription('Đã xảy ra lỗi khi lập biên bản. Vui lòng thử lại sau!')
      .setFooter({ text: 'Lỗi hệ thống' });

    try {
      if (interaction.deferred) {
        await interaction.editReply({
          embeds: [errorEmbed]
        });
      } else if (!interaction.replied) {
        await interaction.reply({
          embeds: [errorEmbed],
          ephemeral: true
        });
      }
    } catch (replyError) {
      console.error('[Fine Modal] Could not send error reply:', replyError);
    }
  }
}
