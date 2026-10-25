/**
 * Violation Service
 * Business logic for violation operations
 */

import { EmbedBuilder } from 'discord.js';
import { getViolationConfig, getViolationsByUser } from '../../../database/violations.js';
import { topupForViolation } from './payrollViolationClient.js';

/**
 * Check if user is authorized to create violations
 * @param {string} guildId 
 * @param {string} userId 
 * @param {GuildMember} member 
 */
export async function isUserAuthorized(guildId, userId, member) {
  try {
    const config = await getViolationConfig(guildId);
    
    // Check if user has any of the authorized roles
    const hasAuthorizedRole = member.roles.cache.some(role => 
      config.authorizedRoles.includes(role.id)
    );

    return hasAuthorizedRole;
  } catch (error) {
    console.error('[Violation Service] Error checking authorization:', error);
    return false;
  }
}

/**
 * Create violation with notifications
 * @param {Object} params
 * @param {Guild} params.guild
 * @param {User} params.targetUser
 * @param {string} params.reason
 * @param {number} params.amount
 * @param {string} params.createdBy
 */
export async function createViolationWithNotification({ guild, targetUser, reason, amount, createdBy }) {
  try {
    const { createViolation, getViolationConfig } = await import('../../../database/violations.js');

    // Create violation in database
    const violation = await createViolation({
      userId: targetUser.id,
      username: targetUser.username,
      reason,
      amount,
      createdBy,
      guildId: guild.id
    });

    // Send DM to violator
    await sendViolationDM(targetUser, violation);

    // Send announcement to configured channel
    const config = await getViolationConfig(guild.id);
    if (config.announcementChannelId) {
      await sendViolationAnnouncement(guild, violation, config.announcementChannelId);
    }

    return violation;
  } catch (error) {
    console.error('[Violation Service] Error creating violation with notification:', error);
    throw error;
  }
}

/**
 * Confirm payment for violation
 * @param {Object} params
 * @param {string} params.violationId
 * @param {string} params.payerId
 * @param {Interaction} params.interaction
 */
export async function confirmPayment({ violationId, payerId, interaction }) {
  try {
    const { getViolationById, markViolationPaid } = await import('../../../database/violations.js');

    // Get violation
    const violation = await getViolationById(violationId);

    if (!violation) {
      return {
        success: false,
        message: `Không tìm thấy biên bản phạt \`${violationId}\``
      };
    }

    if (violation.isPaid) {
      return {
        success: false,
        message: `Biên bản phạt \`${violationId}\` đã được thanh toán rồi`
      };
    }

    // Call Payroll API to topup
    const payrollResponse = await topupForViolation({
      violationId: violation.violationId,
      payerId,
      amount: violation.amount,
      reason: `Đóng phạt biên bản ${violation.violationId}: ${violation.reason}`
    });

    // Handle response
    if (payrollResponse.httpStatus === 200) {
      const data = payrollResponse.data;

      if (data.status === 'SUCCESS' && !data.duplicate) {
        // Mark violation as paid
        await markViolationPaid(
          violation.violationId,
          payerId,
          data.reference
        );

        // Send confirmation DMs
        try {
          const violator = await interaction.client.users.fetch(violation.userId);
          const payer = await interaction.client.users.fetch(payerId);

          // DM to violator
          const violatorEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Biên bản phạt đã được thanh toán')
            .setDescription(
              `Biên bản phạt của bạn đã được thanh toán!\n\n` +
              `**Mã biên bản:** \`${violation.violationId}\`\n` +
              `**Lý do:** ${violation.reason}\n` +
              `**Số tiền:** ${violation.amount} coins\n` +
              `**Người thanh toán:** ${payer.username}${payerId === violation.userId ? ' (bạn)' : ''}`
            )
            .setTimestamp();

          await violator.send({ embeds: [violatorEmbed] });

          // DM to payer (if different from violator)
          if (payerId !== violation.userId) {
            const payerEmbed = new EmbedBuilder()
              .setColor('#00ff00')
              .setTitle('✅ Đã thanh toán biên bản phạt')
              .setDescription(
                `Bạn đã thanh toán biên bản phạt!\n\n` +
                `**Mã biên bản:** \`${violation.violationId}\`\n` +
                `**Người bị phạt:** ${violator.username}\n` +
                `**Lý do:** ${violation.reason}\n` +
                `**Số tiền:** ${violation.amount} coins`
              )
              .setTimestamp();

            await payer.send({ embeds: [payerEmbed] });
          }
        } catch (error) {
          console.log('[Violation Service] Could not send confirmation DMs (DM disabled)');
        }

        return {
          success: true,
          message: `✅ Đã thanh toán thành công biên bản phạt \`${violation.violationId}\`\n` +
                   `Số tiền: ${violation.amount} coins`
        };

      } else if (data.duplicate) {
        return {
          success: false,
          message: `Biên bản phạt \`${violationId}\` đã được thanh toán trước đó`
        };

      } else if (data.status === 'FAILED') {
        return {
          success: false,
          message: `❌ Thanh toán thất bại: ${data.error || 'Không đủ tiền trong ví'}`
        };
      }
    }

    // Handle HTTP errors
    if (payrollResponse.httpStatus === 403) {
      return {
        success: false,
        message: '❌ Bạn không có quyền thực hiện giao dịch này (tài khoản bot hoặc không trong server)'
      };
    }

    if (payrollResponse.httpStatus === 404) {
      return {
        success: false,
        message: '❌ Không tìm thấy người dùng trong server'
      };
    }

    return {
      success: false,
      message: '❌ Có lỗi xảy ra khi xử lý thanh toán. Vui lòng thử lại sau.'
    };

  } catch (error) {
    console.error('[Violation Service] Error confirming payment:', error);
    return {
      success: false,
      message: '❌ Có lỗi xảy ra khi xử lý thanh toán. Vui lòng thử lại sau.'
    };
  }
}

