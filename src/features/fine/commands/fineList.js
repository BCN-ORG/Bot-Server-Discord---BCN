import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getAllFines } from '../../../database/fines.js';

export const data = new SlashCommandBuilder()
  .setName('fine-list')
  .setDescription('Xem tất cả biên bản phạt (Admin)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('Lọc theo thành viên')
      .setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName('status')
      .setDescription('Lọc theo trạng thái')
      .setRequired(false)
      .addChoices(
        { name: 'Tất cả', value: 'all' },
        { name: 'Đã thanh toán', value: 'paid' },
        { name: 'Chưa thanh toán', value: 'unpaid' }
      )
  )
  .addIntegerOption(option =>
    option
      .setName('page')
      .setDescription('Trang (mỗi trang 10 biên bản)')
      .setRequired(false)
      .setMinValue(1)
  );

export async function execute(interaction) {
  try {
    const user = interaction.options.getUser('user');
    const status = interaction.options.getString('status') || 'all';
    const page = interaction.options.getInteger('page') || 1;

    const filters = {};
    if (user) {
      filters.userId = user.id;
    }
    if (status !== 'all') {
      filters.status = status;
    }

    const result = await getAllFines(filters, page, 10);

    if (result.fines.length === 0) {
      const embed = new EmbedBuilder()
        .setColor('#ff9900')
        .setTitle('📋 Danh Sách Biên Bản')
        .setDescription('Không tìm thấy biên bản nào!')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('📋 Danh Sách Biên Bản Phạt')
      .setDescription(
        `Hiển thị trang ${result.pagination.page}/${result.pagination.totalPages}\n` +
        `Tổng: ${result.pagination.total} biên bản\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n`
      )
      .setTimestamp();

    result.fines.forEach((fine, index) => {
      const status = fine.isPaid ? '✅ Đã thanh toán' : '❌ Chưa thanh toán';
      const paidInfo = fine.isPaid 
        ? `\n• **Người thanh toán:** <@${fine.paidBy}>\n• **Ngày thanh toán:** ${fine.paidAt.toLocaleString('vi-VN')}`
        : '';

      embed.addFields({
        name: `${(page - 1) * 10 + index + 1}. ${fine.fineId} - ${status}`,
        value: 
          `• **Người vi phạm:** <@${fine.userId}>\n` +
          `• **Lý do:** ${fine.reason}\n` +
          `• **Số tiền:** ${fine.amount} coins\n` +
          `• **Ngày lập:** ${fine.createdAt.toLocaleString('vi-VN')}` +
          paidInfo,
        inline: false
      });
    });

    embed.setFooter({ 
      text: `Trang ${result.pagination.page}/${result.pagination.totalPages} • Tổng ${result.pagination.total} biên bản` 
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });

  } catch (error) {
    console.error('[Fine List] Error:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('❌ Lỗi')
      .setDescription('Đã xảy ra lỗi! Vui lòng thử lại sau.')
      .setTimestamp();

    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}
