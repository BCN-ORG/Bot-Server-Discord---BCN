# Discord Bot - Architecture Overview

Tổng quan kiến trúc hệ thống Discord Bot với các features chính.

---

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Discord Platform                              │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ Gateway Events
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Discord Bot Application                          │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │                    Event Handlers                               │   │
│  │  - guildMemberAdd      - messageCreate                         │   │
│  │  - guildMemberUpdate   - voiceStateUpdate                      │   │
│  │  - interactionCreate   - ...                                   │   │
│  └────────┬─────────────────────────────────────┬─────────────────┘   │
│           │                                     │                      │
│           ▼                                     ▼                      │
│  ┌─────────────────────┐           ┌──────────────────────┐          │
│  │  Name Validation    │           │   Payroll System     │          │
│  │     Feature         │           │      Feature         │          │
│  └─────────────────────┘           └──────────────────────┘          │
│           │                                     │                      │
│           │                                     │                      │
│  ┌────────┴─────────────────────────────────────┴─────────────────┐  │
│  │                    Services Layer                               │  │
│  │  - nameValidationService                                        │  │
│  │  - payrollService                                               │  │
│  │  - apiClient                                                    │  │
│  └────────┬────────────────────────────────────────────────────────┘  │
│           │                                                            │
│           ▼                                                            │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                    Database Layer                                │ │
│  │  - violations.js    - payroll.js    - settings.js               │ │
│  └────────┬────────────────────────────────────────────────────────┘ │
│           │                                                            │
└───────────┼────────────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────┐         ┌──────────────────────┐
│    MongoDB Atlas          │         │   External APIs      │
│  - violations             │         │  - Payroll API       │
│  - salary_*               │         │    (Viện kiểm sát)   │
│  - server_settings        │         └──────────────────────┘
└───────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         Background Jobs (node-cron)                     │
│  - violationChecker (mỗi 6h)  - payrollScheduler (hàng tuần)           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Core Modules

### 1. **Entry Point** (`src/index.js`)
- Khởi tạo Discord client
- Connect MongoDB
- Setup event handlers
- Start schedulers

### 2. **Discord Integration** (`src/discord.js`)
- Register slash commands
- Handle interactions (commands, buttons, modals)
- Route events to appropriate handlers

### 3. **Event System** (`src/events/`)
- `guildMemberAdd.js` - Member join → validate nickname
- `guildMemberUpdate.js` - Nickname changed → re-validate
- `messageCreate.js` - First message → prompt rename if invalid
- `voiceStateUpdate.js` - Voice join → check nickname

### 4. **Features** (`src/features/`)

#### 4.1 Name Validation (`rename/`)
- **Command**: `/rename` - Đổi nickname
- **Modal**: Input form với validation
- **Service**: Check format, manage violations
- **Scheduler**: Auto-kick sau 48h

#### 4.2 Payroll System (`payroll/`)
- **Commands**: `/salary-coefficient`, `/salary-roles`, `/salary-schedule`, `/salary-payout-now`
- **Service**: Calculate salary, call API, track history
- **Scheduler**: Weekly automated payroll
- **API Client**: Integrate với external Payroll API

### 5. **Services Layer** (`src/services/`)
- `nameValidationService.js` - Business logic cho name validation
- Các services khác của features

### 6. **Database Layer** (`src/database/`)
- `mongodb.js` - Connection & initialization
- `violations.js` - CRUD cho name violations
- `payroll.js` - CRUD cho payroll (4 collections)
- `settings.js` - Server settings

### 7. **Schedulers** (`src/schedulers/`)
- `violationChecker.js` - Check & kick expired violations
- Payroll scheduler được integrate trong feature

### 8. **Constants** (`src/constants/`)
- `emojis.js` - Common emojis
- Các constants khác

---

## 🔄 Data Flow Examples

### Example 1: Member Join Flow
```
1. Discord → guildMemberAdd event
2. Bot → checkMemberNickname()
3. Invalid? → createViolation() → MongoDB
4. Bot → Send welcome message with rename button
5. User clicks button → Show modal
6. User submits → Validate → Update nickname
7. Valid? → deleteViolation() → MongoDB
```

### Example 2: Weekly Payroll Flow
```
1. Cron job triggers (Monday 00:00)
2. payrollScheduler → processWeeklyPayroll()
3. Get eligible roles from MongoDB
4. Collect unique members (deduplicate)
5. For each member:
   a. Calculate total salary coefficient
   b. Call Payroll API
   c. Save history to MongoDB
6. Log summary (success/failed/skipped)
```

