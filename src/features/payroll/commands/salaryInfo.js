/**
 * /salary-info command
 * Xem tat ca thong tin ve he thong tra luong
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getSalaryConfig, getSalaryNotificationConfig } from '../../../database/payroll.js';
import { generatePayrollPreview } from '../services/payrollNotificationService.js';

/**
 * Dinh nghia lenh /salary-info
 */
export const data = new SlashCommandBuilder()
  .setName('salary-info')
  .setDescription('Xem thông tin tổng quan hệ thống trả lương');

/**
 * Map day of week number sang ten tieng Viet
 */
const DAY_NAMES_VI = {
  0: 'Chủ nhật',
  1: 'Thứ Hai',
  2: 'Thứ Ba',
  3: 'Thứ Tư',
  4: 'Thứ Năm',
  5: 'Thứ Sáu',
  6: 'Thứ Bảy'
};

/**
 * Xu ly lenh /salary-info
 * @param {CommandInteraction} interaction 
 * @param {Client} client 
 */
export async function execute(interaction, client) {
  try {
    await interaction.deferReply({ ephemeral: true });

    // Lay cau hinh lich tra luong
    const payrollConfig = await getSalaryConfig();
    
    // Lay cau hinh lich thong bao
    let notificationConfig;
    try {
      notificationConfig = await getSalaryNotificationConfig();
    } catch (error) {
      notificationConfig = null; // Chua cau hinh
    }

    // Lay preview (tong coins can tra)
    let preview;
    try {
      preview = await generatePayrollPreview(client);
    } catch (error) {
      console.error('[ERROR] Failed to generate preview:', error);
      preview = null;
    }

    // Tao embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('ℹ️ THÔNG TIN HỆ THỐNG TRẢ LƯƠNG')
      .setDescription('Tổng quan về lịch trình và dự toán trả lương');

    // 1. Lich tra luong
    const payrollTime = `${String(payrollConfig.hour).padStart(2, '0')}:${String(payrollConfig.minute).padStart(2, '0')}`;
    embed.addFields({
      name: '📅 Lịch trả lương',
      value: `**${DAY_NAMES_VI[payrollConfig.dayOfWeek]}** hàng tuần lúc **${payrollTime}**\nMúi giờ: ${payrollConfig.timezone}`,
      inline: false
    });

    // 2. Lich thong bao
    if (notificationConfig && notificationConfig.dayOfWeek !== undefined) {
      const notifTime = `${String(notificationConfig.hour).padStart(2, '0')}:${String(notificationConfig.minute).padStart(2, '0')}`;
      const notifRoles = notificationConfig.notificationRoles && notificationConfig.notificationRoles.length > 0
        ? notificationConfig.notificationRoles.map(id => `<@&${id}>`).join(', ')
        : '_Chưa cấu hình roles_';
      
      embed.addFields({
        name: '🔔 Lịch thông báo',
        value: `**${DAY_NAMES_VI[notificationConfig.dayOfWeek]}** hàng tuần lúc **${notifTime}**\nThông báo tới: ${notifRoles}`,
        inline: false
      });
    } else {
      embed.addFields({
        name: '🔔 Lịch thông báo',
        value: '_Chưa được cấu hình_\nDùng `/salary-notification-schedule` để cài đặt',
        inline: false
      });
    }

    // 3. Du toan tra luong
    if (preview) {
      const statusEmoji = preview.deficit > 0 ? '⚠️' : '✅';
      const statusText = preview.deficit > 0 
        ? `**THIẾU ${preview.deficit} coins**` 
        : 'Đủ để trả lương';

      embed.addFields({
        name: '💰 Dự toán kỳ tiếp theo',
        value: `👥 Số người: **${preview.memberCount}**\n` +
               `💵 Tổng cần trả: **${preview.totalCoinsNeeded}** coins\n` +
               `🧾 Trong đó lương cố định: **${preview.fixedSalaryCoins}** coins\n` +
               `🏦 Số dư hiện tại: **${preview.currentBalance}** coins\n` +
               `${statusEmoji} Trạng thái: ${statusText}`,
        inline: false
      });
    } else {
      embed.addFields({
        name: '💰 Dự toán kỳ tiếp theo',
        value: '_Không thể tính toán (kiểm tra cấu hình)_',
        inline: false
      });
    }

    // 4. Lenh quan ly
    embed.addFields({
      name: '🛠️ Lệnh quản lý',
      value: '• `/salary-preview` - Xem chi tiết coins cần trả (Admin)\n' +
             '• `/salary-simple-role` - Cấu hình lương cố định theo role (Admin)\n' +
             '• `/salary-check` - Xem lương cá nhân\n' +
             '• `/salary-schedule` - Đặt/xem lịch trả lương (Admin)\n' +
             '• `/salary-debts` - Xem danh sách nợ (Admin)',
      inline: false
    });

    embed.setTimestamp();
    embed.setFooter({ text: 'Discord Bot - Payroll System' });

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('[ERROR] Salary info command error:', error);
    
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
