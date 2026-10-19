# Implementation Plan: Payroll System Enhancement

## Overview
Enhance the existing payroll system with notification scheduling, debt tracking, minute-precision scheduling, and debt management commands. Fix lazy environment variable loading in apiClient.js.

---

## Implementation Steps

### PHASE 1: Fix Environment Loading & Add Minute to Schedule

- [ ] 1. **Fix apiClient.js to use lazy environment variable loading**
      
      Modify src/features/payroll/services/apiClient.js to read BASE_URL and API_KEY inside functions (via a getConfig() helper) instead of at module top level, preventing import-time crashes when env vars are absent.
      
      Files: src/features/payroll/services/apiClient.js
      
      Verify: `node -e "import('./src/features/payroll/services/apiClient.js')"` should not throw even without env vars set

- [ ] 2. **Add minute field to database collections and CRUD functions**
      
      Update src/database/payroll.js: (a) modify updateSalaryConfig() and getSalaryConfig() to handle minute field (default 0), (b) add getSalaryNotificationConfigCollection(), getSalaryNotificationConfig(), updateSalaryNotificationConfig() for notification schedule, (c) add getSalaryDebtsCollection(), createDebt(), getDebtById(), getAllDebts(), updateDebtStatus() for debt tracking.
      
      Files: src/database/payroll.js
      
      Verify: `node --check src/database/payroll.js`

- [ ] 3. **Update scheduler to use minute in cron expressions**
      
      Modify src/features/payroll/scheduler.js: (a) add minute parameter to createCronExpression(), (b) update initPayrollScheduler() to read minute from config, (c) update updateSchedule() to accept minute parameter.
      
      Files: src/features/payroll/scheduler.js
      
      Verify: `node --check src/features/payroll/scheduler.js` and confirm cron expression in logs shows minute

- [ ] 4. **Update /salary-schedule command to accept minute parameter**
      
      Modify src/features/payroll/commands/salarySchedule.js: add minute option (0-59), pass to updateSalaryConfig() and updateSchedule(), display in embed as HH:MM format.
      
      Files: src/features/payroll/commands/salarySchedule.js
      
      Verify: Start bot with `npm run dev`, run `/salary-schedule day:Monday hour:12 minute:30` in Discord, confirm embed shows "12:30"

---

### PHASE 2: Notification System

- [ ] 5. **Create payroll notification preview service**
      
      Create src/features/payroll/services/payrollNotificationService.js with async generatePayrollPreview(client) function that: gets eligible roles & coefficients, fetches & deduplicates members, calculates total coins needed (using same logic as payrollService), calls getBalance() API, calculates deficit if balance < needed, returns {nextPayrollDate, totalCoinsNeeded, currentBalance, deficit, memberCount, breakdown}.
      
      Files: src/features/payroll/services/payrollNotificationService.js
      
      Verify: `node --check src/features/payroll/services/payrollNotificationService.js`

- [ ] 6. **Create notification scheduler**
      
      Create src/features/payroll/notificationScheduler.js with: initNotificationScheduler(client) loads config from DB, creates cron job with minute precision, on trigger calls generatePayrollPreview(), gets members with notificationRoles, sends embed to 'salary-notification' or 'thong-bao-luong' channel. Export updateNotificationSchedule(dayOfWeek, hour, minute, client) to restart job.
      
      Files: src/features/payroll/notificationScheduler.js
      
      Verify: `node --check src/features/payroll/notificationScheduler.js`

- [ ] 7. **Create /salary-notification-schedule command**
      
      Create src/features/payroll/commands/salaryNotificationSchedule.js: SlashCommandBuilder with day/hour/minute/roles options, admin permission, updates DB via updateSalaryNotificationConfig(), restarts scheduler via updateNotificationSchedule().
      
      Files: src/features/payroll/commands/salaryNotificationSchedule.js
      
      Verify: `node --check src/features/payroll/commands/salaryNotificationSchedule.js`

- [ ] 8. **Create /salary-notification-roles command**
      
      Create src/features/payroll/commands/salaryNotificationRoles.js: SlashCommandBuilder with add/remove/list subcommands, admin permission, manages notificationRoles array in DB config.
      
      Files: src/features/payroll/commands/salaryNotificationRoles.js
      
      Verify: `node --check src/features/payroll/commands/salaryNotificationRoles.js`

---

### PHASE 3: Debt Tracking

- [ ] 9. **Add debt tracking to payroll service**
      
      Modify src/features/payroll/services/payrollService.js: in processWeeklyPayroll(), before member loop, add pre-check: (a) calculate total coins needed for all members, (b) call getBalance(), (c) if balance < total: create debt record with debtId=DDMMYYYYHHmm format, save via createDebt(), return early with {debtCreated: true, debtId}, (d) else proceed with payments. Add formatDebtId(date) helper.
      
      Files: src/features/payroll/services/payrollService.js
      
      Verify: `node --check src/features/payroll/services/payrollService.js`, manually test with low balance scenario, verify debt record created in MongoDB

---

### PHASE 4: Debt Management Commands

- [ ] 10. **Create /salary-debts list command**
       
       Create src/features/payroll/commands/salaryDebts.js: SlashCommandBuilder with 'list' subcommand, admin permission, calls getAllDebts({status: 'unpaid'}), displays embed with debtId, date, deficit, member count for each debt.
       
       Files: src/features/payroll/commands/salaryDebts.js
       
       Verify: `node --check src/features/payroll/commands/salaryDebts.js`

