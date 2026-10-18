# Implementation Plan: Payroll System

## Architecture Overview

### System Components

1. **Database Layer** (`src/database/payroll.js`)
   - 4 MongoDB collections for salary configuration and history
   - Pattern matches existing `violations.js` structure

2. **Payroll API Client** (`src/features/payroll/services/apiClient.js`)
   - HTTP client using native `fetch` (available in Node.js 18+)
   - Retry logic with exponential backoff for 409/503 errors
   - Environment variables: `PAYROLL_API_BASE_URL`, `PAYROLL_API_KEY`

3. **Business Logic** (`src/features/payroll/services/payrollService.js`)
   - Core salary calculation and payment processing
   - Member deduplication, coefficient summing, role selection
   - Payment history recording

4. **Scheduler** (`src/features/payroll/scheduler.js`)
   - Weekly cron job (default: Monday 00:00 Asia/Ho_Chi_Minh)
   - Uses node-cron like existing `violationChecker.js`
   - Config loaded from DB and cached in memory

5. **Admin Commands** (`src/features/payroll/commands/`)
   - 4 slash commands for salary management
   - All require Administrator permission
   - Follow existing command pattern from `rename/command.js`

6. **Documentation** (`doc/payroll/PAYROLL_SYSTEM.md`)
   - System architecture, business rules, and usage guide

### Data Model

**Collection: `salary_coefficients`**
```javascript
{
  roleId: string,           // Discord role ID
  roleName: string,         // Role name (for display)
  coefficient: number,      // Salary multiplier (1-100)
  updatedAt: Date,
  updatedBy: string         // User ID who set it
}
```

**Collection: `salary_eligible_roles`**
```javascript
{
  roleId: string,           // Roles that trigger salary payout
  roleName: string,
  addedAt: Date,
  addedBy: string
}
```

**Collection: `salary_config`**
```javascript
{
  _id: 'schedule',          // Singleton document
  dayOfWeek: number,        // 0=Sunday, 1=Monday, etc.
  hour: number,             // 0-23
  timezone: string,         // 'Asia/Ho_Chi_Minh'
  updatedAt: Date,
  updatedBy: string
}
```

**Collection: `salary_history`**
```javascript
{
  guildId: string,
  userId: string,
  paidAt: Date,
  period: string,           // 'YYYY-MM' from API response
  eligibleRoles: [          // Roles that qualified for payment
    { roleId: string, roleName: string, coefficient: number }
  ],
  paidWithRole: {           // First eligible role used for API call
    roleId: string,
    roleName: string
  },
  amount: number,           // Total coefficient (capped at 100)
  allRolesAtTime: [         // All roles user had at payment time
    { roleId: string, roleName: string }
  ],
  status: string,           // 'SUCCESS', 'FAILED', 'DUPLICATE'
  apiResponse: object,      // Full response from Payroll API
  error: string,            // Error message if failed
  createdAt: Date
}
```

### Key Business Rules

1. **Eligible roles list** determines who gets paid (fetched from `salary_eligible_roles`)
2. **Deduplication**: User with multiple eligible roles counted once per payment run
3. **Coefficient calculation**: SUM of ALL eligible roles user has (default=1 if not in `salary_coefficients`)
4. **Amount cap**: Total must not exceed 100 (Payroll API constraint)
5. **API call**: Uses FIRST eligible role from user's role list
6. **Retry safety**: API prevents duplicate payments per role per month
7. **Schedule caching**: Config loaded on startup and when `/salary-schedule` runs

### Key Design Decisions

**Decision 1: Native fetch vs. axios/node-fetch**
- **Choice**: Use native `fetch` (Node.js 18+)
- **Rationale**: Project already uses Node.js runtime (package.json shows ES modules), no extra dependency needed, cleaner than adding axios/node-fetch

**Decision 2: Sequential vs. Parallel API calls**
- **Choice**: Sequential processing with retry logic
- **Rationale**: Avoid 409 conflicts from API, easier error handling and logging per user, acceptable performance for typical server sizes

**Decision 3: Cron timezone handling**
- **Choice**: Use cron expression for local time, document timezone in DB config
- **Rationale**: node-cron runs in server's local time; deployment should set TZ=Asia/Ho_Chi_Minh environment variable

