import {
  getAllEligibleRoles,
  getAllCoefficients,
  getHistoryByPeriod,
  savePayrollHistory
} from '../../../database/payroll.js';
import { transferPayment } from './apiClient.js';

function getCurrentPayrollPeriod(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Could not determine current payroll period');
  }

  const localDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const dayOfWeek = localDate.getUTCDay() || 7;
  localDate.setUTCDate(localDate.getUTCDate() + 4 - dayOfWeek);

  const weekYear = localDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const weekNumber = Math.ceil(((localDate - yearStart) / 86400000 + 1) / 7);

  return `${weekYear}-W${String(weekNumber).padStart(2, '0')}`;
}

/**
 * Lay cac role duoc tra luong ma user co
 * @param {GuildMember} member 
 * @param {Array<string>} eligibleRoleIds 
 */
function getUserEligibleRoles(member, eligibleRoleIds) {
  const userRoles = [];
  
  for (const eligibleRoleId of eligibleRoleIds) {
    if (member.roles.cache.has(eligibleRoleId)) {
      const role = member.guild.roles.cache.get(eligibleRoleId);
      if (role) {
        userRoles.push({
          roleId: role.id,
          roleName: role.name
        });
      }
    }
  }
  
  return userRoles;
}

/**
 * Tinh tong luong cua user dua tren tat ca role dang co
 * @param {Array<Object>} memberRoles 
 * @param {Array<Object>} coefficients 
 */
function calculateUserSalary(memberRoles, coefficients) {
  // Tao map coefficients de lookup nhanh
  const coefficientMap = new Map();
  for (const coef of coefficients) {
    coefficientMap.set(coef.roleId, coef.coefficient);
  }
  
  // Tinh tong coefficient
  let total = 0;
  const roleDetails = [];
  
  for (const role of memberRoles) {
    const coefficient = coefficientMap.get(role.roleId) ?? 1;
    total += coefficient;
    roleDetails.push({
      ...role,
      coefficient
    });
  }
  
  // Cap at 100 (gioi han cua API)
  const cappedAmount = Math.min(total, 100);
  
  return {
    amount: cappedAmount,
    rawAmount: total,
    isCapped: total > 100,
    roleDetails
  };
}

/**
 * Xu ly tra luong hang tuan
 * @param {Client} client 
 */
