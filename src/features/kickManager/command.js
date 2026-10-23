import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import {
  addKickLogChannel,
  addKickAllowedRole,
  isKickAllowedMember,
  listKickLogChannels,
  listKickAllowedRoles,
  removeKickLogChannel,
  removeKickAllowedRole,
  getLatestKickRecord,
  markKickRolledBack,
  getKickHistoryByTarget,
  getKickRecordById
} from '../../database/kickManager.js';

export const data = new SlashCommandBuilder()
  .setName('kick-manager')
  .setDescription('Quản lý quyền dùng lệnh kick và rollback role')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('add-role')
      .setDescription('Cấp quyền dùng lệnh kick và rollback')
      .addRoleOption(option =>
        option.setName('role').setDescription('Role được phép sử dụng lệnh kick').setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove-role')
      .setDescription('Xóa role khỏi danh sách được phép kick và rollback')
      .addRoleOption(option =>
        option.setName('role').setDescription('Role cần xóa quyền').setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('Xem danh sách role được phép sử dụng lệnh kick')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('detail')
      .setDescription('Xem đầy đủ chi tiết một lần kick theo mã kick')
      .addStringOption(option =>
        option
          .setName('kick-id')
          .setDescription('Mã kick được trả về sau khi dùng lệnh /kick')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('add-log-channel')
      .setDescription('Thêm kênh nhận thông báo khi có người bị kick')
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('Kênh chat nhận log kick')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove-log-channel')
      .setDescription('Xóa kênh khỏi danh sách nhận thông báo kick')
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('Kênh cần xóa')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('log-channels')
      .setDescription('Xem các kênh đang nhận thông báo kick')
  );

export async function execute(interaction) {
  try {
    if (!interaction.guild) {
      throw new Error('Lệnh này chỉ dùng được trong server.');
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      throw new Error('Lệnh này chỉ dành cho quản trị viên.');
    }

    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'add-role') {
      const role = interaction.options.getRole('role', true);
      await addKickAllowedRole(interaction.guild.id, role.id, interaction.user.id);
      await interaction.reply({
        content: `Đã cấp quyền kick/rollback cho role <@&${role.id}>.`,
        ephemeral: true
      });
      return;
    }

    if (subcommand === 'remove-role') {
      const role = interaction.options.getRole('role', true);
      const removed = await removeKickAllowedRole(interaction.guild.id, role.id);
      await interaction.reply({
        content: removed
          ? `Đã xóa quyền kick/rollback khỏi role <@&${role.id}>.`
          : `Role <@&${role.id}> không có trong danh sách được phép.`,
        ephemeral: true
      });
      return;
    }

    if (subcommand === 'add-log-channel') {
      const channel = interaction.options.getChannel('channel', true);
      const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe();
      const botPermissions = channel.permissionsFor(botMember);
      if (!botPermissions?.has([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks
      ])) {
        throw new Error('Bot cần quyền xem kênh, gửi tin nhắn và gửi embed trong kênh này.');
      }
      await addKickLogChannel(interaction.guild.id, channel.id, interaction.user.id);
      await interaction.reply({
        content: `Đã thêm ${channel} vào danh sách kênh nhận log kick.`,
        ephemeral: true
      });
      return;
    }

    if (subcommand === 'remove-log-channel') {
      const channel = interaction.options.getChannel('channel', true);
      const removed = await removeKickLogChannel(interaction.guild.id, channel.id);
      await interaction.reply({
        content: removed
          ? `Đã xóa ${channel} khỏi danh sách kênh nhận log kick.`
          : `${channel} chưa có trong danh sách kênh nhận log kick.`,
        ephemeral: true
      });
      return;
    }

    if (subcommand === 'log-channels') {
      const channels = await listKickLogChannels(interaction.guild.id);
      const lines = channels.length
        ? channels.map((item, index) => `**${index + 1}.** <#${item.channelId}>`).join('\n')
        : 'Chưa cấu hình kênh nhận log kick.';
      await interaction.reply({
        content: `Danh sách kênh nhận thông báo kick:\n${lines}`,
        ephemeral: true
      });
      return;
    }

    if (subcommand === 'detail') {
      const kickId = interaction.options.getString('kick-id', true).trim();
      const record = await getKickRecordById(interaction.guild.id, kickId);
      if (!record) {
        throw new Error('Không tìm thấy mã kick này trong máy chủ.');
      }

      const timestamp = value => value
        ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
        : 'Không có';
      const rollbackStatus = record.rolledBack
        ? `Đã rollback lúc ${timestamp(record.rolledBackAt)} bởi <@${record.rolledBackBy}>`
        : Date.now() <= new Date(record.rollbackAllowedUntil).getTime()
          ? `Chưa rollback; còn hạn đến ${timestamp(record.rollbackAllowedUntil)}`
          : `Chưa rollback; đã hết hạn lúc ${timestamp(record.rollbackAllowedUntil)}`;
      const roleLines = (record.rolesSnapshot || []).map((role, index) =>
        `${index + 1}. ${role.name} (ID: ${role.id}; màu: #${Number(role.color || 0).toString(16).padStart(6, '0')}; hiển thị riêng: ${role.hoist ? 'có' : 'không'}; cho phép nhắc: ${role.mentionable ? 'có' : 'không'})`
      );
      const roleText = roleLines.length ? roleLines.join('\n') : 'Không có role nào được lưu.';
      const details = [
        `Mã kick: ${record._id}`,
        `Máy chủ: ${record.guildId}`,
        `Người bị kick: ${record.targetUserId}`,
        `Người thực hiện: ${record.kickerUserId}`,
        `Thời điểm kick: ${timestamp(record.kickedAt)}`,
        `Lý do: ${record.reason || 'Không có lý do'}`,
        `Trạng thái rollback: ${rollbackStatus}`,
        '',
        'Role snapshot trước khi kick:',
        roleText
      ].join('\n');
      const roleSummary = roleLines.length > 0
        ? roleLines.slice(0, 10).join('\n').slice(0, 1024)
        : 'Không có role nào được lưu.';

      await interaction.reply({
        embeds: [{
          color: record.rolledBack ? 0x2ecc71 : 0xe67e22,
          title: `Chi tiết lần kick ${record._id}`,
          description: [
            `**Người bị kick:** <@${record.targetUserId}> (\`${record.targetUserId}\`)`,
            `**Người kick:** <@${record.kickerUserId}> (\`${record.kickerUserId}\`)`,
            `**Thời điểm:** ${timestamp(record.kickedAt)}`,
            `**Lý do:** ${record.reason || 'Không có lý do'}`,
            `**Rollback:** ${rollbackStatus}`
          ].join('\n'),
          fields: [{
            name: `Role snapshot (${roleLines.length})`,
            value: roleSummary
          }],
          timestamp: new Date(record.kickedAt).toISOString()
        }],
        files: [{
          attachment: Buffer.from(details, 'utf8'),
          name: `kick-${record._id}.txt`
        }],
        ephemeral: true
      });
      return;
    }

    const roles = await listKickAllowedRoles(interaction.guild.id);
    const lines = roles.length
      ? roles.map((item, index) => `**${index + 1}.** <@&${item.roleId}>`).join('\n')
      : 'Chưa có role nào được cấp quyền.';
    await interaction.reply({
      content: `Danh sách role được phép kick/rollback:\n${lines}`,
      ephemeral: true
    });
  } catch (error) {
    console.error('[ERROR] Kick manager command failed:', error);
    const content = `Không thể xử lý lệnh: ${error.message}`;
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content, ephemeral: true });
    } else {
      await interaction.reply({ content, ephemeral: true });
    }
  }
}