**Decision 4: Manual payout command behavior**
- **Choice**: `/salary-payout-now` bypasses schedule, runs immediately with progress feedback
- **Rationale**: Useful for testing, emergency payouts, and ad-hoc runs without waiting for schedule

**Decision 5: Coefficient defaults**
- **Choice**: Roles not in `salary_coefficients` default to 1
- **Rationale**: Matches user requirement "các role k có trong danh sách hệ số thì mặc định là hệ số 1"

**Decision 6: Error handling strategy**
- **Choice**: Log all errors but continue processing remaining users
- **Rationale**: One user's failure shouldn't block payment for others; admin can review logs and history

---

## Implementation Plan

### Phase 1: Database Foundation

- [ ] 1. Create database layer for payroll collections in `src/database/payroll.js`.
         Implement CRUD functions for all 4 collections following the pattern from `violations.js`.
         Functions: getCoefficientByRole, setCoefficientForRole, getAllCoefficients,
         addEligibleRole, removeEligibleRole, getAllEligibleRoles,
         getScheduleConfig, updateScheduleConfig, initializeScheduleConfig (creates default if missing),
         recordPayment, getPaymentHistory, getPaymentsByPeriod.
         Files: `src/database/payroll.js`
         Verify: Create test file `test-payroll-db.js` that imports and calls each function with sample data, run `node test-payroll-db.js` and confirm no errors, then delete test file.

- [ ] 2. Add environment variables for Payroll API to `.env` file.
         Add `PAYROLL_API_BASE_URL=http://localhost:3000/api/payroll` and `PAYROLL_API_KEY=your_key_here` as commented placeholders with instructions.
         Files: `.env`
         Verify: Run `grep PAYROLL_API .env` and confirm both variables exist.

### Phase 2: Payroll API Client

- [ ] 3. Create Payroll API client in `src/features/payroll/services/apiClient.js`.
         Implement functions: getBalance(), transfer(userId, roleId, amount, description), getPayouts(period, roleId).
         Use native fetch with headers: 'x-api-key' from env, 'Content-Type: application/json'.
         Implement exponential backoff retry for HTTP 409/503 (max 3 attempts, delays: 2s, 4s, 8s).
         Validate env vars at module load, throw error if missing.
         Files: `src/features/payroll/services/apiClient.js`
         Verify: Create test script that calls getBalance() with real API credentials, run `node --experimental-modules <script>` and confirm it returns balance object or error.

### Phase 3: Core Payroll Service

- [ ] 4. Create payroll business logic service in `src/features/payroll/services/payrollService.js`.
         Implement processWeeklyPayroll(client, guildId) function that:
         (a) Fetches salary_eligible_roles from DB
         (b) Gets all members with those roles from Discord guild, deduplicates by userId
         (c) For each unique member: calculates total coefficient by summing coefficients of ALL eligible roles they have (default 1), caps at 100
         (d) Selects FIRST eligible role from member's role list for API call
         (e) Calls apiClient.transfer() with userId, selected roleId, capped amount
         (f) Records result to salary_history via database layer
         (g) Returns summary: { total, successful, failed, duplicates, errors: [] }
         Handle member fetch errors gracefully (skip if not found).
         Files: `src/features/payroll/services/payrollService.js`
         Verify: Add console.log at start/end of function, call it manually in a test context with dry-run mode (comment out actual API calls), confirm it logs member list and calculated amounts correctly.

### Phase 4: Scheduler Integration

- [ ] 5. Create payroll scheduler in `src/features/payroll/scheduler.js`.
         Implement initPayrollScheduler(client) following pattern from `violationChecker.js`.
         Load schedule config from DB on init (call initializeScheduleConfig to ensure defaults exist).
         Create cron job using config (convert dayOfWeek+hour to cron expression like '0 0 * * 1' for Monday 00:00).
         Cache schedule config in module-level variable.
         Export restartScheduler(client) function to reload config and restart cron job.
         Call payrollService.processWeeklyPayroll() when cron triggers.
         Log '[SCHEDULER] Starting weekly payroll...' and summary results.
         Files: `src/features/payroll/scheduler.js`
         Verify: Create test that calls initPayrollScheduler with mock client, check console for scheduler start message and cron registration.

