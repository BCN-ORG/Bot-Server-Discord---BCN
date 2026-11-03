import cron from 'node-cron';
import { processExpiredReactionRoleClaims, processScheduledReactionRoleRevoke } from './controller.js';

let expiryJob = null;
let scheduleJob = null;

export async function initReactionRoleScheduler(client) {
  if (expiryJob) expiryJob.stop();
  if (scheduleJob) scheduleJob.stop();

  const timezone = 'Asia/Ho_Chi_Minh';

  // Job 1: Check duration-based expiry every minute
  await processExpiredReactionRoleClaims(client);
  expiryJob = cron.schedule('* * * * *', async () => {
    try {
      await processExpiredReactionRoleClaims(client);
    } catch (error) {
      console.error('[ERROR] Reaction role expiry scheduler failed:', error);
    }
  }, {
    scheduled: true,
    timezone: timezone
  });

  // Job 2: Check scheduled revoke every minute
  await processScheduledReactionRoleRevoke(client);
  scheduleJob = cron.schedule('* * * * *', async () => {
    try {
      await processScheduledReactionRoleRevoke(client);
    } catch (error) {
      console.error('[ERROR] Reaction role scheduled revoke failed:', error);
    }
  }, {
    scheduled: true,
    timezone: timezone
  });

  console.log(`[INFO] Reaction role schedulers started (expiry + scheduled revoke) - Timezone: ${timezone}`);
}
