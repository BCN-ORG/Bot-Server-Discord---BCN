import { AuditLogEvent, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import {
  isKickAllowedMember,
  getLatestKickRecord,
  listKickLogChannels,
  saveKickRecord,
  markKickRolledBack
} from '../../database/kickManager.js';

async function sendKickNotification(user, embed, eventName) {
  try {
    await user.send({ embeds: [embed] });
    return true;
  } catch (error) {
    console.warn(
      `[WARN] Could not DM user ${user.id} about ${eventName}:`,
      error
    );
    return false;
  }
}

function roleNames(roles) {
  return roles.length
    ? roles.map(role => `• ${role.name}`).join('\n').slice(0, 1024)
    : 'Không có role nào được lưu.';
}

async function sendKickLog(guild, channels, embed) {
  for (const { channelId } of channels) {
    try {
      const channel = await guild.channels.fetch(channelId);
      if (!channel?.isTextBased() || !channel.send) {
        console.warn(`[WARN] Kick log channel ${channelId} is missing or not text-based.`);
        continue;
      }
      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error(`[ERROR] Failed to send kick log to channel ${channelId}:`, error);
    }
  }
}

function getRoleSnapshot(member, guildId) {
  return member.roles.cache
    .filter(role => role.id !== guildId)
    .map(role => ({
      id: role.id,
      name: role.name,
      color: role.color,
      hoist: role.hoist,
      mentionable: role.mentionable
    }));
}

function createKickLogContent({
  guild,
  targetUser,
  kickerUser,
  reason,
  kickedAt,
  rolesSnapshot,
  kickId,
  dmSent
}) {
  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle('Thành viên bị kick')
    .setDescription([
      `**Người bị kick:** <@${targetUser.id}> (\`${targetUser.id}\`)`,
      `**Người kick:** <@${kickerUser.id}> (\`${kickerUser.id}\`)`,
      `**Lý do:** ${reason.slice(0, 1000)}`,
      `**Thời điểm:** <t:${Math.floor(kickedAt.getTime() / 1000)}:F>`,
      `**Mã kick:** \`${kickId}\``,
      ...(dmSent === null ? [] : [`**DM gửi trước khi kick:** ${dmSent ? 'Có' : 'Không gửi được'}`])
    ].join('\n'))
    .addFields({
      name: `Role snapshot (${rolesSnapshot.length})`,
      value: roleNames(rolesSnapshot)
    })
    .setTimestamp(kickedAt);
  return embed;
}

export async function handleGuildMemberKick(member) {
  try {
    const { guild } = member;
    const channels = await listKickLogChannels(guild.id);
    if (!channels.length) return;

    let entry;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const auditLogs = await guild.fetchAuditLogs({
        type: AuditLogEvent.MemberKick,
        limit: 10
      });
      entry = auditLogs.entries.find(item =>
        item.target?.id === member.id
        && Date.now() - item.createdTimestamp < 15_000
        && (!member.joinedTimestamp || item.createdTimestamp >= member.joinedTimestamp - 1_000)
      );
      if (entry) break;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 700));
    }

    if (!entry?.executor) return;
    if (entry.executor.id === guild.client.user.id) return;

    const rolesSnapshot = getRoleSnapshot(member, guild.id);
    const kickedAt = entry.createdAt || new Date(entry.createdTimestamp);
    const reason = entry.reason || 'Không có lý do được ghi trong nhật ký kiểm toán.';
    const record = await saveKickRecord({
      guildId: guild.id,
      targetUserId: member.id,
      kickedByUserId: entry.executor.id,
      reason,
      rolesSnapshot,
      kickedAt,
      rollbackAllowedUntil: new Date(kickedAt.getTime() + 24 * 60 * 60 * 1000)
    });
    const embed = createKickLogContent({
      guild,
      targetUser: member.user,
      kickerUser: entry.executor,
      reason,
      kickedAt,
      rolesSnapshot,
      kickId: record.insertedId,
      dmSent: null
    });
    await sendKickLog(guild, channels, embed);
  } catch (error) {
    console.error(`[ERROR] Failed to log kicked member ${member.id}:`, error);
  }
}

export const data = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('Kick người dùng khỏi server và lưu role để rollback')
  .addUserOption(option =>
    option.setName('user').setDescription('Thành viên cần kick').setRequired(true)
  )
  .addStringOption(option =>
    option.setName('reason').setDescription('Lý do kick').setRequired(false)
  );

export const rollbackData = new SlashCommandBuilder()
  .setName('kick-rollback')
  .setDescription('Khôi phục role cho người đã bị kick')
  .addUserOption(option =>
    option.setName('user').setDescription('Thành viên đã bị kick').setRequired(true)
  );

