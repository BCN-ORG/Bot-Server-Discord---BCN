# Features Documentation

Tài liệu chi tiết về các tính năng của Discord Bot.

---

## 📦 Danh sách Features

### 1. 💰 Payroll System (Trả lương tự động)
📄 **[PAYROLL_SYSTEM.md](./payroll/PAYROLL_SYSTEM.md)**

**Mô tả**: Hệ thống tự động trả lương hàng tuần cho members có role được cấu hình, tích hợp với Payroll API.

**Trạng thái**: ✅ **Hoàn thành**

**Highlights**:
- Tự động chạy theo lịch (mặc định: Thứ 2, 0h00)
- Tính tổng hệ số từ nhiều roles
- Deduplicate users tự động
- Retry logic cho API calls
- 4 admin commands quản lý

**Tech Stack**:
- Node-cron (scheduler)
- MongoDB (4 collections)
- Payroll API (external)
- Discord.js slash commands

---

### 2. ✏️ Name Validation System (Kiểm tra & quản lý tên)
📄 **[NAME_VALIDATION_SYSTEM.md](./name-validation/NAME_VALIDATION_SYSTEM.md)**

**Mô tả**: Hệ thống tự động kiểm tra nickname members theo quy tắc, theo dõi vi phạm và auto-kick sau 48h.

**Trạng thái**: ✅ **Đã triển khai** (đang tài liệu hóa)

**Highlights**:
- Validate nickname format (2-5 từ, chỉ chữ cái)
- Theo dõi vi phạm với deadline 48h
- Scheduler tự động kick members hết hạn
- Rename modal với validation
- Exception list (whitelist)

**Tech Stack**:
- MongoDB (violations collection)
- Node-cron (violation checker)
- Discord.js modals & events
- Validation service

---

## 🗂️ Cấu trúc Source Code

### Payroll System
```
src/
├── features/payroll/
│   ├── index.js                      # Export module
│   ├── scheduler.js                  # Cron job
│   ├── commands/
│   │   ├── salaryCoefficient.js     # /salary-coefficient
│   │   ├── salaryRoles.js           # /salary-roles
│   │   ├── salarySchedule.js        # /salary-schedule
│   │   └── salaryPayoutNow.js       # /salary-payout-now
│   └── services/
│       ├── apiClient.js             # Payroll API client
│       └── payrollService.js        # Business logic
├── database/
│   └── payroll.js                    # MongoDB CRUD
└── schedulers/
    └── (payroll scheduler integrated in feature)
```

### Name Validation System
```
src/
├── features/rename/
│   ├── index.js                      # Export module
│   ├── command.js                    # /rename command
│   ├── modal.js                      # Modal UI
│   └── validate.js                   # Name validation
├── services/
│   └── nameValidationService.js      # Core validation logic
├── database/
│   └── violations.js                 # MongoDB CRUD
├── events/
│   ├── guildMemberAdd.js            # Check on join
│   ├── guildMemberUpdate.js         # Check on nickname change
│   ├── messageCreate.js             # Check on first message
│   └── voiceStateUpdate.js          # Check on voice join
└── schedulers/
    └── violationChecker.js          # Auto-kick scheduler
```

---

## 🚀 Quick Links

| Feature | Doc | Code Entry | Commands |
|---------|-----|------------|----------|
| **Payroll** | [📄](./payroll/PAYROLL_SYSTEM.md) | `src/features/payroll/index.js` | `/salary-*` (4 lệnh) |
| **Name Validation** | [📄](./name-validation/NAME_VALIDATION_SYSTEM.md) | `src/features/rename/index.js` | `/rename` |

---

## 📝 Guidelines cho Documentation

Khi viết docs cho feature mới, bao gồm các phần:

1. **Tổng quan**
   - Mục đích chính
   - Đặc điểm nổi bật
   - Trạng thái (đang phát triển / hoàn thành)

2. **Kiến trúc**
   - Architecture diagram (ASCII/Mermaid)
   - Components chính
   - Dependencies

3. **Luồng nghiệp vụ**
   - Sequence flows
   - Business rules
   - Edge cases

4. **Database**
   - Collections schema
   - Indexes
   - Relationships

5. **API/Commands**
   - Slash commands
   - Event handlers
   - External APIs

6. **Configuration**
   - Environment variables
   - Settings
   - Defaults

7. **Testing**
   - Test scenarios
   - Edge cases
   - Validation checklist

---

*Cập nhật lần cuối: 2026-10-18*
