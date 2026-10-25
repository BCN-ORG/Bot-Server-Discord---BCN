import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getUserViolationsSummary } from '../services/violationService.js';

export const data = new SlashCommandBuilder()
  .setName('violation-check')
  .setDescription('Kiểm tra biên bản phạt của bạn');

export async function execute(interaction) {
  try {
    const userId = interaction.user.id;

    // Get user's unpaid violations
    const summary = await getUserViolationsSummary(userId);

    const embed = new EmbedBuilder()
      .setColor(summary.count > 0 ? '#ff0000' : '#00ff00')
      .setTitle('📋 Biên bản phạt của bạn')
      .setTimestamp();

    if (summary.count === 0) {
      embed.setDescription('✅ Bạn không có biên bản phạt nào chưa thanh toán.');
    } else {
      let description = `Bạn có **${summary.count}** biên bản phạt chưa thanh toán.\n\n`;
      description += `💰 **Tổng số tiền:** ${summary.totalAmount} coins\n\n`;
      description += '━━━━━━━━━━━━━━━━━━━━\n\n';

      summary.violations.forEach((v, index) => {
        description += `**${index + 1}. ${v.violationId}**\n`;
        description += `• **Lý do:** ${v.reason}\n`;
        description += `• **Số tiền:** ${v.amount} coins\n`;
        description += `• **Ngày tạo:** ${v.createdAt.toLocaleDateString('vi-VN')}\n\n`;
      });

      description += '━━━━━━━━━━━━━━━━━━━━\n\n';
      description += '💡 Sử dụng lệnh `/violation-confirm-payment` để thanh toán.';

      embed.setDescription(description);
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });

  } catch (error) {
    console.error('[Violation Command] Error in check:', error);

    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('❌ Lỗi')
      .setDescription('Có lỗi xảy ra khi kiểm tra biên bản phạt. Vui lòng thử lại sau.')
      .setTimestamp();

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [embed], ephemeral: true });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}
