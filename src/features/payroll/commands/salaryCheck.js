/**
 * /salary-check command
 * Member xem luong ca nhan minh se nhan
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import {
  getAllCoefficients,
  getAllEligibleRoles,
  getAllSimpleRoleSalaries
} from '../../../database/payroll.js';
import { calculateMemberSalary } from '../services/salaryCalculation.js';

/**
 * Dinh nghia lenh /salary-check
 */
export const data = new SlashCommandBuilder()
  .setName('salary-check')
  .setDescription('Xem lương bạn sẽ nhận cho kỳ này');

/**
 * Xu ly lenh /salary-check
 * @param {CommandInteraction} interaction 
 */
export async function execute(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const member = interaction.member;
    if (!member) {
      const errorEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ Lỗi')
        .setDescription('Không thể lấy thông tin member');

      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    const [coefficients, eligibleRoles, fixedRoleSalaries] = await Promise.all([
      getAllCoefficients(),
      getAllEligibleRoles(),
      getAllSimpleRoleSalaries()
    ]);
    const payableRoleIds = new Set([
      ...eligibleRoles.map(role => role.roleId),
      ...fixedRoleSalaries.map(role => role.roleId)
    ]);
    const hasPayableRole = member.roles.cache.some(role => payableRoleIds.has(role.id));
    const hasCoefficientEligibility = member.roles.cache.some(role =>
      eligibleRoles.some(eligibleRole => eligibleRole.roleId === role.id)
    );
    const coefficientMap = new Map(coefficients.map(item => [item.roleId, item.coefficient]));
    const fixedSalaryMap = new Map(fixedRoleSalaries.map(item => [item.roleId, item.amount]));
    const salary = calculateMemberSalary(
      member,
      coefficientMap,
      fixedSalaryMap,
      hasCoefficientEligibility
    );

    // Tao embed
    const embed = new EmbedBuilder()
      .setTitle('💰 LƯƠNG CỦA BẠN')
      .setDescription(`Dự kiến lương cho kỳ tiếp theo`)
      .setThumbnail(member.user.displayAvatarURL());

    if (!hasPayableRole) {
      embed.setColor('#ff9900');
      embed.addFields({
        name: '⚠️ Chưa đủ điều kiện nhận lương',
        value: 'Bạn chưa có role nào được cấu hình nhận lương.\nLiên hệ admin để được cấp role.',
        inline: false
      });
    } else {
      // User co role duoc tra luong
      embed.setColor('#00b300');

      const coefficientList = salary.coefficientRoles
        .map(r => `• <@&${r.roleId}>: **${r.coefficient}** coin`)
        .join('\n');
      const fixedRolesList = salary.fixedRoles
        .map(role => `• <@&${role.roleId}>: **${role.amount}** coin cố định`)
        .join('\n');

      if (coefficientList) {
        embed.addFields({
          name: '🎭 Lương theo hệ số',
          value: coefficientList,
          inline: false
        });
      }
      if (fixedRolesList) {
        embed.addFields({
          name: '💵 Lương cố định theo role',
          value: fixedRolesList,
          inline: false
        });
      }

      embed.addFields({
        name: '📊 Tổng hệ số',
        value: `**${salary.coefficientTotal}** coins`,
        inline: true
      }, {
        name: '🧾 Phần lương cố định được tính',
        value: `**${salary.fixedSalaryIncluded}** coins`,
        inline: true
      }, {
        name: '💰 Tổng lương nhận được',
        value: `**${salary.amount}** coins`,
        inline: true
      });

      if (salary.isCapped) {
        embed.addFields({
          name: '⚠️ Lưu ý',
          value: 'Tổng lương vượt quá 100 coins nên đã được giới hạn theo giới hạn API.',
          inline: false
        });
      }

      embed.addFields({
        name: '📅 Thời gian',
        value: 'Lương sẽ được trả theo lịch trình đã cấu hình.\nDùng `/salary-info` để xem chi tiết.',
        inline: false
      });
    }

    embed.setTimestamp();
    embed.setFooter({ text: 'Discord Bot - Payroll System' });

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('[ERROR] Salary check command error:', error);
    
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
