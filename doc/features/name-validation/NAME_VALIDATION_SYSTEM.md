# Hệ Thống Kiểm Tra & Quản Lý Tên (Name Validation System)

> 📝 **Trạng thái**: Đang tài liệu hóa từ code hiện có

## Tổng quan

Hệ thống tự động kiểm tra nickname của thành viên Discord theo quy tắc đặt tên, quản lý vi phạm và tự động kick sau 48 giờ nếu không sửa.

### Đặc điểm chính

- ✅ **Tự động kiểm tra**: Khi member join, đổi nickname, hoặc nhắn tin
- ✅ **Rename workflow**: Modal để member tự nhập tên đúng format
- ✅ **Vi phạm tracking**: Lưu thời gian vi phạm đầu tiên, theo dõi 48h
- ✅ **Auto-kick**: Scheduler chạy định kỳ, kick member hết hạn
- ✅ **Exception list**: Whitelist user IDs được miễn trừ kiểm tra

---

## Quy tắc đặt tên

### Format yêu cầu
```
Họ Tên Đệm Tên
```

### Ràng buộc
- **Số từ**: 2-5 từ (ví dụ: "Nguyen Van A" ✅, "A" ❌)
- **Ký tự**: Chỉ chữ cái tiếng Việt (có hoặc không dấu)
- **Không cho phép**: Số, emoji, ký tự đặc biệt
- **Viết hoa**: Mỗi từ viết hoa chữ cái đầu

### Ví dụ

| Nickname | Hợp lệ | Lý do |
|----------|--------|-------|
| `Nguyen Minh Vu` | ✅ | Đúng format |
| `Nguyen Van A` | ✅ | 3 từ, chỉ chữ cái |
| `Vu` | ❌ | Chỉ 1 từ (cần 2-5) |
| `Nguyen123` | ❌ | Có số |
| `Vu🔥` | ❌ | Có emoji |

---

## Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────┐
│                      Discord Bot                             │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Events (guildMemberAdd, etc.)             │ │
│  └────────────────────────────────────────────────────────┘ │
│         │                                                    │
│         ▼                                                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │        nameValidationService.js                        │ │
│  │  - checkMemberNickname()                               │ │
│  │  - handleInvalidNickname()                             │ │
│  │  - handleValidNickname()                               │ │
│  └────────────────────────────────────────────────────────┘ │
│         │                                                    │
│         ▼                                                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           violations.js (MongoDB)                      │ │
│  │  - createViolation()                                   │ │
│  │  - deleteViolation()                                   │ │
│  │  - getExpiredViolations()                              │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │       violationChecker.js (Scheduler)                  │ │
│  │  - Chạy mỗi 6 giờ                                      │ │
│  │  - Kick members hết hạn 48h                            │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         rename/ (Feature Module)                       │ │
│  │  - /rename command                                     │ │
│  │  - Modal nhập tên                                      │ │
│  │  - Validate & update nickname                          │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Luồng nghiệp vụ

### 1. Member Join Server

```
1. EVENT: guildMemberAdd
   └─► handleGuildMemberAdd(member)

2. CHECK NICKNAME
   └─► checkMemberNickname(member)
       ├─► Lấy displayName
       ├─► Kiểm tra exception list
       ├─► Validate theo quy tắc
       └─► Return { valid: boolean, nickname: string }

3a. VALID ✅
    └─► Không làm gì

3b. INVALID ❌
    └─► handleInvalidNickname(member, nickname)
        ├─► Tạo violation record (DB)
        │   └─ { userId, guildId, firstViolationAt, notifiedAt: [] }
        │
        └─► Gửi thông báo vào kênh "huong-dan"
            ├─ Embed: Yêu cầu đổi tên
            ├─ Button: "Nhập họ và tên"
            └─ Hạn: 48 giờ
```

### 2. Member Đổi Nickname

```
1. EVENT: guildMemberUpdate
   └─► if (nickname changed)

2. CHECK NICKNAME
   └─► checkMemberNickname(member)

3a. NOW VALID ✅
    └─► handleValidNickname(member)
        ├─► Xóa violation (nếu có)
        └─► Gửi DM chúc mừng (optional)

3b. STILL INVALID ❌
    └─► handleInvalidNickname(member, nickname)
        └─► Update notifiedAt, gửi nhắc nhở
```

### 3. Member Nhắn Tin (First Message)

```
1. EVENT: messageCreate
   └─► if (first message from this user)

2. CHECK NICKNAME
   └─► checkMemberNickname(member)

3. INVALID ❌
   └─► Gửi reply với button "Đổi tên ngay"
```

### 4. Scheduler - Auto Kick