- [ ] 6. Integrate payroll scheduler into bot startup in `src/index.js`.
         Import initPayrollScheduler from `./features/payroll/scheduler.js`.
         Call initPayrollScheduler(client) after MongoDB connection succeeds, in the same location where startViolationChecker(client) is called.
         Files: `src/index.js`
         Verify: Run bot with `npm start`, check console logs for '[INFO] Payroll scheduler initialized' message after MongoDB connection.

### Phase 5: Admin Commands

- [ ] 7. Create `/salary-coefficient` command in `src/features/payroll/commands/salaryCoefficient.js`.
         SlashCommandBuilder with options: role (Role type, required), coefficient (Integer 1-100, required).
         Requires PermissionFlagsBits.Administrator.
         Execute function: validates input range, calls setCoefficientForRole(roleId, roleName, coefficient, interaction.user.id), replies with success embed.
         Files: `src/features/payroll/commands/salaryCoefficient.js`
         Verify: Register and run command in Discord with test role, check DB collection `salary_coefficients` has new entry with correct values.

- [ ] 8. Create `/salary-roles` command in `src/features/payroll/commands/salaryRoles.js`.
         SlashCommandBuilder with subcommands: add (role required), remove (role required), list (no options).
         All require Administrator permission.
         Execute function: routes to subcommand handlers, 'add' calls addEligibleRole, 'remove' calls removeEligibleRole, 'list' fetches and displays all eligible roles in embed.
         Files: `src/features/payroll/commands/salaryRoles.js`
         Verify: Run all 3 subcommands, confirm 'add' inserts to DB, 'remove' deletes from DB, 'list' shows correct data.

- [ ] 9. Create `/salary-schedule` command in `src/features/payroll/commands/salarySchedule.js`.
         SlashCommandBuilder with options: day (String choice: monday-sunday, required), hour (Integer 0-23, required).
         Requires Administrator permission.
         Execute function: converts day name to dayOfWeek number (0-6), validates hour range, calls updateScheduleConfig(), calls restartScheduler(client) to apply immediately, replies with confirmation embed showing new schedule.
         Files: `src/features/payroll/commands/salarySchedule.js`
         Verify: Run command with different day/hour, check DB `salary_config` document updated, check console for scheduler restart message.

- [ ] 10. Create `/salary-payout-now` command in `src/features/payroll/commands/salaryPayoutNow.js`.
          SlashCommandBuilder, no options, requires Administrator.
          Execute function: defers reply, calls processWeeklyPayroll(client, guildId), builds result embed with summary (total processed, successful, failed, duplicates), shows error details if any, editReply with embed.
          Files: `src/features/payroll/commands/salaryPayoutNow.js`
          Verify: Run command, confirm it triggers immediate payout, bot replies with detailed summary embed, check salary_history collection for new entries.

- [ ] 11. Create payroll feature index in `src/features/payroll/index.js`.
          Export all 4 command objects following pattern from `rename/index.js`.
          Export object: { salaryCoefficient, salaryRoles, salarySchedule, salaryPayoutNow, initScheduler }.
          Files: `src/features/payroll/index.js`
          Verify: Run `node -e "import('./src/features/payroll/index.js').then(m => console.log(Object.keys(m)))"` and confirm all exports present.

### Phase 6: Discord Integration

- [ ] 12. Register payroll commands in `src/discord.js`.
          Import payroll commands from `../features/payroll/index.js`.
          Add all 4 commands to the `commands` array in registerCommands() function (after rename and scheduler commands).
          Add interaction handlers in setupInteractionHandlers(): check commandName for 'salary-coefficient', 'salary-roles', 'salary-schedule', 'salary-payout-now' and route to appropriate execute functions.
          Pass `client` from interaction to commands that need it (salary-schedule for restartScheduler, salary-payout-now for processWeeklyPayroll).
          Files: `src/discord.js`
          Verify: Start bot, run `/` in Discord and confirm all 4 new salary commands appear in autocomplete, run each command and confirm they respond correctly.

### Phase 7: Documentation

