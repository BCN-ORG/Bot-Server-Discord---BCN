# Implementation Plan: Violation (Biên Bản Phạt) System Rebuild

## Executive Summary

This plan rebuilds the violation system from a name-validation focused system to a comprehensive fine management system with Payroll API integration. The current system tracks invalid nicknames; the new system manages monetary fines (biên bản phạt) with payment tracking, daily reminders, voice channel notifications, and public announcements.

---

## 1. Current Code Analysis

### What to Keep
- **Database Infrastructure**: `src/database/mongodb.js` - MongoDB connection pattern is solid
- **API Client Pattern**: `src/features/payroll/services/apiClient.js` - Excellent reference for Payroll API integration with retry logic
- **Discord.js Event Handlers**: Event registration in `src/index.js` works well
- **Command Registration Pattern**: `src/discord.js` handles slash commands properly
- **EmbedBuilder Usage**: Consistent embed patterns across features (fineReports, payroll)

### What to Delete/Replace
- **Old Violation Files**:
  - `src/database/violations.js` - Current schema is name-validation focused, needs complete rewrite
  - `src/schedulers/violationChecker.js` - Current scheduler kicks users, new one sends reminders
  - `src/services/nameValidationService.js` - Remove violation-related code (keep for name validation only)
  - Voice/member event handlers in `src/events/voiceStateUpdate.js` and `src/events/guildMemberAdd.js` - Remove violation logic

- **No existing violation commands exist** - All commands are new

### Reference Implementation Pattern
The `fineReports` feature (`src/features/fineReports/`) is the closest analog:
- Similar domain (fines/penalties)
- Good command structure with subcommands
- Uses MongoDB with proper indexing
- Embed-based UI
- Role-based permissions

---

## 2. Database Schema & Migration Strategy

### New Collections

#### `violations` Collection
```javascript
{
  _id: ObjectId,
  violationId: String,        // Format: VIO-YYYYMMDD-XXX (e.g., VIO-20261024-001)
  userId: String,             // Discord user ID
  username: String,           // Username at creation time
  reason: String,             // Why they were fined
  amount: Number,             // Coins to pay
  isPaid: Boolean,            // Payment status
  paidAt: Date | null,        // When paid
  paidBy: String | null,      // userId who paid (can be different from violator)
  payrollReference: String | null,  // Payroll API reference for topup call
  createdBy: String,          // userId who created the violation
  createdAt: Date,            // Creation timestamp
  updatedAt: Date             // Last update timestamp
}
```

**Indexes**:
- `{ violationId: 1 }` - unique
- `{ userId: 1, isPaid: 1, createdAt: -1 }` - for user queries
- `{ isPaid: 1, createdAt: -1 }` - for admin list
- `{ guildId: 1 }` - for multi-guild support (future)

#### `violation_config` Collection
```javascript
{
  _id: ObjectId,
  guildId: String,            // Discord guild ID
  authorizedRoles: [String],  // Role IDs allowed to create violations
  reminderTimes: [            // Multiple daily reminder times
    { hour: Number, minute: Number }
  ],
  announcementChannelId: String | null,  // Channel for public announcements
  updatedAt: Date
}
```

**Indexes**:
- `{ guildId: 1 }` - unique

### Migration Strategy

**Phase 1: Backup Current Data**
```javascript
// Export current violations collection
db.violations.find().toArray() → violations_backup_YYYYMMDD.json
```

**Phase 2: Schema Transformation**
- Current violations are name-validation records (not monetary fines)
- **No data migration needed** - these are different domains
- Drop old `violations` collection after backup
- Create new collections with new schema

**Phase 3: Seed Default Config**
```javascript
// Create default config for the guild
{
  guildId: process.env.GUILD_ID,
  authorizedRoles: [],
  reminderTimes: [{ hour: 9, minute: 0 }],  // Default: 9:00 AM
  announcementChannelId: null,
  updatedAt: new Date()
}
```

---

## 3. Implementation Steps (Ordered by Dependency)

### Step 1: Create Database Layer
**What**: Create new `src/database/violations.js` with all CRUD operations for violations and configs.

