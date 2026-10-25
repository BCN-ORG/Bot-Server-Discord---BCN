import cron from 'node-cron';
import { getFineConfig } from '../../../database/fines.js';
import { sendDailyReminders } from '../services/fineService.js';

/**
 * Initialize fine reminder scheduler
 * Checks every minute and runs reminders based on configured times
 */
export async function initFineReminderScheduler(client) {
  console.log('[Fine Reminder Scheduler] Initializing...');

  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      // Get all guilds and check their reminder times
      const guilds = client.guilds.cache;

      for (const [guildId, guild] of guilds) {
        try {
          const config = await getFineConfig(guildId);

          if (config.reminderTimes.length === 0) {
            continue;
          }

          // Check if current time matches any reminder time
          const shouldRemind = config.reminderTimes.some(
            time => time.hour === currentHour && time.minute === currentMinute
          );

          if (shouldRemind) {
            console.log(`[Fine Reminder Scheduler] Running reminders for guild ${guild.name} at ${currentHour}:${currentMinute}`);
            await sendDailyReminders(client, guildId);
          }
        } catch (error) {
          console.error(`[Fine Reminder Scheduler] Error processing guild ${guildId}:`, error);
        }
      }
    } catch (error) {
      console.error('[Fine Reminder Scheduler] Error:', error);
    }
  });

  console.log('[Fine Reminder Scheduler] Started successfully');
}