- [ ] 13. Create comprehensive payroll system documentation in `doc/payroll/PAYROLL_SYSTEM.md`.
          Document sections:
          - System Overview (what it does, when it runs)
          - Architecture (4 collections, scheduler, API client, commands)
          - Business Rules (eligibility, deduplication, coefficient calculation, amount cap, role selection)
          - Database Schema (all 4 collections with field descriptions)
          - Payroll Flow Sequence Diagram (text-based: 1. Scheduler triggers -> 2. Fetch config -> 3. Get eligible roles -> 4. Get members -> 5. Deduplicate -> 6. Calculate -> 7. Call API -> 8. Record history)
          - Admin Commands Reference (syntax, permissions, examples for each command)
          - Configuration (environment variables, schedule config, coefficient setup)
          - Constraints (role requirements, amount limits, API retry behavior, timezone handling)
          - Troubleshooting (common errors and solutions)
          Files: `doc/payroll/PAYROLL_SYSTEM.md`
          Verify: Read through document, ensure all sections are complete and accurate, verify code examples match actual implementation.

### Phase 8: Final Verification

- [ ] 14. End-to-end integration test of complete payroll system.
          Test sequence:
          (a) Start bot and verify scheduler initializes
          (b) Run `/salary-roles add` to add 2 test roles
          (c) Run `/salary-coefficient` to set coefficients (role A=2, role B=3)
          (d) Run `/salary-schedule` to set schedule
          (e) Assign test roles to a test user (one user with both roles)
          (f) Run `/salary-payout-now` and verify summary shows 1 user processed
          (g) Check `salary_history` collection for payment record with correct amount (2+3=5 coins)
          (h) Verify payment history shows all roles and selected first role
          (i) Run `/salary-payout-now` again and confirm DUPLICATE status
          (j) Run `/salary-roles list` and verify both roles shown
          Files: (no file changes, verification only)
          Verify: All steps complete successfully, logs show no errors, database records match expected values, Discord commands respond correctly.

---

## Critical Gotchas & Implementation Notes

### 1. Node-Cron Expression Format
- Format: `'minute hour dayOfMonth month dayOfWeek'`
- Example: `'0 0 * * 1'` = every Monday at 00:00
- **Gotcha**: Day of week in cron is 0-6 (Sunday=0), but UI shows Monday-Sunday as choices
- **Solution**: Map user-friendly day names to cron numbers in scheduler code

### 2. Timezone Handling
- **Gotcha**: node-cron uses server's local time, not timezone-aware
- **Solution**: Document that deployment must set `TZ=Asia/Ho_Chi_Minh` environment variable, or bot will use server's default timezone
- **Alternative**: Use explicit timezone conversion in code before scheduling, but increases complexity

### 3. Payroll API Amount Cap
- **Gotcha**: API only accepts 1-100, but coefficient sum can exceed this
- **Solution**: Cap calculated amount at 100 before API call: `Math.min(totalCoefficient, 100)`
- **Must do**: Document this in salary_history so admin knows if cap was applied

### 4. Native Fetch in Node.js
- **Requirement**: Node.js 18+ for native fetch
- **Gotcha**: package.json doesn't specify Node version
- **Solution**: Add comment in code and README that Node 18+ required, or add `"engines": { "node": ">=18.0.0" }` to package.json

### 5. API Retry Logic
- **Gotcha**: 409 means concurrent request, 503 means service unavailable - both are retryable
- **Solution**: Exponential backoff with delays 2s, 4s, 8s (total ~14s max per user)
- **Important**: Don't retry 400/403/404 - these are permanent failures

### 6. Member Role Deduplication
- **Gotcha**: User with roles A, B, C should only be processed once, not 3 times
- **Solution**: Build Set of unique userIds first, then process each user once
- **Detail**: When calculating coefficient, sum ALL eligible roles the user has

### 7. First Eligible Role Selection
- **Gotcha**: Must pick exactly one role for API call, but user may have multiple eligible roles
- **Solution**: Use first eligible role found in user's role list (order from Discord API)
- **Important**: Document this choice in salary_history for audit trail

### 8. Environment Variable Validation
- **Gotcha**: Missing PAYROLL_API_KEY will cause runtime errors during payout
- **Solution**: Validate env vars when apiClient.js loads, throw clear error before bot starts
- **Alternative**: Check when command runs and reply with admin-friendly error message

### 9. Schedule Config Initialization
- **Gotcha**: First run with empty DB will fail if schedule config doesn't exist
- **Solution**: initializeScheduleConfig() creates default document if missing (Monday 00:00 Asia/Ho_Chi_Minh)
- **Must call**: During scheduler init, before reading config

### 10. Discord Permission Checks
- **Gotcha**: Bot needs roles to be below bot's highest role in hierarchy to read members
- **Solution**: Document in PAYROLL_SYSTEM.md that bot role must be above salary roles in role list
- **Error handling**: Catch permission errors when fetching members, log clear message