**Files**:
- `src/database/violations.js` (rewrite completely)

**Functions to implement**:
- `getViolationConfig(guildId)` - Get guild config
- `upsertViolationConfig(guildId, updates)` - Update config
- `addAuthorizedRole(guildId, roleId)` - Add role to authorized list
- `removeAuthorizedRole(guildId, roleId)` - Remove role
- `addReminderTime(guildId, hour, minute)` - Add reminder time (check duplicates)
- `removeReminderTime(guildId, hour, minute)` - Remove reminder time
- `setAnnouncementChannel(guildId, channelId)` - Set announcement channel
- `generateViolationId()` - Generate unique VIO-YYYYMMDD-XXX format
- `createViolation({ userId, username, reason, amount, createdBy, guildId })` - Create violation
- `getViolationById(violationId)` - Get single violation
- `getViolationsByUser(userId, isPaid)` - Get user's violations (filter by payment status)
- `getAllViolations(guildId, filters)` - Get all violations with filters
- `markViolationPaid(violationId, paidBy, payrollReference)` - Mark as paid
- `getUnpaidViolations(guildId)` - Get all unpaid violations for reminders

**Verification**: 
```bash
node --watch src/index.js
# Then use MongoDB Compass or mongo shell to verify:
# 1. Collections created with proper indexes
# 2. violationId generation creates unique IDs with correct format
# 3. Reminder time duplicates are rejected
```

---

### Step 2: Create Payroll API Client for Violations
**What**: Create dedicated API client for violation payments using `/topup` endpoint.

**Files**:
- `src/features/violations/services/payrollViolationClient.js` (new)

**Functions**:
- `topupForViolation({ violationId, payerId, amount, reason })` - Call POST /topup
  - Generate reference: `violation-${violationId}-${timestamp}`
  - Handle SUCCESS, FAILED, duplicate responses
  - Use retry logic from `apiClient.js` pattern

**Integration Points**:
- Follow exact pattern from `src/features/payroll/services/apiClient.js`
- Use same config loading (PAYROLL_API_KEY, PAYROLL_API_BASE_URL from .env)
- Implement retryWithBackoff for 409/503 errors
- Log all API calls with `[Payroll API - Violation]` prefix

**Verification**:
```bash
# Test with actual Payroll API (ensure PAYROLL_API_KEY is valid in .env)
# Create test violation, attempt payment, verify:
# 1. API call succeeds with valid reference format
# 2. Duplicate detection works (same reference returns duplicate:true)
# 3. Insufficient funds returns FAILED status
# 4. Retry logic handles 409/503 correctly
```

---

### Step 3: Implement Core Violation Service
**What**: Business logic layer for violation operations.

**Files**:
- `src/features/violations/services/violationService.js` (new)

**Functions**:
- `isUserAuthorized(guildId, userId, member)` - Check if user has authorized role
- `createViolationWithNotification({ guildId, targetUser, reason, amount, createdBy })` - Create violation + send DM + announcement
- `confirmPayment({ violationId, payerId, interaction })` - Process payment via Payroll API
- `getUserViolationsSummary(userId)` - Get user's unpaid violations with totals
- `formatViolationEmbed(violation)` - Create Discord embed for violation
- `sendViolationDM(user, violation)` - Send DM to violator
- `sendViolationAnnouncement(guild, violation, channelId)` - Send public announcement

**Verification**:
```bash
# Manual testing via Discord commands (once commands are implemented)
# 1. Create violation → verify DM sent + announcement posted
# 2. Confirm payment → verify Payroll API called + violation marked paid
# 3. Check user violations → verify summary shows correct unpaid count
```

---

### Step 4: Implement Authorized Roles Command
**What**: `/violation-authorized-roles add|remove|list <role>`

**Files**:
- `src/features/violations/commands/violationAuthorizedRoles.js` (new)

**Command structure**:
```javascript
.setName('violation-authorized-roles')
.addSubcommand(sub => sub.setName('add').addRoleOption(...))
.addSubcommand(sub => sub.setName('remove').addRoleOption(...))
.addSubcommand(sub => sub.setName('list'))
.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
```