/**
 * Get user violations summary
 * @param {string} userId 
 */
export async function getUserViolationsSummary(userId) {
  try {
    const unpaidViolations = await getViolationsByUser(userId, false);
    const totalAmount = unpaidViolations.reduce((sum, v) => sum + v.amount, 0);

    return {
      violations: unpaidViolations,
      count: unpaidViolations.length,
      totalAmount
    };
  } catch (error) {
    console.error('[Violation Service] Error getting user violations summary:', error);
    throw error;
  }
}

/**
 * Format violation as Discord embed
 * @param {Object} violation 
 */
export function formatViolationEmbed(violation) {
  const embed = new EmbedBuilder()
    .setColor(violation.isPaid ? '#00ff00' : '#ff0000')
    .setTitle(`📋 Biên bản phạt ${violation.violationId}`)
    .addFields(
      { name: '👤 Người bị phạt', value: `<@${violation.userId}>`, inline: true },
      { name: '💰 Số tiền', value: `${violation.amount} coins`, inline: true },
      { name: '📝 Lý do', value: violation.reason, inline: false },
      { 
        name: '📅 Ngày tạo', 
        value: violation.createdAt.toLocaleString('vi-VN'), 
        inline: true 
      },
      { 
        name: '✅ Trạng thái', 
        value: violation.isPaid ? 'Đã thanh toán' : 'Chưa thanh toán', 
        inline: true 
      }
    )
    .setTimestamp();

  if (violation.isPaid && violation.paidAt) {
    embed.addFields(
      { 
        name: '💳 Người thanh toán', 
        value: `<@${violation.paidBy}>`, 
        inline: true 
      },
      { 
        name: '📅 Ngày thanh toán', 
        value: violation.paidAt.toLocaleString('vi-VN'), 
        inline: true 
      }
    );
  }

  return embed;
}

/**
 * Send violation DM to user
 * @param {User} user 
 * @param {Object} violation 
 */
export async function sendViolationDM(user, violation) {
  try {
    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('⚠️ Bạn đã bị lập biên bản phạt')
      .setDescription(
        `Bạn đã bị lập biên bản phạt. Vui lòng thanh toán để tránh bị nhắc nhở hàng ngày.\n\n` +
        `**Mã biên bản:** \`${violation.violationId}\`\n` +
        `**Lý do:** ${violation.reason}\n` +
        `**Số tiền:** ${violation.amount} coins\n\n` +
        `Sử dụng lệnh \`/violation-confirm-payment\` để thanh toán.`
      )
      .setFooter({ text: 'Hệ thống biên bản phạt' })
      .setTimestamp();

    await user.send({ embeds: [embed] });
    console.log(`[Violation Service] Sent violation DM to ${user.tag}`);
  } catch (error) {
    console.log('[Violation Service] Could not send violation DM (DM disabled)');
  }
}

/**
 * Send violation announcement to channel
 * @param {Guild} guild 
 * @param {Object} violation 
 * @param {string} channelId 
 */
export async function sendViolationAnnouncement(guild, violation, channelId) {
  try {
    const channel = await guild.channels.fetch(channelId);
    
    if (!channel || !channel.isTextBased()) {
      console.log('[Violation Service] Announcement channel not found or not text-based');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('🚨 Biên bản phạt mới')
      .setDescription(
        `<@${violation.userId}> đã bị lập biên bản phạt!\n\n` +
        `**Mã biên bản:** \`${violation.violationId}\`\n` +
        `**Lý do:** ${violation.reason}\n` +
        `**Số tiền:** ${violation.amount} coins`
      )
      .setFooter({ text: 'Hệ thống biên bản phạt' })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
    console.log(`[Violation Service] Sent announcement to channel ${channelId}`);
  } catch (error) {
    console.error('[Violation Service] Error sending announcement:', error);
  }
}
