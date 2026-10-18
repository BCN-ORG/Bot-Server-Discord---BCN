import cron from 'node-cron';
import { getOverdueViolations, markViolationAsKicked } from '../database/violations.js';
import { validateName } from '../features/rename/validate.js';
import { isSchedulerEnabled } from '../features/scheduler/controller.js';
import { EmbedBuilder } from 'discord.js';

/**
 * Kiem tra va xu ly vi pham qua han
 * Chay luc 00:00 hang ngay
 */
export function startViolationChecker(client) {
  // Chay luc 00:00 moi ngay (nua dem)
  cron.schedule('0 0 * * *', async () => {
    // Kiem tra scheduler co duoc bat khong
    const enabled = await isSchedulerEnabled();
    if (!enabled) {
      console.log('[SCHEDULER] Scheduler is disabled, skipping violation check');
      return;
    }
    
    console.log('[SCHEDULER] Running violation checker at midnight...');
    
    try {
      await checkAndKickOverdueMembers(client);
    } catch (error) {
      console.error('[ERROR] Violation checker failed:', error);
    }
  });

  console.log('[INFO] Violation checker scheduler started (runs at 00:00 daily)');
}

/**
 * Kiem tra va kick members co vi pham qua han
 * @param {Client} client 
 */
async function checkAndKickOverdueMembers(client) {
  try {
    // Lay tat ca vi pham qua han
    const overdueViolations = await getOverdueViolations();

    if (overdueViolations.length === 0) {
      console.log('[INFO] No overdue violations found');
      return;
    }

    console.log(`[INFO] Processing ${overdueViolations.length} overdue violations`);

    for (const violation of overdueViolations) {
      try {
        // Lay guild va member tu Discord
        const guild = client.guilds.cache.get(violation.guildId);
        if (!guild) {
          console.log(`[WARN] Guild ${violation.guildId} not found, skipping`);
          continue;
        }

        const member = await guild.members.fetch(violation.memberId).catch(() => null);
        if (!member) {
          console.log(`[WARN] Member ${violation.memberId} not found, skipping`);
          continue;
        }

        // Kiem tra lai nickname hien tai
        const currentNickname = member.nickname || member.user.username;
        const validation = validateName(currentNickname);

        if (validation.valid) {
          // Da sua ten dung roi - khong kick
          console.log(`[INFO] Member ${member.user.tag} has fixed their name, not kicking`);
          
          // Cap nhat status thanh resolved (neu chua duoc cap nhat)
          const { resolveViolation } = await import('../database/violations.js');
          await resolveViolation(violation.guildId, violation.memberId);
          continue;
        }

        // Ten van sai - kick member
        await kickMember(member, violation);
        
        // Danh dau da kick
        await markViolationAsKicked(violation.guildId, violation.memberId);
        
        console.log(`[INFO] Kicked member ${member.user.tag} for invalid name`);
        
      } catch (error) {
        console.error(`[ERROR] Failed to process violation ${violation.id}:`, error);
      }
    }

    console.log('[INFO] Violation checker completed');
  } catch (error) {
    console.error('[ERROR] Failed to check overdue members:', error);
    throw error;
  }
}

/**
 * Kick member va gui thong bao
 * @param {GuildMember} member 
 * @param {Object} violation 
 */
async function kickMember(member, violation) {
  try {
    // Gui thong bao truoc khi kick
    try {
      const kickEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('🚫 Bạn đã bị kick khỏi server')
        .setDescription(`Lý do: Tên không hợp lệ sau 48 giờ`)
        .addFields(
          { name: 'Tên của bạn', value: `\`${violation.invalidNickname}\``, inline: false },
          { 
            name: '📋 Để vào lại server, vui lòng:', 
            value: '1️⃣ Đặt tên theo định dạng: **Nguyễn Minh Vũ**\n2️⃣ Liên hệ quản trị viên để được mời lại', 
            inline: false 
          }
        )
        .setFooter({ text: 'Quy định tên hiển thị' })
        .setTimestamp();

      await member.send({ embeds: [kickEmbed] });
    } catch (error) {
      console.log('[INFO] Could not send kick notification (DM disabled)');
    }

    // Kick member
    await member.kick(`Tên không hợp lệ quá 48 giờ: ${violation.invalidNickname}`);
    
    // Thong bao cho kenh quan tri vien (neu co)
    await notifyAdminsAboutKick(member, violation);
    
  } catch (error) {
    console.error(`[ERROR] Failed to kick member ${member.user.tag}:`, error);
    throw error;
  }
}

/**
 * Thong bao cho quan tri vien ve viec kick
 * @param {GuildMember} member 
 * @param {Object} violation 
 */
async function notifyAdminsAboutKick(member, violation) {
  try {
    const logChannel = member.guild.channels.cache.find(
      ch => ch.name === 'mod-logs' || ch.name === 'admin-logs' || ch.name === 'logs'
    );

    if (!logChannel) {
      return;
    }

    const kickLogEmbed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('🚫 [AUTO-KICK] Member bị kick')
      .setDescription(`Member bị kick vì tên không hợp lệ`)
      .addFields(
        { name: 'Member', value: `${member.user.tag} (${member.id})`, inline: false },
        { name: 'Tên không hợp lệ', value: `\`${violation.invalidNickname}\``, inline: false },
        { name: 'Thông báo lúc', value: violation.notifiedAt?.toLocaleString('vi-VN') || 'N/A', inline: true },
        { name: 'Hạn', value: violation.deadlineAt?.toLocaleString('vi-VN') || 'N/A', inline: true },
        { name: 'Kick lúc', value: new Date().toLocaleString('vi-VN'), inline: true }
      )
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({ text: 'Auto-Kick System' });

    await logChannel.send({ embeds: [kickLogEmbed] });
  } catch (error) {
    console.log('[INFO] Could not send admin notification');
  }
}

/**
 * Chay kiem tra ngay lap tuc (de test)
 * @param {Client} client 
 */
export async function runViolationCheckNow(client) {
  console.log('[INFO] Running violation check manually...');
  await checkAndKickOverdueMembers(client);
}
