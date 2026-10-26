/**
 * /salary-preview command
 * Admin xem preview tong coins can tra cho tuan nay
 */

import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { generatePayrollPreview } from '../services/payrollNotificationService.js';

/**
 * Dinh nghia lenh /salary-preview
 */
export const data = new SlashCommandBuilder()
  .setName('salary-preview')
  .setDescription('Xem bao cao luong can tra cho ky nay')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

/**
 * Xu ly lenh /salary-preview
 * @param {CommandInteraction} interaction 
 * @param {Client} client 
 */
export async function execute(interaction, client) {
  try {
    await interaction.deferReply({ ephemeral: true });

    // Generate preview
    const preview = await generatePayrollPreview(client);

    // Tao embed
    const embed = new EmbedBuilder()
      .setColor(preview.deficit > 0 ? '#ff9900' : '#00b300')
      .setTitle('📊 BÁO CÁO TRẢ LƯƠNG KỲ NÀY')
      .setDescription('Dự toán trả lương cho kỳ hiện tại');

    // Thong tin ngay tra luong tiep theo
    if (preview.nextPayrollDate) {
      const dateStr = preview.nextPayrollDate.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      embed.addFields({ 
        name: '📅 Thời gian trả lương tiếp theo', 
        value: dateStr, 
        inline: false 
      });
    }

    // Thong tin coins
    embed.addFields(
      { 
        name: '👥 Số thành viên', 
        value: preview.memberCount.toString(), 
        inline: true 
      },
      { 
        name: '💰 Tổng coins cần trả', 
        value: `**${preview.totalCoinsNeeded}** coins`, 
        inline: true 
      },
      {
        name: '🧾 Lương cố định trong tổng',
        value: `**${preview.fixedSalaryCoins}** coins`,
        inline: true
      },
      { 
        name: '🏦 Số dư hiện tại', 
        value: `**${preview.currentBalance}** coins`, 
        inline: true 
      }
    );

    // Thong tin thieu hut neu co
    if (preview.deficit > 0) {
      embed.addFields({ 
        name: '⚠️ Số dư thiếu', 
        value: `**${preview.deficit}** coins\n❌ **KHÔNG ĐỦ** để trả lương!\nCần nạp thêm trước khi chạy payroll.`, 
        inline: false 
      });
    } else {
      const surplus = preview.currentBalance - preview.totalCoinsNeeded;
      embed.addFields({ 
        name: '✅ Trạng thái', 
        value: `Đủ để trả lương\nSố dư sau khi trả: **${surplus}** coins`, 
        inline: false 
      });
    }

    // Chi tiet breakdown neu co
    if (preview.breakdown && preview.breakdown.length > 0) {
      const breakdownText = preview.breakdown
        .slice(0, 10)
        .map(item => `• ${item.username}: **${item.amount}** coins${item.fixedSalaryAmount ? ` (cố định: ${item.fixedSalaryAmount})` : ''}`)
        .join('\n');
      
      const moreText = preview.breakdown.length > 10 
        ? `\n... và ${preview.breakdown.length - 10} người khác` 
        : '';

      embed.addFields({
        name: '📋 Chi tiết (10 người đầu)',
        value: breakdownText + moreText,
        inline: false
      });
    }

    embed.setTimestamp();
    embed.setFooter({ text: 'Dùng /salary-payout-now để trả lương ngay' });

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('[ERROR] Salary preview command error:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('❌ Lỗi')
      .setDescription(`Đã xảy ra lỗi:\n\`\`\`${error.message}\`\`\``)
      .setTimestamp();

    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
}
