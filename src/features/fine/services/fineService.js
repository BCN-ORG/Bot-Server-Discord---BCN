import { EmbedBuilder } from 'discord.js';
import {
  createFine,
  getFineById,
  getFinesByUser,
  getAllFines,
  getUnpaidFines,
  markFineAsPaid,
  getFineConfig
} from '../../../database/fines.js';
import { payFineWithTopup } from './payrollFineClient.js';

/**
 * Check if user has authorized role
 */
export function hasAuthorizedRole(member, authorizedRoles) {
  return authorizedRoles.some(roleId => member.roles.cache.has(roleId));
}

/**
 * Create a new fine and send notifications
 */
export async function createAndNotifyFine(client, violatorId, violator, reason, amount, createdBy) {
  // Create fine in database
  const fine = await createFine(
    violatorId,
    violator.user.username,
    reason,
    amount,
    createdBy
  );

  // Send DM to violator
  try {
    const dmEmbed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('⚠️ Thông Báo Biên Bản Phạt')
      .setDescription(
        `Bạn đã bị lập biên bản phạt!\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📋 **Mã biên bản:** ${fine.fineId}\n` +
        `💰 **Số tiền:** ${fine.amount} coins\n` +
        `📝 **Lý do:** ${fine.reason}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `💡 Sử dụng lệnh \`/fine-check\` để xem biên bản của bạn\n` +
        `💳 Sử dụng lệnh \`/fine-confirm-payment ${fine.fineId}\` để thanh toán`
      )
      .setTimestamp()
      .setFooter({ text: `Server: ${violator.guild.name}` });

    await violator.send({ embeds: [dmEmbed] });
    console.log(`[Fine] Sent DM to ${violator.user.tag}`);
  } catch (error) {
    console.log('[Fine] Could not send DM to violator (DM disabled)');
  }

  // Send public announcements to all configured channels
  const config = await getFineConfig(violator.guild.id);
  
  for (const channelId of config.announcementChannels) {
    try {
      const channel = await client.channels.fetch(channelId);
      if (channel && channel.isTextBased()) {
        const publicEmbed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('🚨 Thông Báo Biên Bản Phạt')
          .setDescription(
            `${violator} đã bị lập biên bản phạt!\n\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `📋 **Mã biên bản:** ${fine.fineId}\n` +
            `💰 **Số tiền:** ${fine.amount} coins\n` +
            `📝 **Lý do:** ${fine.reason}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━`
          )
          .setTimestamp();

        await channel.send({ embeds: [publicEmbed] });
        console.log(`[Fine] Sent announcement to channel ${channel.name}`);
      }
    } catch (error) {
      console.error(`[Fine] Could not send announcement to channel ${channelId}:`, error.message);
    }
  }

  return fine;
}

/**
 * Process fine payment
 */
export async function processFinePayment(fineId, payerId) {
  // Get fine
  const fine = await getFineById(fineId);
  
  if (!fine) {
    return { success: false, error: 'Biên bản không tồn tại' };
  }

  if (fine.isPaid) {
    return { success: false, error: 'Biên bản này đã được thanh toán' };
  }

  // Call Payroll API /topup
  const reason = `Đóng phạt ${fineId}: ${fine.reason}`;
  
  try {
    const result = await payFineWithTopup(fineId, payerId, fine.amount, reason);

    if (result.success) {
      // Mark fine as paid
      await markFineAsPaid(fineId, payerId, result.reference);
      
      return {
        success: true,
        fine,
        reference: result.reference,
        duplicate: result.duplicate
      };
    } else {
      // Payment failed
      let errorMessage = 'Thanh toán thất bại';
      
      if (result.httpStatus === 400) {
        errorMessage = 'Dữ liệu không hợp lệ';
      } else if (result.httpStatus === 403 || result.httpStatus === 404) {
        errorMessage = 'Người dùng không tồn tại trong server';
      } else if (result.data && result.data.status === 'FAILED') {
        errorMessage = 'Không đủ coin để thanh toán. Vui lòng nạp thêm coin!';
      }
      
      return { success: false, error: errorMessage };
    }
  } catch (error) {
    console.error('[Fine] Payment error:', error);
    return { success: false, error: 'Lỗi kết nối đến hệ thống thanh toán' };
  }
}

/**
 * Send daily reminders to users with unpaid fines
 */
export async function sendDailyReminders(client, guildId) {
  try {
    const unpaidFines = await getUnpaidFines();
    
    if (unpaidFines.length === 0) {
      console.log('[Fine Reminder] No unpaid fines to remind');
      return;
    }

    // Group fines by user
    const finesByUser = {};
    unpaidFines.forEach(fine => {
      if (!finesByUser[fine.userId]) {
        finesByUser[fine.userId] = [];
      }
      finesByUser[fine.userId].push(fine);
    });

    // Send reminder to each user
    for (const [userId, userFines] of Object.entries(finesByUser)) {
      try {
        const user = await client.users.fetch(userId);
        
        const totalAmount = userFines.reduce((sum, f) => sum + f.amount, 0);
        
        const embed = new EmbedBuilder()
          .setColor('#ff9900')
          .setTitle('⏰ Nhắc Nhở Biên Bản Phạt')
          .setDescription(
            `Bạn có **${userFines.length}** biên bản phạt chưa thanh toán!\n\n` +
            `💰 **Tổng số tiền:** ${totalAmount} coins\n\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n`
          )
          .setTimestamp();

        // Add up to 5 fines
        const displayFines = userFines.slice(0, 5);
        displayFines.forEach((fine, index) => {
          embed.addFields({
            name: `${index + 1}. ${fine.fineId}`,
            value: `• **Lý do:** ${fine.reason}\n• **Số tiền:** ${fine.amount} coins`,
            inline: false
          });
        });

        if (userFines.length > 5) {
          embed.setFooter({ text: `... và ${userFines.length - 5} biên bản khác. Dùng /fine-check để xem chi tiết` });
        } else {
          embed.setFooter({ text: 'Dùng /fine-confirm-payment để thanh toán' });
        }

        await user.send({ embeds: [embed] });
        console.log(`[Fine Reminder] Sent reminder to ${user.tag}`);
      } catch (error) {
        console.log(`[Fine Reminder] Could not send reminder to user ${userId}:`, error.message);
      }
    }

    console.log(`[Fine Reminder] Sent reminders to ${Object.keys(finesByUser).length} users`);
  } catch (error) {
    console.error('[Fine Reminder] Error sending reminders:', error);
  }
}

/**
 * Check and notify unpaid fines when user joins voice channel
 */
export async function checkAndNotifyVoiceJoin(member, textChannel) {
  try {
    const unpaidFines = await getFinesByUser(member.id, false);

    if (unpaidFines.length === 0) {
      return; // No unpaid fines
    }

    const totalAmount = unpaidFines.reduce((sum, f) => sum + f.amount, 0);

    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('⚠️ Nhắc nhở nợ phạt')
      .setDescription(
        `${member} có **${unpaidFines.length}** biên bản phạt chưa thanh toán!\n\n` +
        `💰 **Tổng số tiền:** ${totalAmount} coins\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n`
      )
      .setTimestamp();

    // Add violations (max 5)
    const displayFines = unpaidFines.slice(0, 5);
    displayFines.forEach((fine, index) => {
      embed.addFields({
        name: `${index + 1}. ${fine.fineId}`,
        value: `• **Lý do:** ${fine.reason}\n• **Số tiền:** ${fine.amount} coins`,
        inline: false
      });
    });

    if (unpaidFines.length > 5) {
      embed.setFooter({ text: `... và ${unpaidFines.length - 5} biên bản khác. Dùng /fine-check để xem chi tiết` });
    } else {
      embed.setFooter({ text: 'Dùng /fine-confirm-payment để thanh toán' });
    }

    await textChannel.send({ embeds: [embed] });
    console.log(`[Fine] Sent voice join notification for ${member.user.tag} to ${textChannel.name}`);
  } catch (error) {
    console.error('[Fine] Error sending voice join notification:', error);
  }
}
