/**
 * /salary-check command
 * Member xem luong ca nhan minh se nhan
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getAllCoefficients } from '../../../database/payroll.js';

/**
 * Dinh nghia lenh /salary-check
 */
export const data = new SlashCommandBuilder()
  .setName('salary-check')
  .setDescription('Xem lương bạn sẽ nhận cho kỳ này');

/**
 * Tinh luong cua user
 * @param {GuildMember} member 
 * @param {Array} coefficients 
 */
function calculateMemberSalary(member, coefficients) {
  // Tao map he so
  const coefficientMap = new Map();
  for (const coef of coefficients) {
    coefficientMap.set(coef.roleId, coef.coefficient);
  }

  // Lay TAT CA roles user co (tru @everyone va bot roles)
  const userRoles = [];
  let totalCoefficient = 0;

  for (const [roleId, role] of member.roles.cache) {
    // Bo qua @everyone role
    if (role.id === member.guild.id) continue;
    // Bo qua managed roles (bot roles)
    if (role.managed) continue;

    const coefficient = coefficientMap.get(roleId) ?? 1; // Mac dinh = 1
    totalCoefficient += coefficient;
    userRoles.push({
      roleId: role.id,
      roleName: role.name,
      coefficient
    });
  }

  // Cap at 100
  const finalAmount = Math.min(totalCoefficient, 100);

  return {
    eligibleRoles: userRoles,
    totalCoefficient,
    finalAmount,
    isCapped: totalCoefficient > 100
  };
}

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

    // Lay bang he so
    const coefficients = await getAllCoefficients();

    // Tinh luong cua user (tat ca roles)
    const salary = calculateMemberSalary(member, coefficients);

    // Tao embed
    const embed = new EmbedBuilder()
      .setTitle('💰 LƯƠNG CỦA BẠN')
      .setDescription(`Dự kiến lương cho kỳ tiếp theo`)
      .setThumbnail(member.user.displayAvatarURL());

    if (salary.eligibleRoles.length === 0) {
      // User khong co role nao (chi co @everyone)
      embed.setColor('#ff9900');
      embed.addFields({
        name: '⚠️ Không có role',
        value: 'Bạn chưa có role nào trong server.\nLiên hệ admin để được cấp role.',
        inline: false
      });
    } else {
      // User co role duoc tra luong
      embed.setColor('#00b300');

      // Liet ke cac role va he so
      const rolesList = salary.eligibleRoles
        .map(r => `• <@&${r.roleId}>: **${r.coefficient}** coin`)
        .join('\n');

      embed.addFields(
        {
          name: '🎭 Các role của bạn được trả lương',
          value: rolesList,
          inline: false
        },
        {
          name: '📊 Tổng hệ số',
          value: `**${salary.totalCoefficient}** coins`,
          inline: true
        },
        {
          name: '💵 Tổng lương nhận được',
          value: `**${salary.finalAmount}** coins`,
          inline: true
        }
      );

      if (salary.isCapped) {
        embed.addFields({
          name: '⚠️ Lưu ý',
          value: `Tổng hệ số vượt quá 100, đã được giới hạn xuống **100 coins** (giới hạn API)`,
          inline: false
        });
      }

      embed.addFields({
        name: '📅 Thời gian',
        value: 'Lương sẽ được trả theo lịch trình đã cấu hình.\nDùng `/salary-schedule` để xem chi tiết.',
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
