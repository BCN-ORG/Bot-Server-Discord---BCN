import cron from 'node-cron';
import { getViolationConfig, getUnpaidViolations } from '../../../database/violations.js';
import { EmbedBuilder } from 'discord.js';

let scheduledJobs = [];

/**
 * Initialize violation reminder scheduler
 * @param {Client} client 
 */
export async function initViolationReminderScheduler(client) {
  try {
    const guildId = process.env.GUILD_ID;
    
    if (!guildId) {
      console.error('[Violation Scheduler] GUILD_ID not found in environment');
      return;
    }

    // Load reminder times from config
    const config = await getViolationConfig(guildId);
    
    if (!config || !config.reminderTimes || config.reminderTimes.length === 0) {
      console.log('[Violation Scheduler] No reminder times configured, using default 09:00');
      createCronJob(9, 0, client, guildId);
      scheduledJobs.push({ hour: 9, minute: 0 });
    } else {
      // Create a cron job for each reminder time
      for (const time of config.reminderTimes) {
        createCronJob(time.hour, time.minute, client, guildId);
        scheduledJobs.push(time);
      }
    }

    console.log(`[Violation Scheduler] Initialized with ${scheduledJobs.length} reminder times`);
  } catch (error) {
    console.error('[Violation Scheduler] Error initializing:', error);
  }
}

/**
 * Create cron job for specific time
 * @param {number} hour 
 * @param {number} minute 
 * @param {Client} client 
 * @param {string} guildId 
 */
function createCronJob(hour, minute, client, guildId) {
  // Cron format: minute hour * * *
  const cronExpression = `${minute} ${hour} * * *`;
  
  cron.schedule(cronExpression, async () => {
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    console.log(`[Violation Scheduler] Running violation reminders at ${timeStr}`);
    
    try {
      await sendRemindersToUsers(client, guildId);
    } catch (error) {
      console.error('[Violation Scheduler] Error sending reminders:', error);
    }
  });

  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  console.log(`[Violation Scheduler] Scheduled reminder at ${timeStr} (cron: ${cronExpression})`);
}

/**
 * Send reminders to all users with unpaid violations
 * @param {Client} client 
 * @param {string} guildId 
 */
async function sendRemindersToUsers(client, guildId) {
  try {
    // Get all unpaid violations
    const unpaidViolations = await getUnpaidViolations(guildId);

    if (unpaidViolations.length === 0) {
      console.log('[Violation Scheduler] No unpaid violations found');
      return;
    }

    // Group violations by userId
    const violationsByUser = {};
    for (const violation of unpaidViolations) {
      if (!violationsByUser[violation.userId]) {
        violationsByUser[violation.userId] = [];
      }
      violationsByUser[violation.userId].push(violation);
    }

    console.log(`[Violation Scheduler] Sending reminders to ${Object.keys(violationsByUser).length} users`);

    // Send DM to each user
    for (const [userId, violations] of Object.entries(violationsByUser)) {
      try {
        const user = await client.users.fetch(userId);
        
        // Calculate total amount
        const totalAmount = violations.reduce((sum, v) => sum + v.amount, 0);

        // Build embed
        const embed = new EmbedBuilder()
          .setColor('#ff9900')
          .setTitle('⚠️ Nhắc nhở biên bản phạt')
          .setDescription(
            `Bạn có **${violations.length}** biên bản phạt chưa thanh toán.\n\n` +
            `💰 **Tổng số tiền:** ${totalAmount} coins\n\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n`
          )
          .setTimestamp();

        // Add each violation
        violations.forEach((v, index) => {
          embed.addFields({
            name: `${index + 1}. ${v.violationId}`,
            value: `• **Lý do:** ${v.reason}\n• **Số tiền:** ${v.amount} coins\n• **Ngày tạo:** ${v.createdAt.toLocaleDateString('vi-VN')}`,
            inline: false
          });
        });

        embed.setFooter({ text: 'Sử dụng /violation-confirm-payment để thanh toán' });

        await user.send({ embeds: [embed] });
        console.log(`[Violation Scheduler] Sent reminder to ${user.tag}`);

      } catch (error) {
        console.log(`[Violation Scheduler] Could not send reminder to user ${userId} (DM disabled or user not found)`);
      }
    }

    console.log('[Violation Scheduler] Reminder run completed');

  } catch (error) {
    console.error('[Violation Scheduler] Error in sendRemindersToUsers:', error);
    throw error;
  }
}

/**
 * Reload scheduler (call after updating reminder times)
 * @param {Client} client 
 */
export async function reloadViolationReminderScheduler(client) {
  console.log('[Violation Scheduler] Reloading scheduler...');
  
  // Clear existing jobs
  scheduledJobs = [];
  
  // Reinitialize
  await initViolationReminderScheduler(client);
}
