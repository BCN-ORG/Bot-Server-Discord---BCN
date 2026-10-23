import cron from 'node-cron';
import { processTemporaryRoleSchedules } from './controller.js';

let currentJob = null;

export async function initTemporaryRoleScheduler(client) {
  if (currentJob) currentJob.stop();

  await processTemporaryRoleSchedules(client);
  currentJob = cron.schedule('* * * * *', async () => {
    try {
      await processTemporaryRoleSchedules(client);
    } catch (error) {
      console.error('[ERROR] Temporary role scheduler failed:', error);
    }
  });

  console.log('[INFO] Temporary role scheduler started (runs every minute)');
}
