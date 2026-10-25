import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import {
  getFineConfig,
  addReminderTime,
  removeReminderTime
} from '../../../database/fines.js';

export const data = new SlashCommandBuilder()
  .setName('fine-reminder-times')
  .setDescription('Quản lý giờ nhắc nhở biên bản phạt hàng ngày')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Thêm giờ nhắc nhở')
      .addIntegerOption(option =>
        option
          .setName('hour')
          .setDescription('Giờ (0-23)')
          .setRequired(true)
          .setMinValue(0)
          .setMaxValue(23)
      )
      .addIntegerOption(option =>
        option
          .setName('minute')
          .setDescription('Phút (0-59)')
          .setRequired(true)
          .setMinValue(0)
          .setMaxValue(59)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Xóa giờ nhắc nhở')
      .addIntegerOption(option =>
        option
          .setName('hour')
          .setDescription('Giờ (0-23)')
          .setRequired(true)
          .setMinValue(0)
          .setMaxValue(23)
      )
      .addIntegerOption(option =>
        option
          .setName('minute')
          .setDescription('Phút (0-59)')
          .setRequired(true)
          .setMinValue(0)
          .setMaxValue(59)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('Xem danh sách giờ nhắc nhở')
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  try {
    if (subcommand === 'add') {
      const hour = interaction.options.getInteger('hour');
      const minute = interaction.options.getInteger('minute');
      
      const result = await addReminderTime(guildId, hour, minute);

      if (result.success) {
        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('✅ Thêm Giờ Nhắc Thành Công')
          .setDescription(
            `Đã thêm giờ nhắc: **${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}**\n\n` +
            `Bot sẽ nhắc nhở các thành viên có biên bản phạt chưa thanh toán vào giờ này hàng ngày.`
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
      } else {
        const embed = new EmbedBuilder()
          .setColor('#ff9900')
          .setTitle('⚠️ Thông Báo')
          .setDescription(result.message)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
      }

    } else if (subcommand === 'remove') {
      const hour = interaction.options.getInteger('hour');
      const minute = interaction.options.getInteger('minute');
      
      const success = await removeReminderTime(guildId, hour, minute);

      if (success) {
        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('✅ Xóa Giờ Nhắc Thành Công')
          .setDescription(`Đã xóa giờ nhắc: **${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}**`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
      } else {
        const embed = new EmbedBuilder()
          .setColor('#ff9900')
          .setTitle('⚠️ Thông Báo')
          .setDescription('Giờ nhắc này không tồn tại trong danh sách')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
      }

    } else if (subcommand === 'list') {
      const config = await getFineConfig(guildId);

      if (config.reminderTimes.length === 0) {
        const embed = new EmbedBuilder()
          .setColor('#ff9900')
          .setTitle('📋 Danh Sách Giờ Nhắc')
          .setDescription('Chưa có giờ nhắc nào được cấu hình')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const timeList = config.reminderTimes
        .map(time => `• **${time.hour.toString().padStart(2, '0')}:${time.minute.toString().padStart(2, '0')}**`)
        .join('\n');

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📋 Danh Sách Giờ Nhắc Hàng Ngày')
        .setDescription(
          `${timeList}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `💡 Bot sẽ tự động nhắc nhở các thành viên có biên bản phạt chưa thanh toán vào các giờ trên.`
        )
        .setFooter({ text: `Tổng: ${config.reminderTimes.length} giờ` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

  } catch (error) {
    console.error('[Fine Reminder Times] Error:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('❌ Lỗi')
      .setDescription('Đã xảy ra lỗi! Vui lòng thử lại sau.')
      .setTimestamp();

    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}
