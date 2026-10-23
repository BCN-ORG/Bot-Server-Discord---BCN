import cron from 'node-cron';
import { processExpiredReactionRoleClaims } from './controller.js';

let currentJob = null;

export async function initReactionRoleScheduler(client) {
  if (currentJob) currentJob.stop();

  await processExpiredReactionRoleClaims(client);
  currentJob = cron.schedule('* * * * *', async () => {
    try {
      await processExpiredReactionRoleClaims(client);
    } catch (error) {
      console.error('[ERROR] Reaction role expiry scheduler failed:', error);
    }
  });

  console.log('[INFO] Reaction role expiry scheduler started (runs every minute)');
}
