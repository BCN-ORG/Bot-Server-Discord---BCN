import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getViolationConfig, addReminderTime, removeReminderTime } from '../../../database/violations.js';

export const data = new SlashCommandBuilder()
  .setName('violation-reminder-times')
  .setDescription('Quản lý giờ nhắc nhở biên bản phạt hàng ngày')
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Thêm giờ nhắc nhở')
      .addIntegerOption(option =>
        option
          .setName('hour')
          .setDescription('Giờ (0-23)')
          .setMinValue(0)
          .setMaxValue(23)
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('minute')
          .setDescription('Phút (0-59)')
          .setMinValue(0)
          .setMaxValue(59)
          .setRequired(true)
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
          .setMinValue(0)
          .setMaxValue(23)
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('minute')
          .setDescription('Phút (0-59)')
          .setMinValue(0)
          .setMaxValue(59)
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('Xem danh sách giờ nhắc nhở')
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  try {
    if (subcommand === 'add') {
      const hour = interaction.options.getInteger('hour');
      const minute = interaction.options.getInteger('minute');
      
      const result = await addReminderTime(guildId, hour, minute);

      if (result.success) {
        const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('✅ Đã thêm giờ nhắc nhở')
          .setDescription(`Giờ nhắc nhở \`${timeStr}\` đã được thêm.\n\nBot sẽ gửi DM nhắc nhở các user có biên bản phạt chưa thanh toán vào giờ này hàng ngày.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
      } else {
        const embed = new EmbedBuilder()
          .setColor('#ff9900')
          .setTitle('⚠️ Cảnh báo')
          .setDescription(result.message)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
      }

    } else if (subcommand === 'remove') {
      const hour = interaction.options.getInteger('hour');
      const minute = interaction.options.getInteger('minute');
      
      await removeReminderTime(guildId, hour, minute);

      const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Đã xóa giờ nhắc nhở')
        .setDescription(`Giờ nhắc nhở \`${timeStr}\` đã được xóa.`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } else if (subcommand === 'list') {
      const config = await getViolationConfig(guildId);

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('⏰ Danh sách giờ nhắc nhở')
        .setTimestamp();

      if (config.reminderTimes.length === 0) {
        embed.setDescription('Chưa có giờ nhắc nhở nào được cài đặt.');
      } else {
        const timeList = config.reminderTimes
          .map(t => `• ${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`)
          .sort()
          .join('\n');
        embed.setDescription(timeList);
        embed.setFooter({ text: `Tổng: ${config.reminderTimes.length} giờ nhắc nhở` });
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

  } catch (error) {
    console.error('[Violation Command] Error in reminder-times:', error);

    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('❌ Lỗi')
      .setDescription('Có lỗi xảy ra khi xử lý lệnh. Vui lòng thử lại sau.')
      .setTimestamp();

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [embed], ephemeral: true });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}
