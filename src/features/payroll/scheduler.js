import cron from 'node-cron';
import { getSalaryConfig, getAllEligibleRoles } from '../../database/payroll.js';
import { processWeeklyPayroll } from './services/payrollService.js';

let currentJob = null;
let currentConfig = null;

/**
 * Tao cron expression tu config
 * @param {number} dayOfWeek - 0=Sunday, 1=Monday, ..., 6=Saturday
 * @param {number} hour - 0-23
 */
function createCronExpression(dayOfWeek, hour) {
  // Cron format: 'minute hour dayOfMonth month dayOfWeek'
  // dayOfWeek: 0=Sunday trong cron
  return `0 ${hour} * * ${dayOfWeek}`;
}

/**
 * Khoi tao payroll scheduler
 * @param {Client} client 
 */
export async function initPayrollScheduler(client) {
  try {
    console.log('[Payroll] Initializing payroll scheduler...');
    
    // Lay config tu database
    currentConfig = await getSalaryConfig();
    
    const cronExpression = createCronExpression(currentConfig.dayOfWeek, currentConfig.hour);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[currentConfig.dayOfWeek];
    
    console.log(`[Payroll] Schedule: ${dayName} at ${String(currentConfig.hour).padStart(2, '0')}:00 (${currentConfig.timezone})`);
    console.log(`[Payroll] Cron expression: ${cronExpression}`);
    
    // Kiem tra xem da co role nao duoc cau hinh chua
    const eligibleRoles = await getAllEligibleRoles();
    if (eligibleRoles.length === 0) {
      console.warn('[WARN] No eligible roles configured yet. Payroll will run on schedule but skip processing until roles are added via /salary-roles add');
    } else {
      console.log(`[Payroll] ${eligibleRoles.length} eligible role(s) configured`);
    }
    
    // Tao cron job
    currentJob = cron.schedule(cronExpression, async () => {
      console.log('[SCHEDULER] Starting weekly payroll...');
      
      try {
        const result = await processWeeklyPayroll(client);
        console.log(`[SCHEDULER] Payroll completed: ${result.success} success, ${result.failed} failed, ${result.skipped} skipped, ${result.alreadyPaid} already paid, ${result.unprocessed} unprocessed`);
      } catch (error) {
        console.error('[ERROR] Scheduled payroll failed:', error);
      }
    });

    console.log('[INFO] Payroll scheduler initialized');
    
  } catch (error) {
    console.error('[ERROR] Failed to initialize payroll scheduler:', error);
    throw error;
  }
}

/**
 * Cap nhat schedule va restart cron job
 * @param {number} dayOfWeek 
 * @param {number} hour 
 * @param {Client} client 
 */
export async function updateSchedule(dayOfWeek, hour, client) {
  try {
    console.log(`[Payroll] Updating schedule to day=${dayOfWeek}, hour=${hour}`);
    
    // Dung job cu
    if (currentJob) {
      currentJob.stop();
      console.log('[Payroll] Stopped current cron job');
    }
    
    // Cap nhat config
    currentConfig = { dayOfWeek, hour, timezone: 'Asia/Ho_Chi_Minh' };
    
    // Tao job moi
    const cronExpression = createCronExpression(dayOfWeek, hour);
    
    currentJob = cron.schedule(cronExpression, async () => {
      console.log('[SCHEDULER] Starting weekly payroll...');
      
      try {
        const result = await processWeeklyPayroll(client);
        console.log(`[SCHEDULER] Payroll completed: ${result.success} success, ${result.failed} failed, ${result.skipped} skipped, ${result.alreadyPaid} already paid, ${result.unprocessed} unprocessed`);
      } catch (error) {
        console.error('[ERROR] Scheduled payroll failed:', error);
      }
    });
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[dayOfWeek];
    
    console.log(`[Payroll] Schedule updated: ${dayName} at ${String(hour).padStart(2, '0')}:00`);
    console.log(`[Payroll] New cron expression: ${cronExpression}`);
    
  } catch (error) {
    console.error('[ERROR] Failed to update schedule:', error);
    throw error;
  }
}

/**
 * Lay config hien tai
 */
export function getCurrentConfig() {
  return currentConfig;
}
