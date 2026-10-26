import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getAllDebts } from '../../../database/payroll.js';
import { format } from 'date-fns';

/**
 * Dinh nghia lenh /salary-debts
 */
export const data = new SlashCommandBuilder()
  .setName('salary-debts')
  .setDescription('Xem danh sách nợ lương')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

/**
 * Xu ly lenh /salary-debts
 * @param {CommandInteraction} interaction 
 */
export async function execute(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    // Lay tat ca no
    const allDebts = await getAllDebts();

    if (allDebts.length === 0) {
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📋 Danh sách nợ lương')
        .setDescription('Không có bản ghi nợ nào.')
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Phan loai no
    const unpaidDebts = allDebts.filter(d => d.status === 'unpaid');
    const paidDebts = allDebts.filter(d => d.status === 'paid');

    const embed = new EmbedBuilder()
      .setColor('#ff9900')
      .setTitle('📋 Danh sách nợ lương')
      .setTimestamp();

    // Hien thi no chua tra
    if (unpaidDebts.length > 0) {
      const unpaidList = unpaidDebts.slice(0, 10).map(debt => {
        const dateStr = format(new Date(debt.payrollDate), 'dd/MM/yyyy HH:mm');
        return `**${debt.debtId}** - ${dateStr}\n└ Thiếu: ${debt.deficit} coins | ${debt.memberCount} người`;
      }).join('\n');

      const moreUnpaid = unpaidDebts.length > 10 ? `\n... và ${unpaidDebts.length - 10} bản ghi khác` : '';
      embed.addFields({
        name: `🔴 Chưa trả (${unpaidDebts.length})`,
        value: unpaidList + moreUnpaid,
        inline: false
      });
    }

    // Hien thi no da tra
    if (paidDebts.length > 0) {
      const paidList = paidDebts.slice(0, 5).map(debt => {
        const dateStr = format(new Date(debt.payrollDate), 'dd/MM/yyyy HH:mm');
        return `**${debt.debtId}** - ${dateStr}\n└ Đã trả: ${debt.totalCoinsNeeded} coins | ${debt.memberCount} người`;
      }).join('\n');

      const morePaid = paidDebts.length > 5 ? `\n... và ${paidDebts.length - 5} bản ghi khác` : '';
      embed.addFields({
        name: `🟢 Đã trả (${paidDebts.length})`,
        value: paidList + morePaid,
        inline: false
      });
    }

    embed.setFooter({ text: `Tổng: ${allDebts.length} bản ghi` });

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('[ERROR] Salary debts command error:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('Lỗi')
      .setDescription(`Đã xảy ra lỗi khi lấy danh sách nợ:\n\`\`\`${error.message}\`\`\``)
      .setTimestamp();

    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
}
