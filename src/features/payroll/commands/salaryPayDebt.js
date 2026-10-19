import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getDebtById, updateDebtStatus } from '../../../database/payroll.js';
import { getBalance, transferPayment } from '../services/apiClient.js';

/**
 * Dinh nghia lenh /salary-pay-debt
 */
export const data = new SlashCommandBuilder()
  .setName('salary-pay-debt')
  .setDescription('Trả nợ lương theo ID')
  .addStringOption(option =>
    option.setName('debt-id')
      .setDescription('ID của bản nợ')
      .setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

/**
 * Xu ly lenh /salary-pay-debt
 * @param {CommandInteraction} interaction 
 */
export async function execute(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const debtId = interaction.options.getString('debt-id');

    // 1. Load debt by debtId
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

    if (debt.status === 'paid') {
      const embed = new EmbedBuilder()
        .setColor('#ff9900')
        .setTitle('⚠️ Đã trả rồi')
        .setDescription(`Bản ghi nợ **${debtId}** đã được trả lương trước đó.`)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // 2. Check current balance
    const balanceData = await getBalance();
    const currentBalance = balanceData.balance ?? balanceData.data?.balance ?? 0;

    if (currentBalance < debt.totalCoinsNeeded) {
      const shortfall = debt.totalCoinsNeeded - currentBalance;
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ Không đủ số dư')
        .setDescription(`Vẫn chưa đủ số dư để trả nợ lương này.`)
        .addFields(
          { name: 'Số dư hiện tại', value: `${currentBalance} coins`, inline: true },
          { name: 'Cần thiết', value: `${debt.totalCoinsNeeded} coins`, inline: true },
          { name: 'Còn thiếu', value: `${shortfall} coins`, inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // 3. Process payments
    let successCount = 0;
    let failedCount = 0;
    let totalTransferred = 0;
    const failedMembers = [];

    for (const member of debt.unpaidMembers) {
      try {
        // Small delay between transfers
        if (successCount > 0 || failedCount > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        const transferResult = await transferPayment(
          member.userId,
          member.paidWithRole.roleId,
          member.amount,
          `Trả nợ lương ${debtId}`
        );

        if (transferResult.httpStatus === 200 && transferResult.data?.status === 'SUCCESS') {
          successCount++;
          totalTransferred += member.amount;
          console.log(`[Payroll Debt] Paid ${member.username} (${member.userId}): ${member.amount} coins`);
        } else {
          failedCount++;
          failedMembers.push({
            username: member.username,
            userId: member.userId,
            reason: transferResult.data?.error || 'Unknown error'
          });
          console.error(`[ERROR] Failed to pay ${member.username} (${member.userId}):`, transferResult.data);
        }
      } catch (error) {
        failedCount++;
        failedMembers.push({
          username: member.username,
          userId: member.userId,
          reason: error.message
        });
        console.error(`[ERROR] Failed to pay ${member.username} (${member.userId}):`, error);
      }
    }

    // 4. Update debt status (mark as paid if all successful)
    if (failedCount === 0) {
      await updateDebtStatus(debtId, 'paid', new Date());
    }

    // 5. Reply with results
    const embed = new EmbedBuilder()
      .setTitle(failedCount === 0 ? '✅ Trả nợ thành công' : '⚠️ Trả nợ một phần')
      .setColor(failedCount === 0 ? '#00b300' : '#ff9900')
      .addFields(
        { name: 'ID Nợ', value: `${debtId}`, inline: true },
        { name: 'Thành công', value: `${successCount}`, inline: true },
        { name: 'Thất bại', value: `${failedCount}`, inline: true },
        { name: 'Tổng coins đã trả', value: `${totalTransferred}`, inline: false }
      )
      .setTimestamp();

    if (failedCount > 0) {
      const failedList = failedMembers.slice(0, 5).map(m => 
        `• ${m.username} (${m.userId}): ${m.reason}`
      ).join('\n');
      const moreFailed = failedMembers.length > 5 ? `\n... và ${failedMembers.length - 5} người khác` : '';
      
      embed.addFields({
        name: 'Người thất bại',
        value: failedList + moreFailed,
        inline: false
      });
      embed.setDescription('Một số thanh viên không được trả lương thành công. Vui lòng kiểm tra log và thử lại.');
    } else {
      embed.setDescription(`Đã trả nợ lương thành công cho ${successCount} thành viên!`);
    }

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('[ERROR] Salary pay debt command error:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('Lỗi')
      .setDescription(`Đã xảy ra lỗi khi trả nợ:\n\`\`\`${error.message}\`\`\``)
      .setTimestamp();

    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
}