**Logic**:
- `add`: Add role to authorizedRoles array, check duplicates
- `remove`: Remove role from array
- `list`: Display all authorized roles with embed

**Verification**:
```bash
# In Discord:
/violation-authorized-roles add role:@Moderator
# Verify: Success message, role added to DB
/violation-authorized-roles list
# Verify: Shows @Moderator in list
/violation-authorized-roles remove role:@Moderator
# Verify: Role removed, list updates
```

---

### Step 5: Implement Reminder Times Command
**What**: `/violation-reminder-times add|remove|list <hour> <minute>`

**Files**:
- `src/features/violations/commands/violationReminderTimes.js` (new)

**Command structure**:
```javascript
.setName('violation-reminder-times')
.addSubcommand(sub => sub.setName('add')
  .addIntegerOption(opt => opt.setName('hour').setMinValue(0).setMaxValue(23).setRequired(true))
  .addIntegerOption(opt => opt.setName('minute').setMinValue(0).setMaxValue(59).setRequired(true)))
.addSubcommand(sub => sub.setName('remove')...)
.addSubcommand(sub => sub.setName('list'))
.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
```

**Logic**:
- `add`: Check duplicate (same hour:minute exists), add to reminderTimes array
- `remove`: Remove specific hour:minute
- `list`: Display all reminder times formatted as HH:MM

**Verification**:
```bash
# In Discord:
/violation-reminder-times add hour:9 minute:0
# Verify: Success message
/violation-reminder-times add hour:9 minute:0
# Verify: Error "Time 09:00 already exists"
/violation-reminder-times list
# Verify: Shows "09:00" in list
```

---

### Step 6: Implement Set Announcement Channel Command
**What**: `/violation-set-channel <channel>`

**Files**:
- `src/features/violations/commands/violationSetChannel.js` (new)

**Command structure**:
```javascript
.setName('violation-set-channel')
.addChannelOption(opt => opt
  .setName('channel')
  .setDescription('Channel để công khai khi có người bị phạt')
  .setRequired(true))
.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
```

**Logic**:
- Validate channel is text channel
- Update announcementChannelId in config
- Send test message to channel

**Verification**:
```bash
# In Discord:
/violation-set-channel channel:#violations
# Verify: Success message + test message appears in #violations
```

---

### Step 7: Implement Create Violation Command
**What**: `/violation-create <user> <reason> <amount>`

**Files**:
- `src/features/violations/commands/violationCreate.js` (new)

**Command structure**:
```javascript
.setName('violation-create')
.addUserOption(opt => opt.setName('user').setDescription('User to fine').setRequired(true))
.addStringOption(opt => opt.setName('reason').setDescription('Reason for fine').setRequired(true))
.addIntegerOption(opt => opt.setName('amount').setDescription('Coins to fine').setMinValue(1).setRequired(true))
```

**Logic**:
1. Check if executor has authorized role (use violationService.isUserAuthorized)
2. Generate violationId
3. Create violation in DB
4. Send DM to violator with violation details + amount + violationId
5. Send announcement to configured channel (if set)
6. Reply to executor with success

**Verification**:
```bash
# In Discord (as authorized user):
/violation-create user:@TestUser reason:"Late to meeting" amount:50
# Verify:
# 1. Success message with violationId (e.g., VIO-20261024-001)
# 2. @TestUser receives DM with violation details
# 3. Announcement appears in configured channel
# 4. DB has new violation record
```

---

### Step 8: Implement Check Personal Violations Command
**What**: `/violation-check` - Member checks their own violations

**Files**:
- `src/features/violations/commands/violationCheck.js` (new)

**Command structure**:
```javascript
.setName('violation-check')
.setDescription('Check your own unpaid violations')
```

**Logic**:
1. Get executor's userId
2. Query unpaid violations for user
3. Create embed with list of violations (violationId, reason, amount, createdAt)
4. Show total unpaid amount
5. Reply with embed (ephemeral)

