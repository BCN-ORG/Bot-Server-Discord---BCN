# Implementation Plan: Fix Payroll Salary Calculation Logic

## Overview
Fix the payroll system to make MULTIPLE separate API calls instead of ONE combined payment. Each payment type (coefficient-based and fixed salary per role) must be a separate `/transfer` API call so users receive multiple notifications.

## Current (Wrong) Behavior
- Calculates one total: coefficient + all fixed salaries combined
- Calls `/transfer` API once with first eligible role
- User receives one notification

## Required (Correct) Behavior
User with roles a,b,c,d (coefficients 1,2,3,4), where c has fixed salary 20, d has fixed salary 30, and a,b are eligible coefficient roles, receives 3 payments:
1. Coefficient: a×1 + b×2 + c×3 + d×4 = 10 coins via roleId=a
2. Fixed salary for role c: 20 coins via roleId=c  
3. Fixed salary for role d: 30 coins via roleId=d

---

# Implementation Steps

- [ ] 1. **Refactor `calculateMemberSalary()` to return payments array**

      Change return structure from single amount to array of payments. Each payment has: `{type: 'coefficient'|'fixed', roleId, roleName, amount, description}`.
      
      Logic:
      - If `hasCoefficientEligibility` is true: create ONE coefficient payment with sum of (all role coefficients), roleId from first eligible coefficient role
      - For each role with fixed salary (from `fixedSalaryMap`): create separate fixed payment with that roleId and amount
      - Each payment amount capped at 100 (API limit per transfer)
      - Return: `{payments: [...], totalAmount, rawTotalAmount, isCapped, roleDetails}`
      
      Files: `src/features/payroll/services/salaryCalculation.js`
      
      Verify: Run `node -e "import('./src/features/payroll/services/salaryCalculation.js').then(m => console.log(m))"` to check module loads without syntax errors.

- [ ] 2. **Update `processWeeklyPayroll()` to loop through payments array**

      In the member processing loop (line ~200), replace single `transferPayment()` call with loop over `salaryInfo.payments`:
      
      ```javascript
      for (const payment of salaryInfo.payments) {
        if (hasRequestedTransfer) await new Promise(r => setTimeout(r, 1000));
        const transferResult = await transferPayment(userId, payment.roleId, payment.amount, payment.description);
        hasRequestedTransfer = true;
        // save history for THIS payment
        const historyRecord = { ...existing fields..., paymentType: payment.type, paidWithRole: {roleId: payment.roleId, roleName: payment.roleName} };
        await savePayrollHistory(historyRecord);
        // if failed, break payment loop for this member
        if (transferResult fails) break;
      }
      ```
      
      Key changes:
      - Remove `alreadyPaidUsers` pre-filter (rely on API duplicate detection)
      - Pre-calculate total by summing all members' `salaryInfo.totalAmount`
      - Loop through payments array per member
      - Save separate history record per payment
      - On payment failure: break inner loop (stop payments for current member), continue outer loop (process next member)
      
      Files: `src/features/payroll/services/payrollService.js`
      
      Verify: Run `npm start` and check console logs show no syntax errors during module load.

- [ ] 3. **Add payment tracking fields to history records**

      Add these fields when creating `historyRecord`:
      - `paymentType`: 'coefficient' or 'fixed'
      - `paymentIndex`: 1, 2, 3... (which payment number for this member)
      - `totalPaymentsForMember`: total count of payments for this member
      
      MongoDB is schemaless so no migration needed.
      
      Files: `src/features/payroll/services/payrollService.js` (history record creation section)
      
      Verify: After test run, query MongoDB: `db.salary_history.findOne()` and confirm new fields exist.

- [ ] 4. **Update payment descriptions to indicate type**

      Generate description based on payment type:
      - Coefficient: `"Lương hệ số tuần {period}"`
      - Fixed: `"Lương cố định {roleName} tuần {period}"`
      
      Where period comes from `getCurrentPayrollPeriod()` (e.g., "2026-W42").
      
      Files: `src/features/payroll/services/payrollService.js`
      
      Verify: Check console logs show correct descriptions when calling transferPayment.