export async function processWeeklyPayroll(client) {
  const guildId = process.env.GUILD_ID;
  const startTime = Date.now();
  
  console.log('[Payroll] Starting weekly payroll process...');
  
  try {
    // 1. Lay guild
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      throw new Error(`Guild ${guildId} not found`);
    }

    // 2. Lay danh sach role duoc tra luong
    const eligibleRoles = await getAllEligibleRoles();
    if (eligibleRoles.length === 0) {
      console.log('[Payroll] No eligible roles configured');
      return {
        total: 0,
        success: 0,
        failed: 0,
        skipped: 0,
        alreadyPaid: 0,
        unprocessed: 0,
        duration: Date.now() - startTime
      };
    }

    const eligibleRoleIds = eligibleRoles.map(r => r.roleId);
    console.log(`[Payroll] Processing ${eligibleRoles.length} eligible roles`);

    // 3. Lay day du members trong guild de bao gom ca member offline/chua co trong cache
    const guildMembers = await guild.members.fetch();
    console.log(`[Payroll] Fetched ${guildMembers.size} guild members`);

    const activeEligibleRoleIds = new Set();
    for (const roleId of eligibleRoleIds) {
      if (!guild.roles.cache.has(roleId)) {
        console.warn(`[WARN] Role ${roleId} not found in guild`);
        continue;
      }

      activeEligibleRoleIds.add(roleId);
    }

    // Loc members co it nhat mot role duoc cau hinh va deduplicate theo Discord user ID
    const uniqueMembers = new Map();

    for (const member of guildMembers.values()) {
      if (member.user.bot) continue;

      const hasEligibleRole = member.roles.cache.some(role => activeEligibleRoleIds.has(role.id));
      if (hasEligibleRole) {
        uniqueMembers.set(member.user.id, member);
      }
    }

    console.log(`[Payroll] Found ${uniqueMembers.size} unique members to process`);

    // 4. Lay he so luong
    const coefficients = await getAllCoefficients();

    const period = getCurrentPayrollPeriod();
    const periodHistory = await getHistoryByPeriod(guildId, period);
    const alreadyPaidUsers = new Set(
      periodHistory
        .filter(record => record.status === 'SUCCESS')
        .map(record => record.userId)
    );

    console.log(`[Payroll] ${alreadyPaidUsers.size} member(s) already paid for ${period}`);

    // 5. Xu ly tung member
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    let alreadyPaidCount = 0;
    let hasRequestedTransfer = false;

    for (const member of uniqueMembers.values()) {
      const userId = member.user.id;
      let outcomeCounted = false;

      try {
        if (alreadyPaidUsers.has(userId)) {
          console.log(`[Payroll] ${member.user.tag} (${userId}): Already paid for ${period}`);
          alreadyPaidCount++;
          continue;
        }

        // a. Lay cac role ma user co
        const userEligibleRoles = getUserEligibleRoles(member, eligibleRoleIds);
        
        if (userEligibleRoles.length === 0) {
          console.log(`[Payroll] Skipping ${member.user.tag}: no eligible roles`);
          skippedCount++;
          continue;
        }

        const memberRoles = [...member.roles.cache.values()].map(role => ({
          roleId: role.id,
          roleName: role.name
        }));
        console.log(
          `[Payroll] Roles for ${member.user.tag} (${userId}): ${JSON.stringify(memberRoles.map(role => role.roleId))}`
        );

        // b. Tinh luong
        const salaryInfo = calculateUserSalary(memberRoles, coefficients);
        console.log(
          `[Payroll] Salary calculation for ${member.user.tag} (${userId}): ${JSON.stringify(salaryInfo.roleDetails)}; total=${salaryInfo.rawAmount}, amount=${salaryInfo.amount}`
        );
        
        if (salaryInfo.amount === 0) {
          console.log(`[Payroll] Skipping ${member.user.tag}: amount is 0`);
          skippedCount++;
          continue;
        }

        // c. Chon role dau tien de tra
        const paidWithRole = userEligibleRoles[0];

        if (hasRequestedTransfer) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // d. Goi API tra luong
        const transferResult = await transferPayment(
          userId,
          paidWithRole.roleId,
          salaryInfo.amount,
          `Lương + ${new Date().toLocaleDateString('vi-VN')}`
        );
        hasRequestedTransfer = true;

        // e. Luu lich su
        const now = new Date();
        const historyRecord = {
          guildId,
          userId,
          paidAt: now,
          period: transferResult.data?.period || period,
          eligibleRoles: salaryInfo.roleDetails,
          paidWithRole: {
            roleId: paidWithRole.roleId,
            roleName: paidWithRole.roleName
          },
          amount: salaryInfo.amount,
          rawAmount: salaryInfo.rawAmount,
          isCapped: salaryInfo.isCapped,
          allRolesAtTime: Array.from(member.roles.cache.values()).map(r => ({
            roleId: r.id,
            roleName: r.name
          })),
          status: 'UNKNOWN',
          apiResponse: transferResult.data,
          httpStatus: transferResult.httpStatus
        };

        let stopAfterThisMember = false;

        // Xac dinh status
        if (transferResult.httpStatus === 200) {
          if (transferResult.data?.status === 'SUCCESS') {
            historyRecord.status = 'SUCCESS';
            historyRecord.duplicate = transferResult.data?.duplicate === true;
            
            if (historyRecord.duplicate) {
              console.log(`[Payroll] ${member.user.tag}: Already paid this period (duplicate)`);
              alreadyPaidCount++;
              alreadyPaidUsers.add(userId);
            } else {
              console.log(`[Payroll] ${member.user.tag} (${userId}): Paid ${salaryInfo.amount} coins`);
              successCount++;
              alreadyPaidUsers.add(userId);
            }
          } else if (transferResult.data?.status === 'FAILED') {
            historyRecord.status = 'FAILED';
            historyRecord.error = transferResult.data?.error || 'Unknown error';
            console.error(`[ERROR] ${member.user.tag}: Payment failed - ${historyRecord.error}`);
            failedCount++;
            stopAfterThisMember = true;
          } else {
            historyRecord.status = 'ERROR';
            historyRecord.error = 'Unexpected successful HTTP response from Payroll API';
            console.error(`[ERROR] ${member.user.tag}: ${historyRecord.error}`);
            failedCount++;
            stopAfterThisMember = true;
          }
        } else if (transferResult.httpStatus === 403) {
          historyRecord.status = 'NO_ROLE';
          historyRecord.error = 'User does not have the required role';
          console.warn(`[WARN] ${member.user.tag} (${userId}): No role ${paidWithRole.roleName}; skipping member`);
          skippedCount++;
        } else if (transferResult.httpStatus === 404) {
          historyRecord.status = 'NOT_IN_SERVER';
          historyRecord.error = 'User not found in server';
          console.warn(`[WARN] ${member.user.tag} (${userId}): Not in server; skipping member`);
          skippedCount++;
        } else {
          historyRecord.status = transferResult.httpStatus ? 'ERROR' : 'FAILED';
          historyRecord.error = transferResult.data?.message
            || transferResult.data?.error
            || `HTTP ${transferResult.httpStatus ?? transferResult.status}`;
          console.error(`[ERROR] ${member.user.tag}: ${historyRecord.error}`);
          failedCount++;
          stopAfterThisMember = true;
        }

        outcomeCounted = true;

        // Luu vao database
        await savePayrollHistory(historyRecord);

        if (stopAfterThisMember) {
          console.error('[Payroll] Stopping payroll after the first unsuccessful payment');
          break;
        }
      } catch (error) {
        console.error(`[ERROR] Failed to process member ${userId}:`, error);
        if (!outcomeCounted) {
          failedCount++;
        }
        
        // Luu loi vao history
        try {
          await savePayrollHistory({
            guildId,
            userId,
            paidAt: new Date(),
            status: 'ERROR',
            error: error.message,
            amount: 0
          });
        } catch (saveError) {
          console.error('[ERROR] Failed to save error history:', saveError);
        }

        console.error('[Payroll] Stopping payroll after the first unsuccessful payment');
        break;
      }
    }

    const duration = Date.now() - startTime;
    
    console.log(`[Payroll] Completed in ${duration}ms`);
    const unprocessedCount = uniqueMembers.size
      - successCount
      - failedCount
      - skippedCount
      - alreadyPaidCount;
    console.log(`[Payroll] Total: ${uniqueMembers.size}, Success: ${successCount}, Failed: ${failedCount}, Skipped: ${skippedCount}, Already paid: ${alreadyPaidCount}, Unprocessed: ${unprocessedCount}`);

    return {
      total: uniqueMembers.size,
      success: successCount,
      failed: failedCount,
      skipped: skippedCount,
      alreadyPaid: alreadyPaidCount,
      unprocessed: unprocessedCount,
      duration
    };

  } catch (error) {
    console.error('[ERROR] Payroll process failed:', error);
    throw error;
  }
}
