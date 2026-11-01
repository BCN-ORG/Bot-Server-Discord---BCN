/**
 * Payroll Notification Scheduler
 * Scheduler de gui thong bao truoc khi tra luong
 */

import cron from 'node-cron';
import { EmbedBuilder } from 'discord.js';
import { getSalaryNotificationConfig } from '../../database/payroll.js';
import { generatePayrollPreview } from './services/payrollNotificationService.js';

let currentNotificationJob = null;
let currentNotificationConfig = null;

/**
 * Tao cron expression tu config
 * @param {number} dayOfWeek - 0=Sunday, 1=Monday, ..., 6=Saturday
 * @param {number} hour - 0-23
 * @param {number} minute - 0-59
 */
function createCronExpression(dayOfWeek, hour, minute) {
  // Cron format: 'minute hour dayOfMonth month dayOfWeek'
  return `${minute} ${hour} * * ${dayOfWeek}`;
}

/**
 * Gui notification embed
 * @param {Client} client 
 * @param {Object} previewData 
 * @param {Array<string>} notificationRoleIds 
 */
async function sendNotification(client, previewData, notificationRoleIds) {
  try {
    const guildId = process.env.GUILD_ID;
    if (!guildId) {
      console.error('[Payroll Notification] GUILD_ID not found in .env');
      return;
    }
    
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      console.error(`[Payroll Notification] Guild ${guildId} not found`);
      return;
    }
    
    // Tim channel de gui thong bao
    const channelNames = ['salary-notification', 'thong-bao-luong', 'mod-logs'];
    let targetChannel = null;
    
    for (const channelName of channelNames) {
      const channel = guild.channels.cache.find(ch => ch.name === channelName && ch.isTextBased());
      if (channel) {
        targetChannel = channel;
        break;
      }
    }
    
    if (!targetChannel) {
      console.warn(`[WARN] No notification channel found. Tried: ${channelNames.join(', ')}`);
      return;
    }
    
    // Tao embed thong bao
    const embed = new EmbedBuilder()
      .setColor(previewData.deficit > 0 ? '#ff9900' : '#00b300')
      .setTitle('🔔 Bao cao tra luong sap toi')
      .setDescription('Du toan tra luong cho ky tiep theo');
    
    // Them thong tin ngay tra luong
    if (previewData.nextPayrollDate) {
      const dateStr = previewData.nextPayrollDate.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      embed.addFields({ name: '📅 Thoi gian tra luong tiep theo', value: dateStr, inline: false });
    }
    
    // Them thong tin coins
    embed.addFields(
      { name: '👥 So thanh vien', value: previewData.memberCount.toString(), inline: true },
      { name: '💰 Tong coins can tra', value: previewData.totalCoinsNeeded.toString(), inline: true },
      { name: '🧾 Luong co dinh trong tong', value: previewData.fixedSalaryCoins.toString(), inline: true },
      { name: '🏦 So du hien tai', value: previewData.currentBalance.toString(), inline: true }
    );
    
    // Them thong tin thieu hut neu co
    if (previewData.deficit > 0) {
      embed.addFields({ 
        name: '⚠️ So du thieu', 
        value: `**${previewData.deficit}** coins\n_Can nap them de dam bao tra du luong_`, 
        inline: false 
      });
    } else {
      embed.addFields({ 
        name: '✅ Trang thai', 
        value: 'So du du de tra luong', 
        inline: false 
      });
    }
    
    embed.setFooter({ text: 'He thong tu dong bao cao' });
    embed.setTimestamp();

    // Gui thong bao trong channel (khong tag)
    await targetChannel.send({
      embeds: [embed]
    });

    console.log(`[Payroll Notification] Sent notification to #${targetChannel.name}`);

    // Gui DM rieng cho tung admin co role
    let dmCount = 0;
    let dmFailed = 0;

    if (notificationRoleIds && notificationRoleIds.length > 0) {
      const members = guild.members.cache;
      const notifiedUsers = new Set();

      for (const member of members.values()) {
        if (member.user.bot) continue;

        const hasNotificationRole = member.roles.cache.some(role =>
          notificationRoleIds.includes(role.id)
        );

        if (hasNotificationRole) {
          notifiedUsers.add(member);
        }
      }

      // Gui DM cho tung user
      for (const member of notifiedUsers) {
        try {
          await member.send({
            content: '📢 **Thông báo trả lương sắp tới**',
            embeds: [embed]
          });
          dmCount++;
          console.log(`[Payroll Notification] Sent DM to ${member.user.tag}`);
        } catch (error) {
          dmFailed++;
          console.warn(`[WARN] Cannot send DM to ${member.user.tag}: ${error.message}`);
        }
      }
    }

    console.log(`[Payroll Notification] DM summary: ${dmCount} sent, ${dmFailed} failed`);
    
  } catch (error) {
    console.error('[ERROR] Failed to send notification:', error);
  }
}