- [ ] 5. **Enhance logging to show payment breakdown**

      Before processing payments for a member, log:
      ```
      [Payroll] {username} ({userId}): {N} payments planned
      [Payroll]   Payment 1: Coefficient via {roleId} = {amount} coins
      [Payroll]   Payment 2: Fixed {roleName} via {roleId} = {amount} coins
      ```
      
      After each payment, log result:
      ```
      [Payroll]   ✓ Payment 1 SUCCESS: {amount} coins (duplicate: {true|false})
      ```
      
      Files: `src/features/payroll/services/payrollService.js`
      
      Verify: Check console output during test run shows payment-by-payment breakdown.

- [ ] 6. **Create test script to verify calculation logic**

      Create `.agents/tasks/test-salary-calc.js` that:
      - Mocks a Discord member with roles a,b,c,d
      - Sets up coefficientMap with values 1,2,3,4
      - Sets up fixedSalaryMap with c=20, d=30
      - Calls `calculateMemberSalary()` with `hasCoefficientEligibility=true`
      - Asserts payments array length is 3
      - Asserts payment 1 is coefficient type, amount 10
      - Asserts payments 2,3 are fixed type, amounts 20,30
      - Asserts totalAmount is 60
      
      Files: `.agents/tasks/test-salary-calc.js` (new file)
      
      Verify: Run `node .agents/tasks/test-salary-calc.js` and confirm "All tests passed" output.

- [ ] 7. **Update total calculation in pre-check phase**

      In `processWeeklyPayroll()`, before wallet balance check (line ~150), change:
      ```javascript
      // OLD: totalNeeded += salaryInfo.amount;
      // NEW: totalNeeded += salaryInfo.totalAmount;
      ```
      
      Also update `memberCalculations` to store full `salaryInfo` not just amount.
      
      Files: `src/features/payroll/services/payrollService.js`
      
      Verify: Add console log showing totalNeeded calculation and verify it sums all payments correctly.

- [ ] 8. **Handle capping per payment**

      In `calculateMemberSalary()`, cap each payment individually:
      - Coefficient payment: cap to 100, log warning if capped
      - Fixed payment: cap to 100, log warning if capped
      
      Add warning log: `[WARN] Payment capped: {type} for {roleName} from {original} to 100 coins`
      
      Files: `src/features/payroll/services/salaryCalculation.js`
      
      Verify: Create test case with coefficient sum > 100 and verify it caps to 100 with warning.

- [ ] 9. **Remove `alreadyPaidUsers` pre-filter logic**

      Delete these lines from `processWeeklyPayroll()`:
      - Line ~143: `const periodHistory = await getHistoryByPeriod(...)`
      - Line ~144-147: `const alreadyPaidUsers = new Set(...)`  
      - Line ~149: console log about already paid
      - Line ~208: `if (alreadyPaidUsers.has(userId))` check and early continue
      
      Rely on API's `duplicate: true` response instead.
      
      Files: `src/features/payroll/services/payrollService.js`
      
      Verify: Search code for "alreadyPaidUsers" and confirm no references remain.

- [ ] 10. **Test end-to-end with mock Discord server**

      Final verification:
      1. Set up test Discord server with test roles
      2. Configure salary coefficients and fixed salaries in MongoDB
      3. Run `/salary-payout-now` command
      4. Check console logs show multiple payments per member
      5. Check MongoDB `salary_history` has multiple records per member
      6. Verify each record has correct `paymentType`, `roleId`, `amount`
      7. Run command again same period, verify duplicate detection works
      
      Files: All modified files
      
      Verify: Manual testing in Discord, check logs and database records match expected behavior.

---

## Verification Summary

**Build command:** None (Node.js interprets directly)

**Test commands:**
- `node .agents/tasks/test-salary-calc.js` - unit test calculation logic
- `npm start` - start bot for integration testing  
- Discord: `/salary-payout-now` - trigger payroll manually

**Expected outcomes:**
- Test script passes all assertions
- Console shows payment-by-payment breakdown
- Each member receives multiple payments (one per payment type)
- MongoDB has separate history records per payment
- Duplicate detection works per (userId, roleId, period)

## Risk Mitigation

- **Backup:** Export `salary_history` collection before first production run
- **Rollback:** Keep previous version of modified files in `.agents/tasks/backup/`
- **Testing:** Test on test server before production
- **Monitoring:** Watch console logs during first real payroll run
- **Partial failure:** If payment 2 fails, payment 1 already succeeded (no rollback possible at API level)
