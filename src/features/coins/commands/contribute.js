import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { topupCoin } from '../../payroll/services/apiClient.js';
import { recordContribution, getContributionsPaginated, getContributionStats } from '../../../database/contributions.js';

export const data = new SlashCommandBuilder()
  .setName('coins-contribute')
  .setDescription('Quản lý đóng góp coin vào công quỹ Viện Kiểm Soát')
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Đóng góp coin vào công quỹ')
      .addIntegerOption(option =>
        option
          .setName('amount')
          .setDescription('Số coin muốn đóng góp')
          .setRequired(true)
          .setMinValue(1)
      )
      .addStringOption(option =>
        option
          .setName('message')
          .setDescription('Lời nhắn (tùy chọn)')
          .setRequired(false)
          .setMaxLength(200)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('history')
      .setDescription('Xem lịch sử đóng góp vào công quỹ (Admin)')
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('Lọc theo thành viên')
          .setRequired(false)
      )
      .addIntegerOption(option =>
        option
          .setName('page')
          .setDescription('Trang (mặc định: 1)')
          .setRequired(false)
          .setMinValue(1)
      )
      .addIntegerOption(option =>
        option
          .setName('limit')
          .setDescription('Số lượng mỗi trang (mặc định: 10, tối đa: 25)')
          .setRequired(false)
          .setMinValue(5)
          .setMaxValue(25)
      )
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'add') {
    await handleAdd(interaction);
  } else if (subcommand === 'history') {
    await handleHistory(interaction);
  }
}

async function handleAdd(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const amount = interaction.options.getInteger('amount');
    const message = interaction.options.getString('message') || 'Đóng góp vào công quỹ';
    const userId = interaction.user.id;

    // Generate unique reference
    const timestamp = Date.now();
    const reference = `contribute-${userId}-${timestamp}`;

    // Call Payroll API /topup
    const result = await topupCoin(reference, userId, amount, message);

    if (result.httpStatus === 200 && result.data.status === 'SUCCESS') {
      // Check if duplicate
      if (result.data.duplicate) {
        const embed = new EmbedBuilder()
          .setColor('#ff9900')
          .setTitle('⚠️ Giao Dịch Đã Tồn Tại')
          .setDescription(
            'Giao dịch này đã được xử lý trước đó.\n' +
            'Không có coin mới bị trừ.'
          )
          .addFields(
            { name: '💰 Số tiền', value: `${result.data.amount.toLocaleString('vi-VN')} coins`, inline: true },
            { name: '📄 Mã giao dịch', value: `\`${result.data.reference}\``, inline: false }
          )
          .setTimestamp();

        return await interaction.editReply({ embeds: [embed] });
      }

      // Success - new contribution
      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Đóng Góp Thành Công')
        .setDescription(
          `Cảm ơn ${interaction.user} đã đóng góp vào công quỹ!\n` +
          `💝 Số coin của bạn đã được chuyển vào ví Viện Kiểm Soát.`
        )
        .addFields(
          { name: '💰 Số tiền', value: `${amount.toLocaleString('vi-VN')} coins`, inline: true },
          { name: '💬 Lời nhắn', value: message, inline: false },
          { name: '📄 Mã giao dịch', value: `\`${reference}\``, inline: false }
        )
        .setFooter({ text: 'Cảm ơn sự đóng góp vào công quỹ!' })
        .setTimestamp();

      // Record contribution in database
      try {
        await recordContribution(
          interaction.guild.id,
          userId,
          interaction.user.username,
          amount,
          message,
          reference
        );
      } catch (dbError) {
        console.error('[Contribute] Error recording to database:', dbError);
      }

      await interaction.editReply({ embeds: [embed] });

    } else if (result.httpStatus === 200 && result.data.status === 'FAILED') {
      // Payment failed - not enough coins
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ Đóng Góp Thất Bại')
        .setDescription(
          'Không đủ coin để đóng góp!\n\n' +
          `💰 **Số tiền:** ${amount.toLocaleString('vi-VN')} coins\n` +
          `⚠️ **Lý do:** ${result.data.error || 'Số dư không đủ'}`
        )
        .setFooter({ text: 'Vui lòng kiểm tra số dư và thử lại' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } else if (result.httpStatus === 403 || result.httpStatus === 404) {
      // User not found or is bot
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ Lỗi')
        .setDescription('Không thể xử lý đóng góp. Bạn có thể chưa đăng ký trong hệ thống coin.')
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } else {
      // Other errors
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ Lỗi')
        .setDescription('Đã có lỗi xảy ra khi xử lý đóng góp. Vui lòng thử lại sau!')
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }

  } catch (error) {
    console.error('[Contribute] Error:', error);

    const errorEmbed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('❌ Lỗi')
      .setDescription(
        'Không thể kết nối đến hệ thống coin!\n\n' +
        `**Chi tiết:** ${error.message}`
      )
      .setFooter({ text: 'Vui lòng thử lại sau' })
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleHistory(interaction) {
  // Check admin permission
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('❌ Không Có Quyền')
      .setDescription('Chỉ admin mới có thể xem lịch sử đóng góp!')
      .setTimestamp();

    return await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const user = interaction.options.getUser('user');
    const page = interaction.options.getInteger('page') || 1;
    const limit = interaction.options.getInteger('limit') || 10;
    const userId = user ? user.id : null;
    const guildId = interaction.guild.id;

    // Get contributions from database with pagination
    const result = await getContributionsPaginated(guildId, userId, page, limit);

    if (result.contributions.length === 0) {
      const embed = new EmbedBuilder()
        .setColor('#ff9900')
        .setTitle('📋 Lịch Sử Đóng Góp')
        .setDescription(
          page > 1 
            ? `Không có dữ liệu ở trang ${page}!` 
            : 'Không tìm thấy lịch sử đóng góp nào!'
        )
        .setTimestamp();

      return await interaction.editReply({ embeds: [embed] });
    }

    // Get statistics
    const stats = await getContributionStats(guildId, userId);

    const embed = new EmbedBuilder()
      .setColor('#ffd700')
      .setTitle('📋 Lịch Sử Đóng Góp Vào Công Quỹ')
      .setDescription(
        `**Tổng quan:**\n` +
        `💰 Tổng số tiền: ${stats.totalAmount.toLocaleString('vi-VN')} coins\n` +
        `📊 Tổng số lần: ${stats.totalCount} lần đóng góp\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `**Trang ${result.pagination.page}/${result.pagination.totalPages}:**`
      )
      .setTimestamp();

    // Show contributions for current page
    result.contributions.forEach((contrib, index) => {
      const date = new Date(contrib.createdAt).toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });

      const globalIndex = (page - 1) * limit + index + 1;

      embed.addFields({
        name: `${globalIndex}. 💰 ${contrib.amount.toLocaleString('vi-VN')} coins`,
        value: 
          `• **Người đóng góp:** <@${contrib.userId}> (${contrib.username})\n` +
          `• **Lời nhắn:** ${contrib.message}\n` +
          `• **Mã GD:** \`${contrib.reference}\`\n` +
          `• **Thời gian:** ${date}`,
        inline: false
      });
    });

    embed.setFooter({ 
      text: `Trang ${result.pagination.page}/${result.pagination.totalPages} • Tổng ${result.pagination.total} lần đóng góp` 
    });

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('[Contribute History] Error:', error);

    const errorEmbed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('❌ Lỗi')
      .setDescription(
        'Không thể lấy lịch sử từ database!\n\n' +
        `**Chi tiết:** ${error.message}`
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

