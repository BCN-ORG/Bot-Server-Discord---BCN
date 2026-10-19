/**
 * /salary-notification-roles command
 * Quan ly danh sach roles duoc thong bao ve luong
 */

import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getSalaryNotificationConfig, updateSalaryNotificationConfig } from '../../../database/payroll.js';

/**
 * Dinh nghia lenh /salary-notification-roles
 */
export const data = new SlashCommandBuilder()
  .setName('salary-notification-roles')
  .setDescription('Quan ly danh sach role nhan thong bao luong')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Them role vao danh sach nhan thong bao')
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('Role can them')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Xoa role khoi danh sach nhan thong bao')
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('Role can xoa')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('Xem danh sach role nhan thong bao')
  );

/**
 * Xu ly lenh /salary-notification-roles
 * @param {CommandInteraction} interaction 
 */
export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  try {
    if (subcommand === 'add') {
      await handleAdd(interaction);
    } else if (subcommand === 'remove') {
      await handleRemove(interaction);
    } else if (subcommand === 'list') {
      await handleList(interaction);
    }
  } catch (error) {
    console.error('[ERROR] Salary notification roles command error:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('Loi')
      .setDescription('Da xay ra loi khi xu ly lenh');

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
}

/**
 * Xu ly subcommand add
 */
async function handleAdd(interaction) {
  const role = interaction.options.getRole('role');
  
  // Lay config hien tai
  const config = await getSalaryNotificationConfig();
  const notificationRoles = config.notificationRoles || [];
  
  // Kiem tra xem role da ton tai chua
  if (notificationRoles.includes(role.id)) {
    const embed = new EmbedBuilder()
      .setColor('#ff9900')
      .setTitle('Role da ton tai')
      .setDescription(`Role ${role} da co trong danh sach nhan thong bao`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }
  
  // Them role vao danh sach
  notificationRoles.push(role.id);
  
  // Cap nhat database
  await updateSalaryNotificationConfig(
    config.dayOfWeek,
    config.hour,
    config.minute,
    notificationRoles,
    interaction.user.id
  );

  const embed = new EmbedBuilder()
    .setColor('#00b300')
    .setTitle('Da them role')
    .setDescription(`Role ${role} da duoc them vao danh sach nhan thong bao luong`)
    .addFields(
      { name: 'Luu y', value: 'Thanh vien co role nay se duoc tag khi co thong bao tra luong' }
    )
    .setFooter({ text: `Them boi ${interaction.user.tag}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * Xu ly subcommand remove
 */
async function handleRemove(interaction) {
  const role = interaction.options.getRole('role');
  
  // Lay config hien tai
  const config = await getSalaryNotificationConfig();
  const notificationRoles = config.notificationRoles || [];
  
  // Kiem tra xem role co trong danh sach khong
  const index = notificationRoles.indexOf(role.id);
  if (index === -1) {
    const embed = new EmbedBuilder()
      .setColor('#ff9900')
      .setTitle('Khong tim thay')
      .setDescription(`Role ${role} khong co trong danh sach nhan thong bao`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }
  
  // Xoa role khoi danh sach
  notificationRoles.splice(index, 1);
  
  // Cap nhat database
  await updateSalaryNotificationConfig(
    config.dayOfWeek,
    config.hour,
    config.minute,
    notificationRoles,
    interaction.user.id
  );

  const embed = new EmbedBuilder()
    .setColor('#00b300')
    .setTitle('Da xoa role')
    .setDescription(`Role ${role} da duoc xoa khoi danh sach nhan thong bao luong`)
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * Xu ly subcommand list
 */
async function handleList(interaction) {
  const config = await getSalaryNotificationConfig();
  const notificationRoles = config.notificationRoles || [];

  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle('Danh sach role nhan thong bao luong')
    .setDescription(
      notificationRoles.length === 0 
        ? 'Chua co role nao trong danh sach' 
        : `Co ${notificationRoles.length} role duoc nhan thong bao`
    );

  if (notificationRoles.length > 0) {
    // Lay guild de hien thi ten role
    const guild = interaction.guild;
    
    const roleList = notificationRoles.map((roleId, index) => {
      const role = guild.roles.cache.get(roleId);
      if (role) {
        return `${index + 1}. ${role} (${role.name})`;
      } else {
        return `${index + 1}. <@&${roleId}> (ID: ${roleId}, role khong ton tai)`;
      }
    }).join('\n');

    embed.addFields({ name: 'Cac role', value: roleList });
  }

  embed.addFields({ 
    name: 'Luu y', 
    value: 'Thanh vien co cac role nay se duoc tag khi bot gui bao cao tra luong' 
  });
  embed.setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
