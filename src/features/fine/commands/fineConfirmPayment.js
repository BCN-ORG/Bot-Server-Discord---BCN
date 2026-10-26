import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { processFinePayment } from '../services/fineService.js';

export const data = new SlashCommandBuilder()
  .setName('fine-confirm-payment')
  .setDescription('Xác nhận thanh toán biên bản phạt')
  .addStringOption(option =>
    option
      .setName('fineid')
      .setDescription('Mã biên bản (VD: FINE-20261019-001)')
      .setRequired(true)
  );

export async function execute(interaction, client) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const fineId = interaction.options.getString('fineid');
    const payerId = interaction.user.id;

    // Process payment
    const result = await processFinePayment(fineId, payerId, client);

    if (result.success) {
      const fine = result.fine;
      
      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Thanh Toán Thành Công')
        .setDescription(
          `Đã thanh toán biên bản phạt!\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `📋 **Mã biên bản:** ${fine.fineId}\n` +
          `💰 **Số tiền:** ${fine.amount} coins\n` +
          `📝 **Lý do:** ${fine.reason}\n` +
          `👤 **Người thanh toán:** ${interaction.user}\n` +
          `📄 **Mã giao dịch:** ${result.reference}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          (result.duplicate ? '⚠️ *Biên bản này đã được thanh toán trước đó*' : '✅ *Giao dịch đã hoàn tất*')
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } else {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ Thanh Toán Thất Bại')
        .setDescription(
          `Không thể thanh toán biên bản phạt!\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `**Lỗi:** ${result.error}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `💡 Vui lòng kiểm tra:\n` +
          `• Mã biên bản có đúng không?\n` +
          `• Bạn có đủ coin không?\n` +
          `• Biên bản đã được thanh toán chưa?`
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }

  } catch (error) {
    console.error('[Fine Confirm Payment] Error:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('❌ Lỗi')
      .setDescription('Đã xảy ra lỗi! Vui lòng thử lại sau.')
      .setTimestamp();

    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
}