```
1. CRON JOB (mỗi 6 giờ)
   └─► violationChecker.checkViolations(client)

2. GET EXPIRED
   └─► getExpiredViolations(guildId)
       └─► Lấy violations có firstViolationAt > 48h

3. KICK MEMBERS
   ├─► For each violation:
   │   ├─► Gửi DM thông báo (nếu được)
   │   ├─► Kick khỏi server
   │   └─► Xóa violation record
   │
   └─► Log kết quả
```

### 5. Rename Command & Modal

```
1. USER: /rename (hoặc bấm button)

2. SHOW MODAL
   └─► Modal với input field "Họ và tên"

3. USER: Submit modal

4. VALIDATE
   └─► validateName(input)
       ├─► Check format
       └─► Return { valid, reason }

5a. VALID ✅
    └─► Update nickname
        ├─► member.setNickname(newName)
        ├─► Xóa violation
        └─► Reply success

5b. INVALID ❌
    └─► Reply với lý do lỗi
```

---

## Database Schema

### Collection: `violations`

```javascript
{
  _id: ObjectId,
  userId: "123456789",           // Discord user ID
  guildId: "987654321",          // Discord guild ID
  nickname: "InvalidName123",    // Tên không hợp lệ
  firstViolationAt: ISODate("2026-10-15T10:00:00Z"),
  notifiedAt: [                   // Lịch sử thông báo
    ISODate("2026-10-15T10:00:00Z"),
    ISODate("2026-10-16T10:00:00Z")
  ],
  status: "active",               // active | resolved
  createdAt: ISODate("2026-10-15T10:00:00Z"),
  updatedAt: ISODate("2026-10-16T10:00:00Z")
}
```

### Indexes
```javascript
{ userId: 1, guildId: 1 }        // Unique
{ firstViolationAt: 1 }          // For expiry queries
{ status: 1 }
```

---

## Configuration

### Environment Variables

```env
# Exception list - User IDs được miễn trừ kiểm tra
VALIDATION_EXCEPTION_UIDS=946236759522545665,1202579919196917812
```

### Scheduler Config

- **Tần suất**: Mỗi 6 giờ
- **Cron**: `0 */6 * * *`
- **Thời hạn vi phạm**: 48 giờ (2880 phút)

---

## Commands & Interactions

### Slash Command: `/rename`

**Mô tả**: Đổi nickname theo format yêu cầu

**Flow**:
1. User gõ `/rename`
2. Bot hiện modal với input field
3. User nhập tên mới
4. Bot validate và update

**Permissions**: Không yêu cầu (mọi member)

### Button: "Nhập họ và tên" / "Đổi tên ngay"

**Trigger**: Bấm button trong embed
**Action**: Mở rename modal (giống `/rename`)

---

## Files liên quan

### Core Logic
- `src/services/nameValidationService.js` - Validation & violation handling
- `src/database/violations.js` - MongoDB CRUD cho violations

### Events
- `src/events/guildMemberAdd.js` - Check khi join
- `src/events/guildMemberUpdate.js` - Check khi đổi nickname
- `src/events/messageCreate.js` - Check khi nhắn tin đầu tiên
- `src/events/voiceStateUpdate.js` - Check khi vào voice channel

### Feature Module
- `src/features/rename/command.js` - /rename command
- `src/features/rename/modal.js` - Modal UI
- `src/features/rename/validate.js` - Name validation logic
- `src/features/rename/index.js` - Export module

### Scheduler
- `src/schedulers/violationChecker.js` - Auto-kick scheduler

---

## Edge Cases & Error Handling

### 1. Member rời server trước khi kick
- Violation vẫn tồn tại trong DB
- Scheduler log "Member not found" và xóa violation

### 2. Bot không có quyền kick
- Log error
- Không xóa violation (retry lần sau)

### 3. Bot không có quyền đổi nickname
- Hiện lỗi khi user submit modal
- Không xóa violation

### 4. Member trong exception list
- Bỏ qua validation hoàn toàn
- Không tạo violation

### 5. DM bị tắt
- Không gửi DM
- Vẫn kick bình thường
- Log warning

### 6. Duplicate violation
- Không tạo mới
- Update `notifiedAt` array

---

## Testing Checklist

- [ ] Member mới join với tên sai → Tạo violation
- [ ] Member join với tên đúng → Không tạo violation
- [ ] Member đổi từ sai → đúng → Xóa violation
- [ ] Member đổi từ đúng → sai → Tạo violation
- [ ] Scheduler kick member hết hạn 48h
- [ ] `/rename` với tên hợp lệ → Update thành công
- [ ] `/rename` với tên không hợp lệ → Hiện lỗi
- [ ] Exception user bypass validation
- [ ] Button mở modal đúng
- [ ] DM thông báo kick gửi được

---

*Cập nhật lần cuối: 2026-10-18*