- [ ] 11. **Create /salary-debt-detail command**
       
       Create src/features/payroll/commands/salaryDebtDetail.js: SlashCommandBuilder with debtId option, admin permission, calls getDebtById(), displays detailed embed with all debt info including unpaidMembers list.
       
       Files: src/features/payroll/commands/salaryDebtDetail.js
       
       Verify: `node --check src/features/payroll/commands/salaryDebtDetail.js`

- [ ] 12. **Create /salary-pay-debt command**
       
       Create src/features/payroll/commands/salaryPayDebt.js: SlashCommandBuilder with debtId option, admin permission, checks balance, if sufficient processes payments for all unpaidMembers (with 1s delay between calls), updates debt status to 'paid', displays progress and results.
       
       Files: src/features/payroll/commands/salaryPayDebt.js
       
       Verify: `node --check src/features/payroll/commands/salaryPayDebt.js`

---

### PHASE 5: Integration

- [ ] 13. **Update payroll feature index to export new commands and scheduler**
       
       Modify src/features/payroll/index.js: add imports and exports for salaryNotificationSchedule, salaryNotificationRoles, salaryDebts, salaryDebtDetail, salaryPayDebt commands, and initNotificationScheduler.
       
       Files: src/features/payroll/index.js
       
       Verify: `node --check src/features/payroll/index.js`

- [ ] 14. **Register new commands in discord.js**
       
       Modify src/discord.js: add new commands to commands array in registerCommands(), add interaction handlers for each new command name in setupInteractionHandlers().
       
       Files: src/discord.js
       
       Verify: `node --check src/discord.js`

- [ ] 15. **Initialize notification scheduler on bot startup**
       
       Modify src/index.js: import initNotificationScheduler from payroll feature, call it after initPayrollScheduler() in the ready event handler.
       
       Files: src/index.js
       
       Verify: `node --check src/index.js`, start bot with `npm run dev`, confirm both schedulers initialize in logs

---

### PHASE 6: Documentation

- [ ] 16. **Update payroll system documentation**
       
       Modify doc/features/payroll/PAYROLL_SYSTEM.md: add sections for: (a) notification system (schedule, notification preview, commands), (b) debt tracking (when debts are created, debtId format, schema), (c) debt management commands (list, detail, pay), (d) update schedule format to show minute field, (e) update command documentation for /salary-schedule with minute, add new commands.
       
       Files: doc/features/payroll/PAYROLL_SYSTEM.md
       
       Verify: Read through doc to ensure completeness and accuracy

---

## Final Verification

After all steps complete:

1. **Syntax check all modified files:**
   ```bash
   node --check src/features/payroll/services/apiClient.js
   node --check src/database/payroll.js
   node --check src/features/payroll/scheduler.js
   node --check src/features/payroll/commands/salarySchedule.js
   node --check src/features/payroll/services/payrollNotificationService.js
   node --check src/features/payroll/notificationScheduler.js
   node --check src/features/payroll/commands/salaryNotificationSchedule.js
   node --check src/features/payroll/commands/salaryNotificationRoles.js
   node --check src/features/payroll/services/payrollService.js
   node --check src/features/payroll/commands/salaryDebts.js
   node --check src/features/payroll/commands/salaryDebtDetail.js
   node --check src/features/payroll/commands/salaryPayDebt.js
   node --check src/features/payroll/index.js
   node --check src/discord.js
   node --check src/index.js
   ```

2. **Import check (env vars absent):**
   ```bash
   node -e "import('./src/features/payroll/services/apiClient.js')"
   # Should not throw
   ```

3. **Start bot and verify initialization:**
   ```bash
   npm run dev
   # Check logs for:
   # [Payroll] Initializing payroll scheduler...
   # [Payroll] Schedule: ... (with minute)
   # [Payroll Notification] Initializing notification scheduler...
   ```

4. **Test commands in Discord:**
   - `/salary-schedule day:Monday hour:12 minute:30` → verify embed shows "12:30"
   - `/salary-notification-schedule` → verify scheduler restarts
   - `/salary-notification-roles add @role` → verify role added
   - `/salary-notification-roles list` → verify roles displayed
   - Create debt by running payroll with insufficient balance
   - `/salary-debts list` → verify debt appears
   - `/salary-debt-detail <id>` → verify details shown
   - `/salary-pay-debt <id>` → verify payment processing (with sufficient balance)

5. **Verify MongoDB collections:**
   - `salary_config` has minute field
   - `salary_notification_config` collection exists
   - `salary_debts` collection exists with debt records

---

## Notes

- **Lazy env loading:** All new modules MUST read environment variables inside functions, never at module top level
- **DebtId format:** DDMMYYYYHHmm in Asia/Ho_Chi_Minh timezone
- **Notification channel:** Search order: 'salary-notification', 'thong-bao-luong', 'mod-logs'
- **Admin permission:** All commands require PermissionFlagsBits.Administrator
- **Debt tracking:** Only creates debt when balance < total needed; otherwise proceeds normally
- **Payment delay:** 1 second between API calls when paying debts

