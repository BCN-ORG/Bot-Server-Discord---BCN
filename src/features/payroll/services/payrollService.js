import {
  getAllEligibleRoles,
  getAllCoefficients,
  getAllSimpleRoleSalaries,
  getHistoryByPeriod,
  savePayrollHistory,
  createDebt
} from '../../../database/payroll.js';
import { transferPayment, getBalance } from './apiClient.js';
import { calculateMemberSalary } from './salaryCalculation.js';

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
    const simpleRoleSalaries = await getAllSimpleRoleSalaries();
    if (eligibleRoles.length === 0 && simpleRoleSalaries.length === 0) {
      console.log('[Payroll] No eligible roles configured');
      return {
        total: 0,
        success: 0,
        failed: 0,
        skipped: 0,
        unprocessed: 0,
        duration: Date.now() - startTime
      };
    }

    const eligibleRoleIds = [
      ...new Set([...eligibleRoles, ...simpleRoleSalaries].map(role => role.roleId))
    ];
    const coefficientRoleIds = new Set(eligibleRoles.map(role => role.roleId));
    console.log(`[Payroll] Processing ${eligibleRoleIds.length} payable roles`);

    // 3. Lay day du members trong guild de bao gom ca member offline/chua co trong cache
    const guildMembers = await guild.members.fetch();
    console.log(`[Payroll] Fetched ${guildMembers.size} guild members`);

    const activeEligibleRoleIds = new Set();
    const activeCoefficientRoleIds = new Set();
    for (const roleId of eligibleRoleIds) {
      if (!guild.roles.cache.has(roleId)) {
        console.warn(`[WARN] Role ${roleId} not found in guild`);
        continue;
      }

      activeEligibleRoleIds.add(roleId);
      if (coefficientRoleIds.has(roleId)) {
        activeCoefficientRoleIds.add(roleId);
      }
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

    // 4. Lay he so luong va tao map
    const coefficients = await getAllCoefficients();
    const coefficientMap = new Map();
    for (const coef of coefficients) {
      coefficientMap.set(coef.roleId, coef.coefficient);
    }
    const fixedSalaryMap = new Map(
      simpleRoleSalaries.map(role => [role.roleId, role.amount])
    );

    const period = getCurrentPayrollPeriod();

    // 5. Pre-calculate total coins needed across all eligible members
    let totalNeeded = 0;
    const memberCalculations = [];

    for (const [memberId, member] of uniqueMembers) {
      const userEligibleRoles = getUserEligibleRoles(member, eligibleRoleIds);
      if (userEligibleRoles.length === 0) continue;
      const hasCoefficientEligibility = member.roles.cache.some(role =>
        activeCoefficientRoleIds.has(role.id)
      );
      const salaryInfo = calculateMemberSalary(
        member,
        coefficientMap,
        fixedSalaryMap,
        hasCoefficientEligibility
      );
      if (salaryInfo.totalAmount === 0) continue;
      totalNeeded += salaryInfo.totalAmount;
      memberCalculations.push({ memberId, member, userEligibleRoles, salaryInfo });
    }

    // Check wallet balance BEFORE paying anyone
    const balanceData = await getBalance();
    const currentBalance = balanceData.balance ?? balanceData.data?.balance ?? 0;

    if (currentBalance < totalNeeded && memberCalculations.length > 0) {
      const now = new Date();
      const deficit = totalNeeded - currentBalance;
      const debtId = period; // Dung period (2026-W43) lam debtId

      const unpaidMembers = memberCalculations.map(calc => ({
        userId: calc.memberId,
        username: calc.member.user.username,
        amount: calc.salaryInfo.totalAmount,
        eligibleRoles: calc.salaryInfo.roleDetails,
        paidWithRole: calc.userEligibleRoles[0]
      }));

      await createDebt({
        debtId,
        payrollDate: now,
        period, // Luu them period de tien query
        totalCoinsNeeded: totalNeeded,
        walletBalance: currentBalance,
        deficit,
        memberCount: unpaidMembers.length,
        unpaidMembers,
        status: 'unpaid',
        paidAt: null
      });

      console.log(`[Payroll] Insufficient balance (${currentBalance} < ${totalNeeded}) — created debt ${debtId}`);

      return {
        total: unpaidMembers.length,
        success: 0,
        failed: 0,
        skipped: 0,
        unprocessed: 0,
        debtCreated: true,
        debtId,
        totalNeeded,
        walletBalance: currentBalance,
        deficit,
        duration: Date.now() - startTime
      };
    }

    // 6. Xu ly tung member
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    let hasRequestedTransfer = false;

    for (const member of uniqueMembers.values()) {
      const userId = member.user.id;
      let outcomeCounted = false;

      try {
        // a. Lay cac role ma user co (de check eligible)
        const userEligibleRoles = getUserEligibleRoles(member, eligibleRoleIds);
        
        if (userEligibleRoles.length === 0) {
          console.log(`[Payroll] Skipping ${member.user.tag}: no eligible roles`);
          skippedCount++;
          continue;
        }

        // b. Tinh luong dua tren TAT CA roles (khong chi eligible)
        const hasCoefficientEligibility = member.roles.cache.some(role =>
          activeCoefficientRoleIds.has(role.id)
        );
        const salaryInfo = calculateMemberSalary(
          member,
          coefficientMap,
          fixedSalaryMap,
          hasCoefficientEligibility
        );
        
        // Log chi tiet tung role
        const roleBreakdown = salaryInfo.roleDetails
          .map(role => role.fixedAmount
            ? `${role.roleName}(${role.coefficient} + cố định ${role.fixedAmount})`
            : `${role.roleName}(${role.coefficient})`)
          .join(' + ');
        console.log(
          `[Payroll] ${member.user.tag} (${userId}): ${salaryInfo.payments.length} payment(s) planned`
        );
        console.log(`[Payroll]   Formula: ${roleBreakdown} = ${salaryInfo.rawTotalAmount} coins${salaryInfo.isCapped ? ' (capped)' : ''}`);
        console.log(`[Payroll]   Total amount: ${salaryInfo.totalAmount} coins`);
        
        // Log chi tiet tung payment
        salaryInfo.payments.forEach((payment, idx) => {
          console.log(
            `[Payroll]   Payment ${idx + 1}: ${payment.type === 'coefficient' ? 'Coefficient' : 'Fixed'} ${payment.roleName} via ${payment.roleId} = ${payment.amount} coins`
          );
        });
        
        if (salaryInfo.totalAmount === 0) {
          console.log(`[Payroll] Skipping ${member.user.tag}: total amount is 0`);
          skippedCount++;
          continue;
        }

        // c. Xu ly tung payment rieng biet
        let memberHadSuccessfulPayment = false;
        let memberHadFailure = false;
        
        for (let paymentIndex = 0; paymentIndex < salaryInfo.payments.length; paymentIndex++) {
          const payment = salaryInfo.payments[paymentIndex];
          
          // Set description cho payment
          payment.description = payment.type === 'coefficient'
            ? `Lương hệ số tuần ${period}`
            : `Lương cố định ${payment.roleName} tuần ${period}`;

          if (hasRequestedTransfer) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          // d. Goi API tra luong cho payment nay
          const transferResult = await transferPayment(
            userId,
            payment.roleId,
            payment.amount,
            payment.description
          );
          hasRequestedTransfer = true;

          // e. Luu lich su cho payment nay
          const now = new Date();
          const historyRecord = {
            guildId,
            userId,
            paidAt: now,
            period: transferResult.data?.period || period,
            eligibleRoles: salaryInfo.roleDetails,
            paidWithRole: {
              roleId: payment.roleId,
              roleName: payment.roleName
            },
            amount: payment.amount,
            rawAmount: salaryInfo.rawTotalAmount,
            coefficientAmount: salaryInfo.coefficientTotal,
            fixedSalaryAmount: salaryInfo.fixedSalaryTotal,
            isCapped: salaryInfo.isCapped,
            paymentType: payment.type,
            paymentIndex: paymentIndex + 1,
            totalPaymentsForMember: salaryInfo.payments.length,
            allRolesAtTime: Array.from(member.roles.cache.values()).map(r => ({
              roleId: r.id,
              roleName: r.name
            })),
            status: 'UNKNOWN',
            apiResponse: transferResult.data,
            httpStatus: transferResult.httpStatus
          };

          let stopAfterThisPayment = false;

          // Xac dinh status
          if (transferResult.httpStatus === 200) {
            if (transferResult.data?.status === 'SUCCESS') {
              historyRecord.status = 'SUCCESS';
              historyRecord.duplicate = transferResult.data?.duplicate === true;
              
              if (historyRecord.duplicate) {
                console.log(`[Payroll]   ✓ Payment ${paymentIndex + 1} SUCCESS: ${payment.amount} coins (duplicate: true)`);
              } else {
                console.log(`[Payroll]   ✓ Payment ${paymentIndex + 1} SUCCESS: ${payment.amount} coins (duplicate: false)`);
                memberHadSuccessfulPayment = true;
              }
            } else if (transferResult.data?.status === 'FAILED') {
              historyRecord.status = 'FAILED';
              historyRecord.error = transferResult.data?.error || 'Unknown error';
              console.error(`[ERROR]   ✗ Payment ${paymentIndex + 1} FAILED: ${historyRecord.error}`);
              memberHadFailure = true;
              stopAfterThisPayment = true;
            } else {
              historyRecord.status = 'ERROR';
              historyRecord.error = 'Unexpected successful HTTP response from Payroll API';
              console.error(`[ERROR]   ✗ Payment ${paymentIndex + 1} ERROR: ${historyRecord.error}`);
              memberHadFailure = true;
              stopAfterThisPayment = true;
            }
          } else if (transferResult.httpStatus === 403) {
            historyRecord.status = 'NO_ROLE';
            historyRecord.error = 'User does not have the required role';
            console.warn(`[WARN]   ✗ Payment ${paymentIndex + 1} NO_ROLE: User does not have role ${payment.roleName}`);
            stopAfterThisPayment = true;
          } else if (transferResult.httpStatus === 404) {
            historyRecord.status = 'NOT_IN_SERVER';
            historyRecord.error = 'User not found in server';
            console.warn(`[WARN]   ✗ Payment ${paymentIndex + 1} NOT_IN_SERVER`);
            stopAfterThisPayment = true;
          } else {
            historyRecord.status = transferResult.httpStatus ? 'ERROR' : 'FAILED';
            historyRecord.error = transferResult.data?.message
              || transferResult.data?.error
              || `HTTP ${transferResult.httpStatus ?? transferResult.status}`;
            console.error(`[ERROR]   ✗ Payment ${paymentIndex + 1} ERROR: ${historyRecord.error}`);
            memberHadFailure = true;
            stopAfterThisPayment = true;
          }

          // Luu vao database
          await savePayrollHistory(historyRecord);

          if (stopAfterThisPayment) {
            console.error(`[Payroll] Stopping payments for ${member.user.tag} after payment ${paymentIndex + 1} failure`);
            break; // Break payment loop, continue to next member
          }
        }

        // Count outcome for this member
        if (memberHadSuccessfulPayment) {
          successCount++;
        } else if (memberHadFailure) {
          failedCount++;
        } else {
          // All payments were duplicates
          skippedCount++;
        }
        outcomeCounted = true;

        // If had failure, stop entire payroll
        if (memberHadFailure) {
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
            period,
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
      - skippedCount;
    console.log(`[Payroll] Total: ${uniqueMembers.size}, Success: ${successCount}, Failed: ${failedCount}, Skipped: ${skippedCount}, Unprocessed: ${unprocessedCount}`);

    return {
      total: uniqueMembers.size,
      success: successCount,
      failed: failedCount,
      skipped: skippedCount,
      unprocessed: unprocessedCount,
      duration
    };

  } catch (error) {
    console.error('[ERROR] Payroll process failed:', error);
    throw error;
  }
}
