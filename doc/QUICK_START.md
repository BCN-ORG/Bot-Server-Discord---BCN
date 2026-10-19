# Quick Start Guide

Hướng dẫn nhanh để setup và sử dụng Discord Bot.

---

## 🚀 Setup (5 phút)

### 1. Prerequisites
```bash
# Cần có:
- Node.js 18+ 
- npm hoặc yarn
- MongoDB Atlas account
- Discord Bot Token
```

### 2. Installation
```bash
# Clone repo
git clone <repo-url>
cd "Discord Bot"

# Install dependencies
npm install
```

### 3. Configuration

**File `.env`** (tạo từ template hoặc có sẵn):
```env
# Discord (REQUIRED)
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_app_id
GUILD_ID=your_server_id

# MongoDB (REQUIRED)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net
MONGODB_DB_NAME=discord-bot

# Name Validation (OPTIONAL)
VALIDATION_EXCEPTION_UIDS=uid1,uid2

# CORS (OPTIONAL; comma-separated browser origins)
CORS_ALLOWED_ORIGINS=http://localhost:1,http://localhost:0

# API authentication (REQUIRED for birthday endpoints; comma-separated keys)
API_KEYS=replace_with_a_long_random_key

# Payroll (REQUIRED for payroll feature)
PAYROLL_API_KEY=your_api_key
PAYROLL_API_BASE_URL=http://host:3000/api/payroll
```

Khi thay/rotate key trong env, khởi động lại server để áp dụng cấu hình mới.

### 4. Run
```bash
node src/index.js
```

**Success indicators**:
```
[INFO] Connected to MongoDB
[INFO] Dang dang ky lenh slash commands...
[SUCCESS] Da dang ky lenh thanh cong!
[Payroll] Initializing payroll scheduler...
[INFO] Payroll scheduler initialized
[INFO] Bot đang hoạt động!
```

---

## 📖 Quick Reference

### Features Overview

| Feature | Commands | Auto Actions |
|---------|----------|--------------|
| **Name Validation** | `/rename` | Check on join, kick after 48h |
| **Payroll System** | `/salary-coefficient`<br>`/salary-roles`<br>`/salary-schedule`<br>`/salary-payout-now` | Weekly auto-pay |

---

## 🎯 Common Tasks

### Task 1: Add role eligible for salary
```
1. Dùng lệnh: /salary-roles add @RoleName
2. (Optional) Set coefficient: /salary-coefficient @RoleName 2
3. Done! Role sẽ được trả lương từ tuần sau
```

### Task 2: Manual payroll test
```
1. Configure eligible roles (see Task 1)
2. Run: /salary-payout-now
3. Check logs và history trong DB
```

### Task 3: Check violation status
```
1. Check MongoDB collection: violations
2. Hoặc check logs khi member join/update nickname
3. Scheduler tự động kick sau 48h
```

### Task 4: Add exception user (bypass name check)
```
1. Lấy user ID (Discord Developer Mode)
2. Add vào .env: VALIDATION_EXCEPTION_UIDS=uid1,uid2,uid3
3. Restart bot
```

### Task 5: Change payroll schedule
```
1. Dùng lệnh: /salary-schedule <day> <hour>
   Example: /salary-schedule monday 0
2. Scheduler tự động restart với lịch mới
```

---

## 🗂️ File Structure (Important Files)

```
Discord Bot/
├── .env                              # ⚙️ Config (KHÔNG commit)
├── src/
│   ├── index.js                      # 🚀 Entry point
│   ├── discord.js                    # 🔌 Command registration
│   ├── database/
│   │   ├── mongodb.js                # 🗄️ DB connection
│   │   ├── violations.js             # Name violations
│   │   └── payroll.js                # Salary data
│   ├── features/
│   │   ├── rename/                   # ✏️ Name validation feature
│   │   └── payroll/                  # 💰 Payroll feature
│   ├── events/                       # 📡 Discord event handlers
│   ├── services/                     # 🔧 Business logic
│   └── schedulers/                   # ⏰ Cron jobs
└── doc/                              # 📚 Full documentation
    ├── ARCHITECTURE.md               # System overview
    ├── features/
    │   ├── payroll/PAYROLL_SYSTEM.md
    │   └── name-validation/NAME_VALIDATION_SYSTEM.md
    └── api/PAYROLL_API.md
```