**Verification**:
```bash
# In Discord (as user with violations):
/violation-check
# Verify:
# 1. Shows list of unpaid violations
# 2. Shows total amount
# 3. Message is ephemeral (only visible to user)
```

---

### Step 9: Implement Admin View Violations Command
**What**: `/violation-list [user] [status] [page]` - Admin view all violations

**Files**:
- `src/features/violations/commands/violationList.js` (new)

**Command structure**:
```javascript
.setName('violation-list')
.addUserOption(opt => opt.setName('user').setDescription('Filter by user').setRequired(false))
.addStringOption(opt => opt.setName('status')
  .setDescription('Filter by status')
  .addChoices(
    { name: 'All', value: 'all' },
    { name: 'Unpaid', value: 'unpaid' },
    { name: 'Paid', value: 'paid' }
  )
  .setRequired(false))
.addIntegerOption(opt => opt.setName('page').setMinValue(1).setRequired(false))
.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
```

**Logic**:
1. Build query filters from options
2. Paginate results (10-15 per page)
3. Create embed with violation list
4. Show totals (total violations, total unpaid amount)
5. Reply with embed

**Verification**:
```bash
# In Discord (as admin):
/violation-list
# Verify: Shows all violations paginated
/violation-list user:@TestUser status:unpaid
# Verify: Shows only unpaid violations for TestUser
/violation-list page:2
# Verify: Shows page 2 of results
```

---

### Step 10: Implement Confirm Payment Command
**What**: `/violation-confirm-payment <violationId>` - Anyone can pay for any violation

**Files**:
- `src/features/violations/commands/violationConfirmPayment.js` (new)

**Command structure**:
```javascript
.setName('violation-confirm-payment')
.addStringOption(opt => opt
  .setName('violation_id')
  .setDescription('Violation ID (e.g., VIO-20261024-001)')
  .setRequired(true))
```

**Logic**:
1. Get violationId from input
2. Query violation from DB
3. Check if violation exists and is not paid
4. Get executor's userId (payer)
5. Call Payroll API `/topup` endpoint via payrollViolationClient
   - Reference: `violation-${violationId}-${timestamp}`
   - Amount: violation.amount
   - UserId: executor's userId (payer)
   - Reason: `Đóng phạt biên bản ${violationId}: ${violation.reason}`
6. Handle response:
   - SUCCESS: Mark violation as paid in DB, send success DM to violator + payer
   - FAILED: Reply with error (insufficient funds)
   - Duplicate: Reply "Already paid"
7. Reply to executor with result

**Verification**:
```bash
# In Discord:
/violation-confirm-payment violation_id:VIO-20261024-001
# Verify:
# 1. Payroll API called with correct reference format
# 2. On success: Violation marked paid in DB
# 3. DM sent to violator: "Your violation VIO-XXX has been paid by @User"
# 4. DM sent to payer: "You paid VIO-XXX for @Violator"
# 5. On failure: Error message with reason
# MongoDB: Verify isPaid=true, paidBy set, payrollReference recorded
```

---

### Step 11: Implement Daily Reminder Scheduler
**What**: Scheduler that runs at configured times, sends DM reminders to users with unpaid violations.

**Files**:
- `src/features/violations/schedulers/violationReminderScheduler.js` (new)

**Functions**:
- `initViolationReminderScheduler(client)` - Initialize scheduler
- `loadReminderTimes(guildId)` - Get reminder times from config
- `createCronJob(hour, minute, client)` - Create cron job for specific time
- `sendRemindersToUsers(client, guildId)` - Main reminder logic

**Logic**:
1. On init: Load reminderTimes from DB
2. For each time: Create separate cron job (format: `${minute} ${hour} * * *`)
3. When cron triggers:
   - Get all unpaid violations
   - Group by userId
   - For each user:
     - Fetch Discord user
     - Create embed with list of unpaid violations
     - Send DM to user
     - Log result
4. Handle config updates: Re-initialize scheduler when reminderTimes change

