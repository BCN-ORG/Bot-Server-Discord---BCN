import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getFinesByUser } from '../../../database/fines.js';

export const data = new SlashCommandBuilder()
  .setName('fine-check')
  .setDescription('Xem biên bản phạt cá nhân (chưa thanh toán)');

export async function execute(interaction) {
  try {
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    
    // Get unpaid fines only
    const unpaidFines = await getFinesByUser(guildId, userId, false);

    if (unpaidFines.length === 0) {
      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Không Có Biên Bản Nào')
        .setDescription('Bạn không có biên bản phạt chưa thanh toán!')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const totalAmount = unpaidFines.reduce((sum, fine) => sum + fine.amount, 0);

    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('📋 Biên Bản Phạt Của Bạn')
      .setDescription(
        `Bạn có **${unpaidFines.length}** biên bản phạt chưa thanh toán\n` +
        `💰 **Tổng số tiền:** ${totalAmount} coins\n` +
        `━━━━━━━━━━━━━━━━━━━━\n`
      )
      .setTimestamp();

    // Add up to 10 fines
    const displayFines = unpaidFines.slice(0, 10);
    displayFines.forEach((fine, index) => {
      embed.addFields({
        name: `${index + 1}. ${fine.fineId}`,
        value: 
          `• **Lý do:** ${fine.reason}\n` +
          `• **Số tiền:** ${fine.amount} coins\n` +
          `• **Ngày lập:** ${fine.createdAt.toLocaleString('vi-VN')}`,
        inline: false
      });
    });

    if (unpaidFines.length > 10) {
      embed.setFooter({ text: `... và ${unpaidFines.length - 10} biên bản khác. Dùng /fine-confirm-payment để thanh toán` });
    } else {
      embed.setFooter({ text: 'Dùng /fine-confirm-payment để thanh toán' });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });

  } catch (error) {
    console.error('[Fine Check] Error:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('❌ Lỗi')
      .setDescription('Đã xảy ra lỗi! Vui lòng thử lại sau.')
      .setTimestamp();

    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}
