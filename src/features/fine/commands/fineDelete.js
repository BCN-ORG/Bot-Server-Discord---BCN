import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getFineById, deleteFine, getFineConfig } from '../../../database/fines.js';

export const data = new SlashCommandBuilder()
  .setName('fine-delete')
  .setDescription('Xóa biên bản phạt theo ID (Admin only)')
  .addStringOption(option =>
    option
      .setName('fine-id')
      .setDescription('ID biên bản phạt (VD: FINE-20250118-001)')
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction, client) {
  const fineId = interaction.options.getString('fine-id').toUpperCase();

  try {
    // Check if fine exists
    const fine = await getFineById(fineId);
    
    if (!fine) {
      return await interaction.reply({
        content: `❌ Không tìm thấy biên bản phạt với ID: **${fineId}**`,
        ephemeral: true
      });
    }

    // Check if fine belongs to this guild
    if (fine.guildId !== interaction.guildId) {
      return await interaction.reply({
        content: '❌ Biên bản phạt này không thuộc server này',
        ephemeral: true
      });
    }

    // Delete the fine
    const deleted = await deleteFine(fineId);

    if (!deleted) {
      return await interaction.reply({
        content: '❌ Không thể xóa biên bản phạt. Vui lòng thử lại',
        ephemeral: true
      });
    }

    // Create delete embed
    const statusIcon = fine.isPaid ? '✅' : '⏳';
    const statusText = fine.isPaid ? 'Đã thanh toán' : 'Chưa thanh toán';
    
    const deleteEmbed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('🗑️ Biên bản phạt đã bị xóa')
      .addFields(
        { name: '📋 ID', value: fine.fineId, inline: true },
        { name: '👤 Người bị phạt', value: `<@${fine.userId}>`, inline: true },
        { name: '💰 Số tiền', value: `${fine.amount.toLocaleString('vi-VN')} VNĐ`, inline: true },
        { name: '📝 Lý do', value: fine.reason, inline: false },
        { name: `${statusIcon} Trạng thái`, value: statusText, inline: true },
        { name: '📅 Ngày lập', value: fine.createdAt.toLocaleString('vi-VN', { 
          timeZone: 'Asia/Ho_Chi_Minh',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }), inline: true }
      );

    if (fine.isPaid && fine.paidBy) {
      deleteEmbed.addFields(
        { name: '💳 Thanh toán bởi', value: `<@${fine.paidBy}>`, inline: true }
      );
    }

    deleteEmbed.addFields(
      { name: '👮 Xóa bởi', value: `<@${interaction.user.id}>`, inline: true }
    );

    deleteEmbed.setTimestamp();

    // Reply to admin
    await interaction.reply({
      embeds: [deleteEmbed],
      ephemeral: true
    });

    // Notify user via DM
    try {
      const user = await client.users.fetch(fine.userId);
      
      const dmEmbed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('🗑️ Biên bản phạt của bạn đã bị xóa')
        .addFields(
          { name: '📋 ID', value: fine.fineId, inline: true },
          { name: '💰 Số tiền', value: `${fine.amount.toLocaleString('vi-VN')} VNĐ`, inline: true },
          { name: '📝 Lý do', value: fine.reason, inline: false },
          { name: `${statusIcon} Trạng thái`, value: statusText, inline: true },
          { name: '📅 Ngày lập', value: fine.createdAt.toLocaleString('vi-VN', { 
            timeZone: 'Asia/Ho_Chi_Minh',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }), inline: true },
          { name: '👮 Xóa bởi', value: `<@${interaction.user.id}>`, inline: true }
        )
        .setTimestamp();

      await user.send({ embeds: [dmEmbed] });
    } catch (dmError) {
      console.error('[Fine Delete] Could not send DM to user:', dmError);
    }

    // Notify announcement channels
    try {
      const config = await getFineConfig(fine.guildId);
      
      if (config.announcementChannels && config.announcementChannels.length > 0) {
        const publicEmbed = new EmbedBuilder()
          .setColor('#ff6b6b')
          .setTitle('🗑️ Biên bản phạt đã bị xóa')
          .addFields(
            { name: '📋 ID', value: fine.fineId, inline: true },
            { name: '👤 Người bị phạt', value: `<@${fine.userId}>`, inline: true },
            { name: '💰 Số tiền', value: `${fine.amount.toLocaleString('vi-VN')} VNĐ`, inline: true },
            { name: '📝 Lý do', value: fine.reason, inline: false },
            { name: `${statusIcon} Trạng thái`, value: statusText, inline: true },
            { name: '📅 Ngày lập', value: fine.createdAt.toLocaleString('vi-VN', { 
              timeZone: 'Asia/Ho_Chi_Minh',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            }), inline: true },
            { name: '👮 Xóa bởi', value: `<@${interaction.user.id}>`, inline: true }
          )
          .setTimestamp();

        for (const channelId of config.announcementChannels) {
          try {
            const channel = await client.channels.fetch(channelId);
            if (channel?.isTextBased()) {
              await channel.send({ embeds: [publicEmbed] });
            }
          } catch (channelError) {
            console.error(`[Fine Delete] Could not send to channel ${channelId}:`, channelError);
          }
        }
      }
    } catch (configError) {
      console.error('[Fine Delete] Error fetching config or sending announcements:', configError);
    }

  } catch (error) {
    console.error('[Fine Delete] Error:', error);
    return await interaction.reply({
      content: '❌ Đã có lỗi xảy ra khi xóa biên bản phạt',
      ephemeral: true
    });
  }
}