**Verification**:
```bash
# Set reminder time to current time + 2 minutes
/violation-reminder-times add hour:<current+2> minute:<current>
# Wait 2 minutes
# Verify:
# 1. Scheduler logs execution: "[SCHEDULER] Running violation reminders at HH:MM"
# 2. Users with unpaid violations receive DM
# 3. DM contains list of violations with violationId, reason, amount
# 4. Users without unpaid violations don't receive DM
```

---

### Step 12: Implement Voice Join Notification
**What**: When user joins voice channel, bot sends message to TEXT channel of that voice room mentioning user with unpaid violations.

**Files**:
- `src/events/voiceStateUpdate.js` (modify existing)

**Logic**:
1. Detect voice join: `oldState.channelId === null && newState.channelId !== null`
2. Get userId from newState.member
3. Query unpaid violations for user
4. If unpaid violations exist:
   - Get voice channel's linked text channel (check guild channel structure)
   - Create embed with user mention + list of unpaid violations
   - Send message to text channel (public, everyone can see)
5. If no unpaid violations: do nothing

**Integration**:
- Keep existing name validation logic (mute/deafen)
- Add violation check after name validation

**Verification**:
```bash
# In Discord:
# 1. Create violation for TestUser
# 2. TestUser joins voice channel
# Verify:
# - Message appears in text channel associated with voice room
# - Message mentions @TestUser
# - Message lists unpaid violations with details
# - Message format: Embed, color red, title "⚠️ Nhắc nhở nợ phạt"
```

---

### Step 13: Update Index Files and Command Registration
**What**: Export all commands, register in discord.js, initialize scheduler in index.js

**Files**:
- `src/features/violations/index.js` (new)
- `src/discord.js` (modify)
- `src/index.js` (modify)

**Changes**:
1. Create `src/features/violations/index.js`:
   ```javascript
   export * as violationAuthorizedRoles from './commands/violationAuthorizedRoles.js';
   export * as violationCreate from './commands/violationCreate.js';
   export * as violationCheck from './commands/violationCheck.js';
   export * as violationList from './commands/violationList.js';
   export * as violationConfirmPayment from './commands/violationConfirmPayment.js';
   export * as violationReminderTimes from './commands/violationReminderTimes.js';
   export * as violationSetChannel from './commands/violationSetChannel.js';
   export { initViolationReminderScheduler } from './schedulers/violationReminderScheduler.js';
   ```

2. In `src/discord.js`:
   - Import violation commands
   - Add to commands array in registerCommands()
   - Add command handlers in setupInteractionHandlers()

3. In `src/index.js`:
   - Import `initViolationReminderScheduler`
   - Call in client.once('ready') after MongoDB connection
   - Replace old `startViolationChecker` call

**Verification**:
```bash
node --watch src/index.js
# Verify:
# 1. Bot starts without errors
# 2. All 7 violation commands appear in Discord
# 3. Scheduler initializes: "[INFO] Violation reminder scheduler initialized with X times"
# 4. Old violation checker no longer runs
```

---

### Step 14: Clean Up Old Violation Code
**What**: Remove old violation-related code that's no longer needed.

**Files to clean**:
- `src/schedulers/violationChecker.js` - Delete entire file
- `src/services/nameValidationService.js` - Remove violation imports and functions (keep only name validation)
- `src/events/guildMemberAdd.js` - Remove violation logic
- `src/events/guildMemberUpdate.js` - Remove violation logic

**Keep**:
- Name validation logic (still needed for rename feature)
- Voice mute/deafen logic (different from violations)

**Verification**:
```bash
# Search for old violation references
grep -r "import.*violations" src/
grep -r "createViolation\|getViolation\|resolveViolation" src/
# Verify: Only new violation feature files are found

npm start
# Verify: Bot starts without errors, old violation checker doesn't run
```

---

### Step 15: Create Seed/Migration Script
**What**: Script to initialize violation system for existing guild.

**Files**:
- `scripts/init-violation-system.js` (new)

**Script logic**:
```javascript
// Connect to MongoDB
// Create default config for GUILD_ID from .env
// Create indexes on collections
// Log success
```

**Verification**:
```bash
node scripts/init-violation-system.js
# Verify:
# 1. violation_config created with default values
# 2. Indexes created on violations collection
# 3. Script outputs success message
```

