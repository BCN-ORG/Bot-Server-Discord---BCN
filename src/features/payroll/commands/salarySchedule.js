import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { updateSalaryConfig, getSalaryConfig } from '../../../database/payroll.js';
import { updateSchedule } from '../scheduler.js';

/**
 * Dinh nghia lenh /salary-schedule
 */
export const data = new SlashCommandBuilder()
  .setName('salary-schedule')
  .setDescription('Dat lich tra luong hang tuan')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(option =>
    option
      .setName('day')
      .setDescription('Ngay trong tuan')
      .setRequired(true)
      .addChoices(
        { name: 'Chu nhat', value: 'sunday' },
        { name: 'Thu hai', value: 'monday' },
        { name: 'Thu ba', value: 'tuesday' },
        { name: 'Thu tu', value: 'wednesday' },
        { name: 'Thu nam', value: 'thursday' },
        { name: 'Thu sau', value: 'friday' },
        { name: 'Thu bay', value: 'saturday' }
      )
  )
  .addIntegerOption(option =>
    option
      .setName('hour')
      .setDescription('Gio (0-23)')
      .setRequired(true)
      .setMinValue(0)
      .setMaxValue(23)
  )
  .addIntegerOption(option =>
    option
      .setName('minute')
      .setDescription('Phut (0-59)')
      .setRequired(true)
      .setMinValue(0)
      .setMaxValue(59)
  );

/**
 * Map ten ngay sang day of week number
 */
const DAY_MAP = {
  'sunday': 0,
  'monday': 1,
  'tuesday': 2,
  'wednesday': 3,
  'thursday': 4,
  'friday': 5,
  'saturday': 6
};

/**
 * Map day of week number sang ten tieng Viet
 */
const DAY_NAMES_VI = {
  0: 'Chu nhat',
  1: 'Thu hai',
  2: 'Thu ba',
  3: 'Thu tu',
  4: 'Thu nam',
  5: 'Thu sau',
  6: 'Thu bay'
};

/**
 * Xu ly lenh /salary-schedule
 * @param {CommandInteraction} interaction 
 * @param {Client} client 
 */
export async function execute(interaction, client) {
  try {
    const dayChoice = interaction.options.getString('day');
    const hour = interaction.options.getInteger('hour');
    const minute = interaction.options.getInteger('minute');

    // Neu khong co param nao → XEM lich hien tai
    if (!dayChoice && hour === null && minute === null) {
      const config = await getSalaryConfig();
      
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📅 LỊCH TRẢ LƯƠNG HIỆN TẠI')
        .addFields(
          { name: 'Ngày', value: DAY_NAMES_VI[config.dayOfWeek], inline: true },
          { name: 'Giờ', value: `${String(config.hour).padStart(2, '0')}:${String(config.minute).padStart(2, '0')}`, inline: true },
          { name: 'Múi giờ', value: config.timezone, inline: true }
        )
        .setFooter({ text: 'Dùng /salary-schedule <day> <hour> <minute> để thay đổi' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Neu co param → SET lich moi (phai day du)
    if (!dayChoice || hour === null || minute === null) {
      const errorEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ Lỗi')
        .setDescription('Để đặt lịch mới, cần cung cấp đầy đủ: day, hour, minute');

      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }

    // Chuyen doi day choice sang day of week number
    const dayOfWeek = DAY_MAP[dayChoice];
    
    if (dayOfWeek === undefined) {
      const errorEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Loi')
        .setDescription('Ngay khong hop le');

      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }

    // Cap nhat database
    await updateSalaryConfig(dayOfWeek, hour, minute, interaction.user.id);

    // Cap nhat scheduler
    await updateSchedule(dayOfWeek, hour, minute, client);

    // Tao embed xac nhan
    const dayName = DAY_NAMES_VI[dayOfWeek];
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

    const embed = new EmbedBuilder()
      .setColor('#00b300')
      .setTitle('Da cap nhat lich tra luong')
      .addFields(
        { name: 'Ngay', value: dayName, inline: true },
        { name: 'Gio', value: timeStr, inline: true },
        { name: 'Mui gio', value: 'Asia/Ho_Chi_Minh', inline: true }
      )
      .setDescription(`He thong se tu dong tra luong vao **${dayName}** hang tuan luc **${timeStr}**`)
      .setFooter({ text: `Cap nhat boi ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });

  } catch (error) {
    console.error('[ERROR] Salary schedule command error:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('Loi')
      .setDescription('Da xay ra loi khi cap nhat lich');

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
}