### 11. Guild ID Context
- **Gotcha**: Commands run in a guild context, but scheduler needs guild ID
- **Solution**: Store GUILD_ID from env, use it in scheduler; for multi-guild support, iterate client.guilds
- **Current scope**: Single-guild bot per README, use GUILD_ID from env

### 12. Coding Standards Compliance
- **Must follow**: No emoji in source code (use constants/emojis.js for Discord messages)
- **Must do**: JSDoc comments in Vietnamese for all functions
- **File naming**: kebab-case for all files
- **Functions**: camelCase naming
- **Log format**: `[SUCCESS]`, `[ERROR]`, `[INFO]`, `[SCHEDULER]` prefixes

### 13. MongoDB Connection Timing
- **Gotcha**: Scheduler init happens after MongoDB connects, but before client.ready
- **Solution**: In index.js, call initPayrollScheduler() right after connectMongoDB() succeeds, in the client.once('ready') handler

### 14. Duplicate Payment Handling
- **Gotcha**: API returns 200 with duplicate:true, this is NOT an error
- **Solution**: Check both status:'SUCCESS' AND duplicate:false for new payments; log duplicate:true as info, not error

### 15. Testing Strategy
- **Important**: Cannot fully test without real Payroll API or mock server
- **Workaround**: Test DB layer separately, test command registration, test scheduler cron setup (but not actual payout), add dry-run flag for testing without API calls

---

## Dependencies & Requirements

**Required Node.js version**: 18+ (for native fetch)

**Existing dependencies** (no changes needed):
- `discord.js@14.27.0` - Discord API
- `mongodb@7.7.0` - Database
- `node-cron@4.6.0` - Scheduler
- `dotenv@16.6.1` - Environment variables

**Environment variables** (to be added):
- `PAYROLL_API_BASE_URL` - Base URL of Payroll API
- `PAYROLL_API_KEY` - API authentication key
- `TZ` (optional) - Timezone for cron (set to `Asia/Ho_Chi_Minh`)

**Discord Bot Permissions** (must already have):
- Read roles
- Read server members
- Use slash commands

**MongoDB Collections** (will be created):
- `salary_coefficients`
- `salary_eligible_roles`
- `salary_config`
- `salary_history`

---

## Estimated Implementation Time

- Phase 1 (DB): 1-2 hours
- Phase 2 (API Client): 1-2 hours
- Phase 3 (Business Logic): 2-3 hours
- Phase 4 (Scheduler): 1-2 hours
- Phase 5 (Commands): 3-4 hours
- Phase 6 (Integration): 1 hour
- Phase 7 (Docs): 1-2 hours
- Phase 8 (Testing): 2-3 hours

**Total**: 12-19 hours for complete implementation and testing

---

## Success Criteria

✅ All 4 admin commands registered and respond correctly
✅ Scheduler initializes on bot startup with config from DB
✅ Manual payout via `/salary-payout-now` processes members and calls API
✅ Payment history recorded in MongoDB with complete audit trail
✅ Retry logic handles transient API failures (409/503)
✅ Amount capping works correctly (max 100)
✅ Member deduplication prevents multiple payments per run
✅ Coefficient calculation sums all eligible roles correctly
✅ First eligible role selected for API call
✅ Documentation complete and accurate
✅ Code follows project coding standards (no emoji in source, JSDoc comments, etc.)
✅ All environment variables validated at startup
✅ Error handling prevents one failure from blocking others

---

## Post-Implementation Considerations

1. **Monitoring**: Add logging dashboard or alerts for failed payments
2. **Multi-guild Support**: Currently single-guild, could iterate client.guilds for multi-guild
3. **Payment Reports**: Add command to generate monthly payment reports
4. **Dry-Run Mode**: Add flag to test calculation without calling API
5. **Role Priority**: Allow admin to configure which role takes precedence instead of "first"
6. **Batch API**: If API later supports batch transfers, refactor to use it
7. **Notification**: Consider DM or channel notification when payroll completes
8. **Audit Log**: Add Discord audit log entries for coefficient/schedule changes
9. **Web Dashboard**: Consider admin web interface for viewing history and managing config
10. **Backup**: Implement salary_history export for recordkeeping

---

**Plan complete. Ready for implementation phase.**
