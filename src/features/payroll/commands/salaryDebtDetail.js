import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getDebtById } from '../../../database/payroll.js';
import { format } from 'date-fns';

/**
 * Dinh nghia lenh /salary-debt-detail
 */
export const data = new SlashCommandBuilder()
  .setName('salary-debt-detail')
  .setDescription('Xem chi tiết một bản ghi nợ lương')
  .addStringOption(option =>
    option.setName('debt-id')
      .setDescription('ID của bản nợ (14 chữ số, vd: 191020260831)')
      .setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

/**
 * Xu ly lenh /salary-debt-detail
 * @param {CommandInteraction} interaction 
 */
export async function execute(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const debtId = interaction.options.getString('debt-id');

    // Lay thong tin no
    const debt = await getDebtById(debtId);

    if (!debt) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ Không tìm thấy')
        .setDescription(`Không tìm thấy bản ghi nợ với ID: **${debtId}**`)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Tao embed chi tiet
    const dateStr = format(new Date(debt.payrollDate), 'dd/MM/yyyy HH:mm');
    const statusEmoji = debt.status === 'paid' ? '🟢' : '🔴';
    const statusText = debt.status === 'paid' ? 'Đã trả' : 'Chưa trả';

    const embed = new EmbedBuilder()
      .setColor(debt.status === 'paid' ? '#00b300' : '#ff9900')
      .setTitle(`${statusEmoji} Chi tiết nợ lương`)
      .addFields(
        { name: 'ID Nợ', value: `${debt.debtId}`, inline: true },
        { name: 'Ngày trả lương', value: dateStr, inline: true },
        { name: 'Trạng thái', value: statusText, inline: true },
        { name: 'Tổng coins cần trả', value: `${debt.totalCoinsNeeded}`, inline: true },
        { name: 'Số dư ví lúc đó', value: `${debt.walletBalance}`, inline: true },
        { name: 'Số dư thiếu', value: `${debt.deficit}`, inline: true },
        { name: 'Số người chưa được trả', value: `${debt.memberCount}`, inline: true }
      )
      .setTimestamp();

    // Hien thi danh sach thanh vien (toi da 10 nguoi)
    if (debt.unpaidMembers && debt.unpaidMembers.length > 0) {
      const memberList = debt.unpaidMembers.slice(0, 10).map(member => {
        return `• **${member.username}** (${member.userId}): ${member.amount} coins`;
      }).join('\n');

      const moreMembers = debt.unpaidMembers.length > 10 
        ? `\n... và ${debt.unpaidMembers.length - 10} người khác` 
        : '';

      embed.addFields({
        name: 'Danh sách người chưa được trả',
        value: memberList + moreMembers,
        inline: false
      });
    }

    // Neu da tra, hien thi ngay tra
    if (debt.status === 'paid' && debt.paidAt) {
      const paidAtStr = format(new Date(debt.paidAt), 'dd/MM/yyyy HH:mm');
      embed.addFields({
        name: 'Ngày đã trả nợ',
        value: paidAtStr,
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('[ERROR] Salary debt detail command error:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('Lỗi')
      .setDescription(`Đã xảy ra lỗi khi lấy chi tiết nợ:\n\`\`\`${error.message}\`\`\``)
      .setTimestamp();

    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
}