export async function execute(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    const guild = interaction.guild;
    if (!guild) {
      throw new Error('Lệnh này chỉ dùng được trong server.');
    }
    const invoker = await guild.members.fetch(interaction.user.id);
    const allowed = await isKickAllowedMember(
      guild.id,
      invoker.roles.cache.map(role => role.id)
    );
    if (!allowed) {
      throw new Error('Bạn không được phép sử dụng lệnh kick này.');
    }

    const targetUser = interaction.options.getUser('user', true);
    if (targetUser.bot) {
      throw new Error('Không thể kick bot.');
    }

    const reason = interaction.options.getString('reason') || 'Không có lý do';
    const member = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      throw new Error('Người này không còn ở trong server.');
    }

    const rolesSnapshot = getRoleSnapshot(member, guild.id);

    const kickTime = new Date();
    const dmSent = await sendKickNotification(
      targetUser,
      new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('Thông báo kick khỏi máy chủ')
        .setDescription(`Bạn sẽ bị kick khỏi **${guild.name}**.`)
        .addFields(
          { name: 'Người thực hiện', value: `${interaction.user.tag} (${interaction.user.id})` },
          { name: 'Lý do', value: reason.slice(0, 1024) },
          { name: 'Thời điểm', value: `<t:${Math.floor(kickTime.getTime() / 1000)}:F>` },
          {
            name: `Role trước khi kick (${rolesSnapshot.length})`,
            value: roleNames(rolesSnapshot)
          }
        )
        .setTimestamp(kickTime)
        .setFooter({ text: `Máy chủ ID: ${guild.id}` }),
      'kick'
    );

    await guild.members.kick(targetUser.id, reason);
    const kickRecord = await saveKickRecord({
      guildId: guild.id,
      targetUserId: targetUser.id,
      kickedByUserId: interaction.user.id,
      reason,
      rolesSnapshot,
      kickedAt: kickTime,
      rollbackAllowedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
    const logChannels = await listKickLogChannels(guild.id);
    const kickEmbed = createKickLogContent({
      guild,
      targetUser,
      kickerUser: interaction.user,
      reason,
      kickedAt: kickTime,
      rolesSnapshot,
      kickId: kickRecord.insertedId,
      dmSent
    });
    await sendKickLog(guild, logChannels, kickEmbed);

    await interaction.editReply({
      content: `Đã kick <@${targetUser.id}> khỏi server. Snapshot role đã được lưu để rollback trong vòng 24 giờ.\nMã kick: \`${kickRecord.insertedId}\`${dmSent ? '\nĐã gửi thông báo DM trước khi kick.' : '\nKhông gửi được DM trước khi kick (người dùng có thể đã tắt tin nhắn riêng).'}`,
    });
  } catch (error) {
    console.error('[ERROR] Kick command failed:', error);
    const content = `Không thể xử lý: ${error.message}`;
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content, ephemeral: true });
    } else {
      await interaction.reply({ content, ephemeral: true });
    }
  }
}

export async function executeRollback(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    const guild = interaction.guild;
    if (!guild) {
      throw new Error('Lệnh này chỉ dùng được trong server.');
    }
    const invoker = await guild.members.fetch(interaction.user.id);
    const targetUser = interaction.options.getUser('user', true);
    const latest = await rollbackKick(
      guild.id,
      interaction.user.id,
      invoker.roles.cache.map(role => role.id),
      targetUser.id
    );
    const member = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      throw new Error('Người này chưa quay lại máy chủ nên chưa thể rollback role.');
    }

    const restoredRoles = [];
    const currentRoleIds = member.roles.cache.map(role => role.id);
    for (const role of latest.rolesSnapshot || []) {
      if (!currentRoleIds.includes(role.id)) {
        await member.roles.add(role.id, `Rollback role after kick by ${interaction.user.id}`);
        restoredRoles.push(role.id);
      }
    }

    await markKickRolledBack(latest._id, interaction.user.id, new Date());
    const dmSent = await sendKickNotification(
      targetUser,
      new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('Role của bạn đã được khôi phục')
        .setDescription(`Role từ lần kick khỏi **${guild.name}** đã được khôi phục.`)
        .addFields(
          { name: 'Người khôi phục', value: `${interaction.user.tag} (${interaction.user.id})` },
          { name: 'Thời điểm', value: `<t:${Math.floor(Date.now() / 1000)}:F>` },
          {
            name: `Role đã khôi phục (${restoredRoles.length})`,
            value: roleNames(restoredRoles.map(roleId => ({
              id: roleId,
              name: latest.rolesSnapshot.find(role => role.id === roleId)?.name || roleId
            })))
          },
          { name: 'Mã kick', value: `\`${latest._id}\`` }
        )
        .setTimestamp()
        .setFooter({ text: `Máy chủ ID: ${guild.id}` }),
      'kick rollback'
    );
    await interaction.editReply({
      content: `Đã khôi phục ${restoredRoles.length} role cho <@${targetUser.id}> từ lần kick gần nhất do bạn thực hiện.${dmSent ? '\nĐã gửi thông báo qua DM.' : '\nKhông thể gửi DM (người dùng có thể đã tắt tin nhắn riêng).'}`,
    });
  } catch (error) {
    console.error('[ERROR] Kick rollback command failed:', error);
    const content = `Không thể xử lý: ${error.message}`;
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content, ephemeral: true });
    } else {
      await interaction.reply({ content, ephemeral: true });
    }
  }
}

export async function rollbackKick(guildId, userId, roleIds, targetUserId) {
  const latest = await getLatestKickRecord(guildId, targetUserId);
  if (!latest) {
    throw new Error('Không có lịch sử kick hợp lệ để rollback.');
  }
  if (latest.kickerUserId !== userId) {
    throw new Error('Bạn chỉ có thể rollback lần kick do chính bạn thực hiện.');
  }
  const canUse = await isKickAllowedMember(guildId, roleIds);
  if (!canUse) {
    throw new Error('Bạn không có quyền rollback role cho sự kiện này.');
  }
  if (latest.rolledBack) {
    throw new Error('Lần kick này đã được rollback rồi.');
  }
  if (Date.now() > new Date(latest.rollbackAllowedUntil).getTime()) {
    throw new Error('Đã quá 24 giờ kể từ khi kick.');
  }

  return latest;
}

export async function finalizeRollback(guildId, member, recordId, rolledBackByUserId) {
  const memberRoleIds = member.roles.cache.map(role => role.id);
  for (const role of recordId.rolesSnapshot || []) {
    if (!memberRoleIds.includes(role.id)) {
      await member.roles.add(role.id, `Rollback kick by ${rolledBackByUserId}`);
    }
  }
  await markKickRolledBack(recordId._id, rolledBackByUserId, new Date());
}