---

### Step 16: Integration Testing
**What**: End-to-end testing of complete workflow.

**Test scenarios**:
1. **Create and Pay Workflow**:
   - Admin adds authorized role
   - Authorized user creates violation
   - Violator receives DM + announcement posted
   - Different user pays for violation
   - Payroll API called successfully
   - Both users receive confirmation DMs
   - Violation marked paid in DB

2. **Reminder System**:
   - Set reminder time to current + 2 minutes
   - Create unpaid violations
   - Wait for reminder to trigger
   - Verify DMs sent to violators

3. **Voice Join Notification**:
   - Create unpaid violation for user
   - User joins voice channel
   - Public message appears in text channel

4. **Admin Management**:
   - List all violations (pagination works)
   - Filter by user and status
   - Check personal violations

5. **Edge Cases**:
   - Pay already-paid violation → Error "Already paid"
   - Non-authorized user creates violation → Error "Not authorized"
   - Insufficient funds → Error from Payroll API
   - User with no violations checks → "No violations"
   - Voice join with no violations → No message

**Verification**:
```bash
# Run through all scenarios manually in Discord
# Document results in test log
# Fix any issues found
```

---

## 4. Integration Points with Payroll API

### Endpoint Used
**POST /topup** - Transfer coins from user wallet to bot wallet

### Request Format
```javascript
{
  reference: "violation-VIO-20261024-001-1729756800000",  // unique per attempt
  userId: "946236759522545665",  // payer's Discord ID
  amount: 50,  // violation amount
  reason: "Đóng phạt biên bản VIO-20261024-001: Late to meeting"
}
```

### Response Handling
```javascript
// SUCCESS case
{
  type: "TOPUP",
  reference: "violation-VIO-20261024-001-1729756800000",
  userId: "946236759522545665",
  amount: 50,
  reason: "...",
  status: "SUCCESS",
  duplicate: false
}
→ Mark violation as paid, send confirmations

// FAILED case (insufficient funds)
{
  type: "TOPUP",
  status: "FAILED",
  error: "Insufficient funds",
  duplicate: false
}
→ Reply to user with error

// Duplicate case
{
  status: "SUCCESS",
  duplicate: true
}
→ Reply "This payment was already processed"

// HTTP errors (409, 503)
→ Retry with exponential backoff (2s, 4s, 8s)
```

### Reference Format Rules
- Format: `violation-{violationId}-{timestamp}`
- Example: `violation-VIO-20261024-001-1729756800000`
- Must be unique per payment attempt
- 1-100 characters: `a-zA-Z0-9:_.-`
- Used to prevent duplicate payments

### Error Handling Strategy
1. **401 Unauthorized**: Log error, notify admin (API key invalid)
2. **403 Forbidden**: User is bot account or not in server
3. **404 Not Found**: User not found in server
4. **409 Conflict**: Retry after delay (concurrent request or reference conflict)
5. **503 Service Unavailable**: Retry after delay (bot starting up)
6. **200 + FAILED**: User has insufficient funds, show friendly error
7. **Network timeout**: Retry (safe due to reference-based deduplication)

---

## 5. Testing Approach

### Unit Testing (Manual via Commands)
Each command tested individually:
- Valid inputs → Success
- Invalid inputs → Appropriate errors
- Edge cases → Handled gracefully

### Integration Testing (Workflow)
Full user journeys:
1. Setup → Create → Notify → Pay → Verify
2. Reminders → Multiple users → Correct DMs sent
3. Voice join → Public notifications work

### Database Testing
- Indexes created properly
- Queries performant
- violationId uniqueness enforced
- Reminder time duplicates rejected

### API Testing
- Mock insufficient funds scenario
- Test retry logic with simulated 409/503
- Verify duplicate detection works
- Confirm reference format accepted

### Load Testing (Future)
- Multiple violations created concurrently
- Scheduler with many unpaid violations
- Many users joining voice simultaneously

---

## 6. Risk Assessment

### High Risk Items

