import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import {
  listTemporaryRoleSchedules,
  revokeTemporaryRoleSchedule,
  setTemporaryRoleSchedule
} from './controller.js';

export const data = new SlashCommandBuilder()
  .setName('role')
  .setDescription('Cấp và quản lý role tạm thời theo nhóm')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addSubcommand(subcommand =>
    subcommand
      .setName('set')
      .setDescription('Cấp role tạm thời cho thành viên có role nhóm')
      .addRoleOption(option =>
        option
          .setName('group_role')
          .setDescription('Role dùng để chọn thành viên')
          .setRequired(true)
      )
      .addRoleOption(option =>
        option
          .setName('target_role')
          .setDescription('Role tạm thời cần cấp')
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('duration')
          .setDescription('Thời hạn theo ngày (mặc định 1 ngày)')
          .setMinValue(1)
          .setMaxValue(36500)
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('Xem các phiên role đang hoạt động')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('revoke')
      .setDescription('Thu hồi role theo mã phiên')
      .addStringOption(option =>
        option
          .setName('session_id')
          .setDescription('Mã phiên lấy từ /role list')
          .setRequired(true)
          .setMaxLength(24)
      )
  );

export async function execute(interaction) {
  try {
    if (!interaction.guild) {
      throw new Error('Lệnh này chỉ dùng được trong server.');
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
      throw new Error('Bạn cần quyền Manage Roles để quản lý role tạm thời.');
    }

    await interaction.deferReply({ ephemeral: true });
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'set') {
      const groupRole = interaction.options.getRole('group_role', true);
      const targetRole = interaction.options.getRole('target_role', true);
      const durationDays = interaction.options.getInteger('duration') ?? 1;
      const result = await setTemporaryRoleSchedule({
        guild: interaction.guild,
        groupRole,
        targetRole,
        durationDays
      });

      await interaction.editReply(
        `Đã ${result.created ? 'tạo' : 'cập nhật'} phiên \`${result.schedule._id}\`.\n` +
        `Nhóm: ${groupRole} → role tạm thời: ${targetRole}\n` +
        `Hết hạn: <t:${Math.floor(result.schedule.expireAt.getTime() / 1000)}:F>\n` +
        `Cấp thành công lần này: **${result.assigned}** | ` +
        `Bỏ qua: **${result.skipped}** | Lỗi: **${result.failed}** | ` +
        `Đang được quản lý trong phiên: **${result.totalMembers}**`
      );
      return;
    }

    if (subcommand === 'revoke') {
      const sessionId = interaction.options.getString('session_id', true).trim();
      const result = await revokeTemporaryRoleSchedule(interaction.guild, sessionId);
      await interaction.editReply(
        result.completed
          ? `Đã kết thúc phiên \`${sessionId}\`; đã xử lý **${result.revoked}** thành viên.`
          : `Đã thử thu hồi role trong phiên \`${sessionId}\` cho **${result.revoked}** thành viên. ` +
            'Một số thao tác còn lỗi; phiên vẫn mở và sẽ được thử lại tự động.'
      );
      return;
    }

    const schedules = await listTemporaryRoleSchedules(interaction.guild.id);
    if (!schedules.length) {
      await interaction.editReply('Server hiện không có phiên role tạm thời đang hoạt động.');
      return;
    }

    const lines = [];
    for (const [index, schedule] of schedules.slice(0, 15).entries()) {
      const groupRole = interaction.guild.roles.cache.get(schedule.groupRoleId);
      const targetRole = interaction.guild.roles.cache.get(schedule.targetRoleId);
      lines.push(
        `**${index + 1}.** \`${schedule._id}\` — ` +
        `${groupRole || `role ${schedule.groupRoleId}`} → ` +
        `${targetRole || `role ${schedule.targetRoleId}`}\n` +
        `Thời hạn: ${schedule.durationDays} ngày | ` +
        `Hết hạn: <t:${Math.floor(schedule.expireAt.getTime() / 1000)}:F> | ` +
        `Thành viên: ${schedule.totalMembers}`
      );
    }
    const suffix = schedules.length > 15
      ? `\nCòn ${schedules.length - 15} phiên khác chưa hiển thị.`
      : '';
    await interaction.editReply(`${lines.join('\n')}${suffix}`.slice(0, 1950));
  } catch (error) {
    console.error('[ERROR] Temporary role command failed:', error);
    const content = `Không thể xử lý lệnh role tạm thời: ${error.message}`;
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(content);
    } else {
      await interaction.reply({ content, ephemeral: true });
    }
  }
}
