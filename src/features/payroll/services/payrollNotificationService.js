/**
 * Payroll Notification Service
 * Tinh toan preview truoc khi tra luong va kiem tra so du
 */

import {
  getAllEligibleRoles,
  getAllCoefficients,
  getAllSimpleRoleSalaries,
  getSalaryConfig
} from '../../../database/payroll.js';
import { getBalance } from './apiClient.js';
import { calculateMemberSalary } from './salaryCalculation.js';

/**
 * Tinh ngay tra luong tiep theo dua tren config
 * @param {Object} config - Cau hinh tra luong {dayOfWeek, hour, minute, timezone}
 * @returns {Date}
 */
function calculateNextPayrollDate(config) {
  const now = new Date();
  
  // Chuyen sang timezone Viet Nam
  const nowVN = new Date(now.toLocaleString('en-US', { timeZone: config.timezone || 'Asia/Ho_Chi_Minh' }));
  
  const targetDay = config.dayOfWeek; // 0 = Sunday, 1 = Monday, ...
  const targetHour = config.hour || 0;
  const targetMinute = config.minute || 0;
  
  // Tinh ngay tiep theo
  const currentDay = nowVN.getDay();
  let daysUntilTarget = targetDay - currentDay;
  
  // Neu da qua ngay do trong tuan, chuyen sang tuan sau
  if (daysUntilTarget < 0 || (daysUntilTarget === 0 && (nowVN.getHours() > targetHour || (nowVN.getHours() === targetHour && nowVN.getMinutes() >= targetMinute)))) {
    daysUntilTarget += 7;
  }
  
  const nextDate = new Date(nowVN);
  nextDate.setDate(nextDate.getDate() + daysUntilTarget);
  nextDate.setHours(targetHour, targetMinute, 0, 0);
  
  return nextDate;
}

/**
 * Tao preview bao cao tra luong
 * @param {Client} client 
 * @returns {Object} Preview data
 */
export async function generatePayrollPreview(client) {
  try {
    // Lazy read env
    const guildId = process.env.GUILD_ID;
    if (!guildId) {
      throw new Error('[Payroll Notification] GUILD_ID is required in .env');
    }
    
    console.log('[Payroll Notification] Generating payroll preview...');
    
    // 1. Lay guild
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      throw new Error(`Guild ${guildId} not found`);
    }
    
    // 2. Lay danh sach role duoc tra luong
    const eligibleRoles = await getAllEligibleRoles();
    const simpleRoleSalaries = await getAllSimpleRoleSalaries();
    if (eligibleRoles.length === 0 && simpleRoleSalaries.length === 0) {
      console.log('[Payroll Notification] No eligible roles configured');
      return {
        nextPayrollDate: null,
        totalCoinsNeeded: 0,
        fixedSalaryCoins: 0,
        currentBalance: 0,
        deficit: 0,
        memberCount: 0,
        breakdown: []
      };
    }
    
    const eligibleRoleIds = [
      ...new Set([...eligibleRoles, ...simpleRoleSalaries].map(role => role.roleId))
    ];
    const coefficientRoleIds = new Set(eligibleRoles.map(role => role.roleId));
    console.log(`[Payroll Notification] Processing ${eligibleRoleIds.length} payable roles`);
    
    // 3. Lay day du members trong guild
    const guildMembers = await guild.members.fetch();
    console.log(`[Payroll Notification] Fetched ${guildMembers.size} guild members`);
    
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
    
    // 4. Loc va deduplicate members theo Discord user ID
    const uniqueMembers = new Map();
    
    for (const member of guildMembers.values()) {
      if (member.user.bot) continue;
      
      const hasEligibleRole = member.roles.cache.some(role => activeEligibleRoleIds.has(role.id));
      if (hasEligibleRole) {
        uniqueMembers.set(member.user.id, member);
      }
    }
    
    console.log(`[Payroll Notification] Found ${uniqueMembers.size} unique members to calculate`);
    
    // 5. Lay he so luong
    const coefficients = await getAllCoefficients();
    const coefficientMap = new Map();
    for (const coef of coefficients) {
      coefficientMap.set(coef.roleId, coef.coefficient);
    }
    const fixedSalaryMap = new Map(
      simpleRoleSalaries.map(role => [role.roleId, role.amount])
    );
    
    // 6. Tinh toan cho tung member
    const breakdown = [];
    let totalCoinsNeeded = 0;
    let fixedSalaryCoins = 0;
    
    for (const member of uniqueMembers.values()) {
      const userId = member.user.id;
      
      const payableRoles = member.roles.cache.some(role => activeEligibleRoleIds.has(role.id));
      if (!payableRoles) continue;

      const hasCoefficientEligibility = member.roles.cache.some(role =>
        activeCoefficientRoleIds.has(role.id)
      );
      const salary = calculateMemberSalary(
        member,
        coefficientMap,
        fixedSalaryMap,
        hasCoefficientEligibility
      );
      if (salary.amount === 0) continue;
      
      breakdown.push({
        userId,
        username: member.user.tag,
        amount: salary.amount,
        rawAmount: salary.rawAmount,
        isCapped: salary.isCapped,
        fixedSalaryAmount: salary.fixedSalaryIncluded,
        roles: salary.roleDetails
      });
      
      totalCoinsNeeded += salary.amount;
      fixedSalaryCoins += salary.fixedSalaryIncluded;
    }
    
    console.log(`[Payroll Notification] Total coins needed: ${totalCoinsNeeded}`);
    
    // 7. Lay so du hien tai tu API
    let currentBalance = 0;
    try {
      const balanceData = await getBalance();
      currentBalance = balanceData.balance || 0;
      console.log(`[Payroll Notification] Current balance: ${currentBalance}`);
    } catch (error) {
      console.error('[ERROR] Failed to get balance:', error);
      // Tiep tuc voi balance = 0
    }
    
    // 8. Tinh deficit
    const deficit = Math.max(0, totalCoinsNeeded - currentBalance);
    
    // 9. Lay ngay tra luong tiep theo
    const salaryConfig = await getSalaryConfig();
    const nextPayrollDate = calculateNextPayrollDate(salaryConfig);
    
    console.log(`[Payroll Notification] Preview generated: ${uniqueMembers.size} members, ${totalCoinsNeeded} coins needed, ${currentBalance} balance, ${deficit} deficit`);
    
    return {
      nextPayrollDate,
      totalCoinsNeeded,
      fixedSalaryCoins,
      currentBalance,
      deficit,
      memberCount: uniqueMembers.size,
      breakdown
    };
    
  } catch (error) {
    console.error('[ERROR] Failed to generate payroll preview:', error);
    throw error;
  }
}