### Example 3: Violation Auto-Kick Flow
```
1. Cron job triggers (every 6 hours)
2. violationChecker → getExpiredViolations()
3. MongoDB returns violations > 48h old
4. For each violation:
   a. Send DM notification (if possible)
   b. Kick member from server
   c. Delete violation from MongoDB
5. Log results
```

---

## 🗄️ Database Collections

### MongoDB: `discord-bot` database

| Collection | Purpose | Key Fields |
|------------|---------|------------|
| `violations` | Track nickname violations | `userId`, `firstViolationAt`, `status` |
| `salary_coefficients` | Role salary multipliers | `roleId`, `coefficient` |
| `salary_eligible_roles` | Roles eligible for salary | `roleId`, `addedAt` |
| `salary_config` | Payroll schedule config | `dayOfWeek`, `hour`, `timezone` |
| `salary_history` | Payment records | `userId`, `amount`, `paidAt`, `status` |
| `server_settings` | General bot settings | `guildId`, `settings` |

---

## 🔌 External Integrations

### 1. Discord API (discord.js v14)
- Gateway events
- Slash commands
- Modals & buttons
- Member management

### 2. Payroll API (Viện kiểm sát bot)
- **Base**: `http://host:3000/api/payroll`
- **Auth**: `x-api-key` header
- **Endpoints**:
  - `POST /transfer` - Trả lương
  - `GET /balance` - Check ví
  - `GET /payouts` - Lịch sử

### 3. MongoDB Atlas
- **Driver**: Native MongoDB Node.js driver
- **Connection**: Via `MONGODB_URI` env var
- **Database**: `discord-bot`

---

## ⚙️ Configuration

### Environment Variables (`.env`)
```env
# Discord
DISCORD_TOKEN=<bot_token>
CLIENT_ID=<app_id>
GUILD_ID=<server_id>

# MongoDB
MONGODB_URI=mongodb+srv://...
MONGODB_DB_NAME=discord-bot

# Name Validation
VALIDATION_EXCEPTION_UIDS=uid1,uid2,uid3

# Payroll
PAYROLL_API_KEY=<api_key>
PAYROLL_API_BASE_URL=http://host:3000/api/payroll
```

### Scheduler Timings
- **Violation Checker**: Mỗi 6 giờ (`0 */6 * * *`)
- **Payroll**: Configurable (default: Monday 00:00)

---

## 🛡️ Security & Permissions

### Bot Permissions Required
- `MANAGE_NICKNAMES` - Đổi nickname members
- `KICK_MEMBERS` - Kick vi phạm sau 48h
- `SEND_MESSAGES` - Gửi thông báo
- `EMBED_LINKS` - Gửi embeds
- `VIEW_CHANNEL` - Đọc channels

### Admin Commands
Các lệnh `/salary-*` yêu cầu `Administrator` permission.

### API Security
- Payroll API key trong `.env` (không commit)
- MongoDB credentials trong separate file (`atlas-credentials.env`)

---

## 📊 Monitoring & Logging

### Log Levels
- `[INFO]` - Normal operations
- `[WARN]` - Non-critical issues (low balance, DM failed)
- `[ERROR]` - Critical errors (API failed, DB error)
- `[SCHEDULER]` - Cron job activities
- `[Payroll]` - Payroll-specific logs
- `[MongoDB]` - Database operations

### Key Metrics to Monitor
- Violation count (active)
- Payroll success rate
- API response times
- Bot wallet balance
- Member kick rate

---

## 🚀 Deployment

### Prerequisites
- Node.js 18+ (for native fetch)
- MongoDB Atlas account
- Discord Bot Token
- Payroll API credentials

### Setup Steps
1. Clone repository
2. `npm install`
3. Configure `.env` file
4. Run `node src/index.js`
5. Bot auto-registers slash commands

### Health Checks
- Bot shows "online" in Discord
- Slash commands appear in server
- Schedulers log initialization
- MongoDB connection confirmed

---

## 📚 Documentation Links

- [Features Overview](./features/README.md)
- [Payroll System](./features/payroll/PAYROLL_SYSTEM.md)
- [Name Validation System](./features/name-validation/NAME_VALIDATION_SYSTEM.md)
- [Payroll API Reference](./api/PAYROLL_API.md)

---

*Cập nhật lần cuối: 2026-10-18*
