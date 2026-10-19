/**
 * /salary-notification-schedule command
 * Dat lich thong bao truoc khi tra luong
 */

import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { updateSalaryNotificationConfig } from '../../../database/payroll.js';
import { updateNotificationSchedule } from '../notificationScheduler.js';

/**
 * Dinh nghia lenh /salary-notification-schedule
 */
export const data = new SlashCommandBuilder()
  .setName('salary-notification-schedule')
  .setDescription('Dat lich bao cao truoc khi tra luong')
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
  )
  .addStringOption(option =>
    option
      .setName('roles')
      .setDescription('Role IDs nhan thong bao, ngan cach bang dau phay (VD: 123456789,987654321)')
      .setRequired(false)
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
 * Xu ly lenh /salary-notification-schedule
 * @param {CommandInteraction} interaction 
 * @param {Client} client 
 */
export async function execute(interaction, client) {
  try {
    const dayChoice = interaction.options.getString('day');
    const hour = interaction.options.getInteger('hour');
    const minute = interaction.options.getInteger('minute');
    const rolesString = interaction.options.getString('roles');

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

    // Parse roles string
    let notificationRoles = [];
    if (rolesString) {
      notificationRoles = rolesString
        .split(',')
        .map(id => id.trim())
        .filter(id => /^\d+$/.test(id)); // Chi giu lai role IDs hop le
    }

    // Cap nhat database
    await updateSalaryNotificationConfig(dayOfWeek, hour, minute, notificationRoles, interaction.user.id);

    // Cap nhat scheduler
    await updateNotificationSchedule(dayOfWeek, hour, minute, client);

    // Tao embed xac nhan
    const dayName = DAY_NAMES_VI[dayOfWeek];
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

    const embed = new EmbedBuilder()
      .setColor('#00b300')
      .setTitle('Da cap nhat lich thong bao')
      .addFields(
        { name: 'Ngay', value: dayName, inline: true },
        { name: 'Gio', value: timeStr, inline: true },
        { name: 'Mui gio', value: 'Asia/Ho_Chi_Minh', inline: true }
      )
      .setDescription(`He thong se gui bao cao tra luong vao **${dayName}** hang tuan luc **${timeStr}**`);

    if (notificationRoles.length > 0) {
      const roleList = notificationRoles.map(roleId => `<@&${roleId}>`).join(', ');
      embed.addFields({ 
        name: 'Roles duoc thong bao', 
        value: roleList, 
        inline: false 
      });
    } else {
      embed.addFields({ 
        name: 'Roles duoc thong bao', 
        value: 'Chua cau hinh (dung /salary-notification-roles de them)', 
        inline: false 
      });
    }

    embed.setFooter({ text: `Cap nhat boi ${interaction.user.tag}` });
    embed.setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });

  } catch (error) {
    console.error('[ERROR] Salary notification schedule command error:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('Loi')
      .setDescription('Da xay ra loi khi cap nhat lich thong bao');

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
}