/**
 * Khoi tao notification scheduler
 * @param {Client} client 
 */
export async function initNotificationScheduler(client) {
  try {
    console.log('[Payroll Notification] Initializing notification scheduler...');
    
    // Lay config tu database
    currentNotificationConfig = await getSalaryNotificationConfig();
    
    const cronExpression = createCronExpression(
      currentNotificationConfig.dayOfWeek, 
      currentNotificationConfig.hour, 
      currentNotificationConfig.minute
    );
    
    const dayNames = ['Chu nhat', 'Thu hai', 'Thu ba', 'Thu tu', 'Thu nam', 'Thu sau', 'Thu bay'];
    const dayName = dayNames[currentNotificationConfig.dayOfWeek];
    
    console.log(`[Payroll Notification] Schedule: ${dayName} at ${String(currentNotificationConfig.hour).padStart(2, '0')}:${String(currentNotificationConfig.minute).padStart(2, '0')} (${currentNotificationConfig.timezone})`);
    console.log(`[Payroll Notification] Cron expression: ${cronExpression}`);
    
    if (currentNotificationConfig.notificationRoles && currentNotificationConfig.notificationRoles.length > 0) {
      console.log(`[Payroll Notification] ${currentNotificationConfig.notificationRoles.length} notification role(s) configured`);
    } else {
      console.warn('[WARN] No notification roles configured. Notifications will be sent without mentions.');
    }
    
    // Tao cron job với timezone support
    currentNotificationJob = cron.schedule(cronExpression, async () => {
      const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      console.log(`[SCHEDULER] ⏰ Starting payroll notification at ${now}...`);

      try {
        const previewData = await generatePayrollPreview(client);
        await sendNotification(client, previewData, currentNotificationConfig.notificationRoles || []);
        console.log('[SCHEDULER] ✅ Payroll notification completed successfully');
      } catch (error) {
        console.error('[ERROR] ❌ Scheduled notification failed:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Ho_Chi_Minh'
    });

    console.log('[INFO] ✓ Payroll notification scheduler initialized successfully');
    
  } catch (error) {
    console.error('[ERROR] Failed to initialize notification scheduler:', error);
    throw error;
  }
}

/**
 * Cap nhat notification schedule va restart cron job
 * @param {number} dayOfWeek 
 * @param {number} hour 
 * @param {number} minute 
 * @param {Client} client 
 */
export async function updateNotificationSchedule(dayOfWeek, hour, minute, client) {
  try {
    console.log(`[Payroll Notification] Updating notification schedule to day=${dayOfWeek}, hour=${hour}, minute=${minute}`);
    
    // Dung job cu
    if (currentNotificationJob) {
      currentNotificationJob.stop();
      console.log('[Payroll Notification] Stopped current notification cron job');
    }
    
    // Lay config moi tu database (da duoc cap nhat boi command)
    currentNotificationConfig = await getSalaryNotificationConfig();
    
    // Tao job moi
    const cronExpression = createCronExpression(dayOfWeek, hour, minute);
    
    currentNotificationJob = cron.schedule(cronExpression, async () => {
      console.log('[SCHEDULER] Starting payroll notification...');
      
      try {
        const previewData = await generatePayrollPreview(client);
        await sendNotification(client, previewData, currentNotificationConfig.notificationRoles || []);
        console.log('[SCHEDULER] Payroll notification completed');
      } catch (error) {
        console.error('[ERROR] Scheduled notification failed:', error);
      }
    });
    
    const dayNames = ['Chu nhat', 'Thu hai', 'Thu ba', 'Thu tu', 'Thu nam', 'Thu sau', 'Thu bay'];
    const dayName = dayNames[dayOfWeek];
    
    console.log(`[Payroll Notification] Schedule updated: ${dayName} at ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    console.log(`[Payroll Notification] New cron expression: ${cronExpression}`);
    
  } catch (error) {
    console.error('[ERROR] Failed to update notification schedule:', error);
    throw error;
  }
}

/**
 * Lay config hien tai
 */
export function getCurrentNotificationConfig() {
  return currentNotificationConfig;
}
