import { getSetting, setSetting, SettingKey } from '../../database/settings.js';

/**
 * Controller de bat/tat scheduler
 */

/**
 * Bat scheduler
 */
export async function enableScheduler() {
  await setSetting(SettingKey.SCHEDULER_ENABLED, true);
  console.log('[INFO] Scheduler enabled');
}

/**
 * Tat scheduler
 */
export async function disableScheduler() {
  await setSetting(SettingKey.SCHEDULER_ENABLED, false);
  console.log('[INFO] Scheduler disabled');
}

/**
 * Kiem tra scheduler co dang bat khong
 * @returns {Promise<boolean>}
 */
export async function isSchedulerEnabled() {
  // Mac dinh la bat (true) neu chua co setting trong database
  const enabled = await getSetting(SettingKey.SCHEDULER_ENABLED, true);
  return enabled;
}