---

## 🐛 Troubleshooting

### Bot không online?
```
✓ Check DISCORD_TOKEN đúng chưa
✓ Bot có được invite vào server chưa?
✓ Check logs: [ERROR] messages
```

### Commands không hiện?
```
✓ CLIENT_ID và GUILD_ID đúng chưa?
✓ Bot có permissions Application Commands?
✓ Đợi vài phút để Discord sync
✓ Kick bot ra và invite lại
```

### MongoDB connection failed?
```
✓ Check MONGODB_URI format
✓ Whitelist IP trong MongoDB Atlas
✓ Check username/password đúng chưa
```

### Payroll API errors?
```
✓ Check PAYROLL_API_KEY và BASE_URL
✓ Check API có online không (curl test)
✓ Check bot wallet có đủ tiền không: GET /balance
```

### Scheduler không chạy?
```
✓ Check logs khởi động có "[Payroll] Initializing..."
✓ Check cron expression đúng format
✓ Test bằng /salary-payout-now
```

---

## 📊 Monitoring

### Check Bot Health
```bash
# Logs sẽ show:
- [INFO] Bot đang hoạt động!
- [Payroll] Schedule: Monday at 00:00
- [INFO] Violation checker running every 6 hours
```

### Check Database
```javascript
// MongoDB collections:
- violations (should have active violations or empty)
- salary_coefficients (should have role configs)
- salary_eligible_roles (should have eligible roles)
- salary_history (should grow after payouts)
```

### Test Commands
```
✓ /rename - Should show modal
✓ /salary-roles list - Should show configured roles
✓ /salary-payout-now - Should process payroll (Admin only)
```

---

## 🔐 Security Notes

### ⚠️ NEVER commit these files:
- `.env` (contains tokens & keys)
- `atlas-credentials.env` (MongoDB credentials)
- Any file with API keys

### ✅ Safe to commit:
- Source code (`.js` files)
- Documentation (`.md` files)
- `package.json`, `package-lock.json`

### 🔒 API Key Rotation:
```
1. Get new key từ Payroll API admin
2. Update .env: PAYROLL_API_KEY=new_key
3. Restart bot
4. Old key invalid immediately
```

---

## 📚 Learn More

- **Full Documentation**: [`doc/README.md`](./README.md)
- **Architecture**: [`doc/ARCHITECTURE.md`](./ARCHITECTURE.md)
- **Payroll System**: [`doc/features/payroll/PAYROLL_SYSTEM.md`](./features/payroll/PAYROLL_SYSTEM.md)
- **Name Validation**: [`doc/features/name-validation/NAME_VALIDATION_SYSTEM.md`](./features/name-validation/NAME_VALIDATION_SYSTEM.md)

---

## 💡 Tips

1. **Test in Development Server First**: Tạo test server riêng trước khi deploy production
2. **Monitor Logs**: Luôn check logs khi có vấn đề
3. **Backup Database**: Export MongoDB collections định kỳ
4. **Version Control**: Commit thường xuyên, tạo branches cho features mới
5. **Documentation**: Update docs khi thay đổi logic hoặc thêm features

---

## 🆘 Need Help?

1. Check logs trong console
2. Đọc documentation chi tiết trong `doc/`
3. Check MongoDB collections để debug data
4. Test từng feature riêng lẻ
5. Liên hệ team lead nếu cần support

---

*Happy coding! 🚀*

*Cập nhật lần cuối: 2026-10-18*
