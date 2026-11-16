import { EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import {
  addScheduleAuthorizedRole,
  getScheduleAuthorizedRoles,
  removeScheduleAuthorizedRole
} from '../../../database/schedule.js';

export const data = new SlashCommandBuilder()
  .setName('lich-hoc-roles')
  .setDescription('Quản lý các role được phép dùng chức năng xem lịch')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Thêm role được phép xem lịch')
      .addRoleOption(option =>
        option.setName('role').setDescription('Role cần thêm').setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Xóa role khỏi danh sách được phép')
      .addRoleOption(option =>
        option.setName('role').setDescription('Role cần xóa').setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand.setName('list').setDescription('Xem danh sách role được phép')
  );

export async function execute(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: 'Chỉ quản trị viên mới được quản lý role.', flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'add') {
    const role = interaction.options.getRole('role');
    await addScheduleAuthorizedRole(interaction.guildId, role.id);
    await interaction.editReply(`Đã thêm ${role} vào danh sách role được phép dùng chức năng xem lịch.`);
    return;
  }

  if (subcommand === 'remove') {
    const role = interaction.options.getRole('role');
    const removed = await removeScheduleAuthorizedRole(interaction.guildId, role.id);
    await interaction.editReply(removed ? `Đã xóa ${role} khỏi danh sách.` : `${role} chưa có trong danh sách.`);
    return;
  }

  const roles = await getScheduleAuthorizedRoles(interaction.guildId);
  const embed = new EmbedBuilder()
    .setColor('#2463a6')
    .setTitle('Role được phép xem lịch')
    .setDescription(roles.length ? roles.map(roleId => `<@&${roleId}>`).join('\n') : 'Chưa có role nào được cấu hình.');
  await interaction.editReply({ embeds: [embed] });
}