**Risk 1: Payroll API Downtime During Payment**
- **Impact**: Users cannot pay violations
- **Mitigation**: 
  - Retry logic with exponential backoff
  - Clear error messages to users
  - Reference-based deduplication allows safe retries
  - Manual payment possible via admin

**Risk 2: Duplicate Payments**
- **Impact**: User charged twice for same violation
- **Mitigation**: 
  - Unique reference per payment attempt
  - Check `isPaid` status before calling API
  - API's built-in duplicate detection
  - Transaction-like pattern: only mark paid on SUCCESS

**Risk 3: Scheduler Sending Duplicate Reminders**
- **Impact**: Users spammed with DMs
- **Mitigation**:
  - Each cron job runs once per day per time
  - Track last reminder sent (future enhancement)
  - Users can block DMs if needed

### Medium Risk Items

**Risk 4: Voice Channel Text Channel Mapping**
- **Impact**: Notification sent to wrong channel or fails
- **Mitigation**:
  - Check channel type before sending
  - Fallback to default violations channel
  - Log failures without breaking voice join

**Risk 5: violationId Collision**
- **Impact**: Two violations get same ID
- **Mitigation**:
  - Include millisecond timestamp in counter
  - Unique index on violationId
  - Retry generation on collision (unlikely)

**Risk 6: MongoDB Connection Loss During Operation**
- **Impact**: Commands fail, data not saved
- **Mitigation**:
  - MongoDB client auto-reconnects
  - Graceful error messages to users
  - Operations can be retried

### Low Risk Items

**Risk 7: DM Sending Failures (User Blocked DMs)**
- **Impact**: User doesn't receive notification
- **Mitigation**:
  - Already expected behavior
  - Public announcement channel as backup
  - Voice join notifications are public

**Risk 8: Admin Deletes Announcement Channel**
- **Impact**: Announcements fail
- **Mitigation**:
  - Check channel exists before sending
  - Log warning
  - Violation still created successfully

---

## 7. File Structure Overview

```
src/features/violations/
├── commands/
│   ├── violationAuthorizedRoles.js    [Step 4]
│   ├── violationCreate.js              [Step 7]
│   ├── violationCheck.js               [Step 8]
│   ├── violationList.js                [Step 9]
│   ├── violationConfirmPayment.js      [Step 10]
│   ├── violationReminderTimes.js       [Step 5]
│   └── violationSetChannel.js          [Step 6]
├── services/
│   ├── violationService.js             [Step 3]
│   └── payrollViolationClient.js       [Step 2]
├── schedulers/
│   └── violationReminderScheduler.js   [Step 11]
└── index.js                             [Step 13]

src/database/
└── violations.js (rewrite)              [Step 1]

src/events/
└── voiceStateUpdate.js (modify)         [Step 12]

src/discord.js (modify)                  [Step 13]
src/index.js (modify)                    [Step 13]

scripts/
└── init-violation-system.js             [Step 15]
```

---

## 8. Implementation Dependencies Graph

```
Step 1 (Database Layer)
  ↓
Step 2 (Payroll Client) ←─┐
  ↓                        │
Step 3 (Service Layer)     │
  ↓ ↓ ↓ ↓ ↓ ↓ ↓           │
Steps 4-10 (Commands) ─────┘ (Step 10 depends on Step 2)
  ↓
Step 11 (Scheduler)
  ↓
Step 12 (Voice Events)
  ↓
Step 13 (Integration)
  ↓
Step 14 (Cleanup)
  ↓
Step 15 (Migration Script)
  ↓
Step 16 (Testing)
```

**Critical Path**: Steps 1 → 2 → 3 → 10 (payment flow)
**Parallel Work Possible**: Steps 4-9, 11 (after Step 3)

---

## 9. Key Design Decisions

### Decision 1: violationId Format (VIO-YYYYMMDD-XXX)
**Why**: Human-readable, sortable, unique per day
**Alternative considered**: UUID (rejected: not human-friendly)
**Trade-off**: Requires counter logic, but worth it for usability

### Decision 2: Anyone Can Pay Any Violation
**Why**: Allows friends to help each other
**Alternative considered**: Only violator can pay (rejected: too restrictive)
**Trade-off**: Potential for payment confusion, but Payroll API records payer