export async function canUseKickCommand(guildId, roleIds) {
  return isKickAllowedMember(guildId, roleIds);
}

export async function rollbackLastKick(guildId, userId, roleIds, targetUserId) {
  const latest = await getLatestKickRecord(guildId, targetUserId);
  if (!latest) {
    throw new Error('Không có lịch sử kick hợp lệ để rollback.');
  }
  if (latest.kickerUserId !== userId) {
    throw new Error('Bạn chỉ có thể rollback lần kick do chính bạn thực hiện.');
  }
  if (!(await isKickAllowedMember(guildId, roleIds))) {
    throw new Error('Bạn không có role được cấp quyền rollback.');
  }
  if (latest.rolledBack) {
    throw new Error('Lần kick này đã được rollback trước đó.');
  }
  if (Date.now() - new Date(latest.kickedAt).getTime() > 24 * 60 * 60 * 1000) {
    throw new Error('Chỉ có thể rollback trong vòng 24 giờ kể từ khi kick.');
  }

  return latest;
}

export async function completeKickRollback(recordId, rolledBackByUserId) {
  await markKickRolledBack(recordId, rolledBackByUserId, new Date());
}

export async function getTargetKickHistory(guildId, targetUserId) {
  return getKickHistoryByTarget(guildId, targetUserId);
}
