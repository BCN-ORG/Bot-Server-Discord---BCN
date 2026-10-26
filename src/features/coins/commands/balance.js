import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getBalance } from '../../payroll/services/apiClient.js';

export const data = new SlashCommandBuilder()
  .setName('coins-balance')
  .setDescription('Kiểm tra số dư quỹ coin của Nhà Bạc (Viện Kiểm Soát)');

export async function execute(interaction) {
  await interaction.deferReply(); // Public reply

  try {
    // Get balance from Payroll API
    const balanceData = await getBalance();

    const embed = new EmbedBuilder()
      .setColor('#ffd700')
      .setTitle('🏦 Số Dư Nhà Bạc')
      .setDescription('Thông tin quỹ coin của **Viện Kiểm Soát**')
      .addFields(
        { 
          name: '💰 Số dư hiện tại', 
          value: `**${balanceData.balance.toLocaleString('vi-VN')}** coins`, 
          inline: true 
        },
        { 
          name: '📊 Giới hạn giao dịch', 
          value: `${balanceData.maxAmount.toLocaleString('vi-VN')} coins/lần`, 
          inline: true 
        },
        { 
          name: '🏦 Wallet ID', 
          value: `\`${balanceData.walletId}\``, 
          inline: false 
        }
      )
      .setFooter({ text: 'Nguồn: Payroll API' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('[Coins Balance] Error:', error);

    const errorEmbed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('❌ Lỗi')
      .setDescription(
        'Không thể lấy thông tin số dư từ Payroll API!\n\n' +
        `**Chi tiết:** ${error.message}`
      )
      .setFooter({ text: 'Vui lòng kiểm tra kết nối với bot Nhà Bạc' })
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