### Decision 3: Multiple Daily Reminder Times
**Why**: Flexibility for different time zones, multiple reminders/day
**Alternative considered**: Single fixed time (rejected: not flexible)
**Trade-off**: More complex scheduler logic, but better UX

### Decision 4: Public Voice Join Notifications
**Why**: Social pressure to pay fines, transparency
**Alternative considered**: Private DM only (rejected: less effective)
**Trade-off**: Public shaming aspect, but that's the feature intent

### Decision 5: Separate Collection for Config
**Why**: One config per guild, easier to query/update
**Alternative considered**: Store in violations collection (rejected: awkward schema)
**Trade-off**: Extra collection, but cleaner separation of concerns

### Decision 6: Use Payroll API /topup Instead of /deduct
**Why**: User initiates payment (topup from their wallet to bot), matches "confirm payment" UX
**Alternative considered**: /deduct (rejected: feels like bot taking money vs user giving)
**Trade-off**: None significant, both work technically

---

## 10. Post-Launch Enhancements (Future)

1. **Violation Categories**: Tag violations (late, absent, misbehavior) for reporting
2. **Auto-Escalation**: Increase fine for repeat offenders
3. **Payment Plans**: Allow partial payments over time
4. **Violation History Export**: Generate CSV/PDF reports
5. **Appeal System**: Let users contest violations (like fineReports)
6. **Reminder Throttling**: Max 1 reminder per user per day across all times
7. **Payment Deadline**: Auto-escalate or notify admins after X days unpaid
8. **Multi-Guild Support**: Proper guild isolation for bot in multiple servers
9. **Violation Templates**: Quick-create common violations
10. **Statistics Dashboard**: Aggregate stats (most fined user, total collected, etc.)

---

## 11. Success Criteria

The rebuild is successful when:

✅ All 7 commands work without errors
✅ Payroll API integration successfully processes payments
✅ Daily reminders send at configured times to correct users
✅ Voice join notifications appear in correct text channels
✅ Public announcements post when violations created
✅ Database schema supports all operations efficiently
✅ Old violation code removed without breaking name validation
✅ No payment duplicates occur
✅ Error handling provides clear user feedback
✅ Admin can manage system via Discord commands only

---

## 12. Rollback Plan

If critical issues arise:

1. **Immediate**: Disable scheduler in index.js (comment out initViolationReminderScheduler)
2. **Command Issues**: Remove problem commands from discord.js registration
3. **Payment Issues**: Disable violationConfirmPayment command
4. **Complete Rollback**: 
   - Restore old violations.js from backup
   - Re-enable old violationChecker
   - Remove violation feature from discord.js/index.js
   - Keep new collections (no data loss) for future fix

---

## 13. Documentation Requirements

Post-implementation:

1. **User Guide**: `/violation-help` command or embed explaining system
2. **Admin Guide**: How to set up (roles, times, channel)
3. **API Documentation**: Update doc/api/internal/ with violation endpoints (if REST API added)
4. **Code Comments**: JSDoc for all public functions
5. **README Update**: Add violations section to project README
6. **Changelog**: Document what changed from old system

---

## Estimated Timeline

- **Steps 1-3**: 4-6 hours (foundation)
- **Steps 4-10**: 6-8 hours (commands)
- **Steps 11-12**: 3-4 hours (scheduler + events)
- **Steps 13-14**: 2-3 hours (integration + cleanup)
- **Steps 15-16**: 2-3 hours (migration + testing)

**Total**: 17-24 hours of focused development

---

## Conclusion

This implementation plan completely rebuilds the violation system from a name-validation enforcement tool into a comprehensive fine management system with Payroll API integration. The plan follows the existing codebase patterns (fineReports structure, payroll API client approach, MongoDB usage) while introducing new features (payment confirmation, multi-time reminders, voice notifications).

The ordered, dependency-aware steps ensure each component builds on stable foundations. The risk assessment identifies potential issues with mitigation strategies. The clear success criteria provide measurable goals.

Ready for implementation in sequential order.
