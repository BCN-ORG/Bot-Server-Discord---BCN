import cron from 'node-cron';
import { processExpiredCoinRandomEvents } from './command.js';

let currentJob = null;

export async function initCoinRandomScheduler(client) {
  if (currentJob) currentJob.stop();

  await processExpiredCoinRandomEvents(client);
  currentJob = cron.schedule('* * * * *', async () => {
    try {
      await processExpiredCoinRandomEvents(client);
    } catch (error) {
      console.error('[ERROR] Coin random scheduler failed:', error);
    }
  });

  console.log('[INFO] Coin random scheduler started (runs every minute)');
}
