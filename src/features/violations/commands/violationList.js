import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getAllViolations } from '../../../database/violations.js';

export const data = new SlashCommandBuilder()
  .setName('violation-list')
  .setDescription('Xem tất cả biên bản phạt (Admin)')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('Lọc theo user')
      .setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName('status')
      .setDescription('Lọc theo trạng thái')
      .addChoices(
        { name: 'Tất cả', value: 'all' },
        { name: 'Chưa thanh toán', value: 'unpaid' },
        { name: 'Đã thanh toán', value: 'paid' }
      )
      .setRequired(false)
  )
  .addIntegerOption(option =>
    option
      .setName('page')
      .setDescription('Trang (mỗi trang 10 biên bản)')
      .setMinValue(1)
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  try {
    const guildId = interaction.guild.id;
    const userFilter = interaction.options.getUser('user');
    const statusFilter = interaction.options.getString('status') || 'all';
    const page = interaction.options.getInteger('page') || 1;
    const pageSize = 10;

    // Build query filters
    const filters = {};
    if (userFilter) {
      filters.userId = userFilter.id;
    }
    if (statusFilter === 'unpaid') {
      filters.isPaid = false;
    } else if (statusFilter === 'paid') {
      filters.isPaid = true;
    }

    // Get violations
    const allViolations = await getAllViolations(guildId, filters);

    // Calculate pagination
    const totalViolations = allViolations.length;
    const totalPages = Math.ceil(totalViolations / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const violations = allViolations.slice(startIndex, endIndex);

    // Calculate totals
    const totalUnpaid = allViolations.filter(v => !v.isPaid).length;
    const totalUnpaidAmount = allViolations
      .filter(v => !v.isPaid)
      .reduce((sum, v) => sum + v.amount, 0);

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('📋 Danh sách biên bản phạt')
      .setTimestamp();

    if (violations.length === 0) {
      embed.setDescription('Không tìm thấy biên bản phạt nào.');
    } else {
      let description = `**Tổng số biên bản:** ${totalViolations}\n`;
      description += `**Chưa thanh toán:** ${totalUnpaid} (${totalUnpaidAmount} coins)\n\n`;
      
      if (userFilter) {
        description += `**Lọc theo:** ${userFilter}\n`;
      }
      if (statusFilter !== 'all') {
        description += `**Trạng thái:** ${statusFilter === 'unpaid' ? 'Chưa thanh toán' : 'Đã thanh toán'}\n`;
      }
      
      description += '\n━━━━━━━━━━━━━━━━━━━━\n\n';

      violations.forEach((v, index) => {
        const status = v.isPaid ? '✅' : '❌';
        description += `${status} **${v.violationId}**\n`;
        description += `• **User:** <@${v.userId}>\n`;
        description += `• **Lý do:** ${v.reason}\n`;
        description += `• **Số tiền:** ${v.amount} coins\n`;
        description += `• **Ngày tạo:** ${v.createdAt.toLocaleDateString('vi-VN')}\n`;
        if (v.isPaid && v.paidAt) {
          description += `• **Thanh toán bởi:** <@${v.paidBy}> (${v.paidAt.toLocaleDateString('vi-VN')})\n`;
        }
        description += '\n';
      });

      if (totalPages > 1) {
        description += `━━━━━━━━━━━━━━━━━━━━\n`;
        description += `Trang ${page}/${totalPages}`;
      }

      embed.setDescription(description);
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });

  } catch (error) {
    console.error('[Violation Command] Error in list:', error);

    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('❌ Lỗi')
      .setDescription('Có lỗi xảy ra khi lấy danh sách biên bản phạt. Vui lòng thử lại sau.')
      .setTimestamp();

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [embed], ephemeral: true });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}
