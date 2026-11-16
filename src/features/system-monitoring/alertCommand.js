import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';
import {
  addBatteryAlertRole,
  getBatteryAlertRoleIds,
  removeBatteryAlertRole
} from './batteryService.js';

export const data = new SlashCommandBuilder()
  .setName('battery-alert-role')
  .setDescription('Quản lý role nhận báo cáo pin hàng giờ')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Thêm role nhận báo cáo pin')
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('Role cần thêm')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Xóa role khỏi danh sách nhận báo cáo pin')
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('Role cần xóa')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('Xem các role đang nhận báo cáo pin')
  );

export async function execute(interaction) {
  if (!interaction.inGuild()) {
    await interaction.reply({
      content: 'Lệnh này chỉ dùng được trong máy chủ.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: 'Bạn cần quyền Administrator để quản lý role báo pin.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const guildId = interaction.guildId;
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'add') {
      const role = interaction.options.getRole('role');
      const added = await addBatteryAlertRole(guildId, role.id);
      await interaction.editReply(
        added
          ? `Đã thêm ${role} vào danh sách nhận báo cáo pin.`
          : `${role} đã có trong danh sách nhận báo cáo pin.`
      );
      return;
    }

    if (subcommand === 'remove') {
      const role = interaction.options.getRole('role');
      const removed = await removeBatteryAlertRole(guildId, role.id);
      await interaction.editReply(
        removed
          ? `Đã xóa ${role} khỏi danh sách nhận báo cáo pin.`
          : `${role} không có trong danh sách nhận báo cáo pin.`
      );
      return;
    }

    const roleIds = await getBatteryAlertRoleIds(guildId);
    const description = roleIds.length
      ? roleIds.map(roleId => `<@&${roleId}>`).join('\n')
      : 'Chưa có role nào được cấu hình.';
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Role nhận báo cáo pin')
      .setDescription(description)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('[Battery Alert Roles] Không thể cập nhật danh sách role:', error);
    await interaction.editReply('Không thể cập nhật danh sách role báo pin. Vui lòng thử lại.');
  }
}
