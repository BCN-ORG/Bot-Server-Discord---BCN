# Hệ Thống Trả Lương Tự Động (Payroll System)

## Tổng quan

Hệ thống trả lương tự động cho Discord Bot cho phép tự động trả coin hàng tuần cho các thành viên có role được cấu hình. Hệ thống tích hợp với Payroll API của bot "Viện kiểm sát" để thực hiện giao dịch.

### Đặc điểm chính

- **Tự động**: Chạy theo lịch hàng tuần (mặc định: Thứ Hai 00:00)
- **Linh hoạt**: Quản trị viên có thể cấu hình role, hệ số lương và lịch trình
- **An toàn**: Chống trả lương trùng lặp, retry tự động, logging đầy đủ
- **Kiểm tra**: Lệnh thủ công để test và trả lương ngoài lịch

---

## Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────┐
│                      Discord Bot                             │
│                                                              │
│  ┌────────────────┐         ┌──────────────────┐           │
│  │   Scheduler    │────────►│ Payroll Service  │           │
│  │  (node-cron)   │         │                  │           │
│  └────────────────┘         └──────────────────┘           │
│         │                            │                      │
│         │                            ▼                      │
│         │                    ┌──────────────────┐          │
│         │                    │   API Client     │          │
│         │                    │  (fetch + retry) │          │
│         │                    └──────────────────┘          │
│         │                            │                      │
│         ▼                            │                      │
│  ┌────────────────┐                 │                      │
│  │    MongoDB     │                 │                      │
│  │  - coefficients│                 │                      │
│  │  - eligible_roles                │                      │
│  │  - config      │                 │                      │
│  │  - history     │                 │                      │
│  └────────────────┘                 │                      │
│                                     │                      │
└─────────────────────────────────────┼──────────────────────┘
                                      │
                                      ▼
                           ┌──────────────────────┐
                           │   Payroll API        │
                           │ (Viện kiểm sát bot)  │
                           └──────────────────────┘
```

---

## Quy trình nghiệp vụ

### Luồng trả lương tự động

```
1. SCHEDULER TRIGGER
   └─► Cron job kích hoạt vào thời gian đã cấu hình

2. GET CONFIGURATION
   ├─► Lấy danh sách role đủ điều kiện từ DB (salary_eligible_roles)
   └─► Lấy bảng hệ số lương từ DB (salary_coefficients)

3. GET MEMBERS
   ├─► Fetch đầy đủ guild members qua Discord API (không chỉ dùng cache)
   ├─► Lọc members đang có ít nhất một role đủ điều kiện
   └─► Deduplicate theo Discord user ID

   Trước khi phát:
   ├─► Đọc salary_history của kỳ tuần hiện tại (YYYY-Www)
   └─► Bỏ qua user đã có bản ghi SUCCESS

4. PROCESS EACH MEMBER
   ├─► Lọc các role đủ điều kiện mà user có
   │   
   ├─► Tính tổng lương:
   │   ├─ Duyệt tất cả role user đang có
   │   ├─ Dùng hệ số trong salary_coefficients nếu có, nếu không thì mặc định = 1
   │   ├─ Tổng = coefficient_role_1 + coefficient_role_2 + ...
   │   └─ Cap tối đa 100 coins
   │
   ├─► Chọn role đầu tiên để gọi API
   │
   ├─► Gọi API trả lương:
   │   ├─ POST /transfer với userId dạng Discord ID số (chuỗi), roleId, amount
   │   ├─ Retry 3 lần nếu 409/503
   │   └─ Nhận response
   │
   └─► Lưu lịch sử vào DB (salary_history)
       ├─ SUCCESS: Trả thành công
       ├─ DUPLICATE: Đã trả trong kỳ tuần này
       ├─ NO_ROLE / NOT_IN_SERVER: bỏ qua member, tiếp tục
       ├─ FAILED: API không chuyển được tiền, dừng đợt phát
       └─ ERROR: Network/system error, dừng đợt phát

5. SUMMARY
   └─► Log và trả về tổng kết: total, success, failed, skipped, alreadyPaid, unprocessed
```

Payroll cần bật `GuildMembers` intent trong code và **Server Members Intent** trong Discord Developer Portal để fetch đầy đủ member, bao gồm người offline/chưa có trong cache. Nếu fetch danh sách member thất bại, đợt phát dừng thay vì xử lý danh sách không đầy đủ.

### Xử lý deduplicate

User có nhiều role:
- **Chỉ xử lý 1 lần** trong mỗi đợt trả lương
- **Tính tổng hệ số** của TẤT CẢ các role user đang có; role chưa cấu hình hệ số tính là 1
- **Chọn role đầu tiên** để gọi API (API chỉ nhận 1 role/lần)

**Ví dụ:**
```
User A có role: "Sao đỏ" (hệ số 2), "Sao vàng" (hệ số 3), "Thành viên" (chưa cấu hình)
→ Tổng lương: 2 + 3 + 1 = 6 coins
→ Gọi API với roleId của "Sao đỏ" (role đầu tiên)
→ Nếu đã trả trong tuần này: API trả về duplicate=true, không trừ tiền
```

---

## Schema Database

### Collection: `salary_coefficients`

Lưu hệ số lương của từng role.

| Field | Type | Description |
|-------|------|-------------|
| `roleId` | string | Discord role ID (snowflake) |
| `roleName` | string | Tên role (để hiển thị) |
| `coefficient` | number | Hệ số lương (1-100) |
| `updatedAt` | Date | Thời điểm cập nhật |
| `updatedBy` | string | User ID người cập nhật |

**Index**: `roleId` (unique)

---

### Collection: `salary_eligible_roles`

Danh sách role được trả lương.

| Field | Type | Description |
|-------|------|-------------|
| `roleId` | string | Discord role ID |
| `roleName` | string | Tên role |
| `addedAt` | Date | Thời điểm thêm |
| `addedBy` | string | User ID người thêm |

**Index**: `roleId` (unique)

---

### Collection: `salary_config`

Cấu hình lịch trả lương (singleton document).

| Field | Type | Description |
|-------|------|-------------|
| `_id` | string | `"schedule"` (fixed) |
| `dayOfWeek` | number | 0=Sunday, 1=Monday, ..., 6=Saturday |
| `hour` | number | Giờ chạy (0-23) |
| `timezone` | string | `"Asia/Ho_Chi_Minh"` |
| `updatedAt` | Date | Thời điểm cập nhật |
| `updatedBy` | string | User ID người cập nhật |

**Default**: Monday (1) at 00:00

---

### Collection: `salary_history`

Lịch sử trả lương.

| Field | Type | Description |
|-------|------|-------------|
| `guildId` | string | Discord guild ID |
| `userId` | string | Discord user ID chỉ gồm chữ số; gửi `member.user.id`, không gửi username |
| `paidAt` | Date | Thời điểm trả |
| `period` | string | Kỳ lương tuần (YYYY-Www, ví dụ `2026-W42`) |
| `eligibleRoles` | array | Các role được tính lương (bao gồm mọi role user có): `[{roleId, roleName, coefficient}]` |
| `paidWithRole` | object | Role dùng để gọi API: `{roleId, roleName}` |
| `amount` | number | Số coin đã trả (sau khi cap) |
| `rawAmount` | number | Tổng hệ số gốc (trước khi cap) |
| `isCapped` | boolean | Có bị cap xuống 100 không |
| `allRolesAtTime` | array | Tất cả role user có lúc đó: `[{roleId, roleName}]` |
| `status` | string | `SUCCESS`, `DUPLICATE`, `FAILED`, `NO_ROLE`, `NOT_IN_SERVER`, `ERROR` |
| `apiResponse` | object | Response từ Payroll API |
| `httpStatus` | number | HTTP status code |
| `error` | string | Thông báo lỗi (nếu có) |
| `createdAt` | Date | Thời điểm tạo record |

**Index**: `userId`, `period`, `paidAt`

---

## Lệnh Admin

Tất cả lệnh yêu cầu permission `Administrator`.

### 1. `/salary-coefficient`

Quản lý hệ số lương cho các role.

#### Subcommands:

**`/salary-coefficient set <role> <coefficient>`**
- Đặt hệ số lương cho role
- `coefficient`: 1-100
- Ví dụ: `/salary-coefficient set @Sao-đỏ 5`

**`/salary-coefficient get <role>`**
- Xem hệ số của role
- Hiển thị hệ số đã cấu hình hoặc mặc định (1)

**`/salary-coefficient list`**
- Xem danh sách tất cả hệ số đã cấu hình
- Sắp xếp theo hệ số giảm dần

**`/salary-coefficient delete <role>`**
- Xóa hệ số của role
- Role sẽ dùng hệ số mặc định (1)

---

### 2. `/salary-roles`

Quản lý danh sách role được trả lương.

#### Subcommands:

**`/salary-roles add <role>`**
- Thêm role vào danh sách được trả lương
- Ví dụ: `/salary-roles add @Sao-đỏ`

**`/salary-roles remove <role>`**
- Xóa role khỏi danh sách
- User có role này sẽ không còn được trả lương

**`/salary-roles list`**
- Xem danh sách role đủ điều kiện
- Hiển thị tên và ID

---

### 3. `/salary-schedule`

Đặt lịch trả lương tự động.

#### Cú pháp:

```
/salary-schedule <day> <hour>
```

**Parameters:**
- `day`: Ngày trong tuần (Chủ nhật đến Thứ bảy)
- `hour`: Giờ (0-23)

**Ví dụ:**
```
/salary-schedule day:Thu-hai hour:0
→ Trả lương vào Thứ Hai hàng tuần lúc 00:00
```

**Lưu ý:**
- Thay đổi có hiệu lực ngay lập tức
- Cron job sẽ restart với lịch mới

---

### 4. `/salary-payout-now`

Chạy trả lương ngay lập tức (không cần chờ lịch).

#### Cú pháp:

```
/salary-payout-now
```

**Chức năng:**
- Xử lý toàn bộ quy trình trả lương ngay
- Hiển thị kết quả chi tiết:
  - Tổng số người
  - Thành công
  - Thất bại
  - Bỏ qua (đã trả/không đủ điều kiện)
  - Thời gian xử lý

**Use cases:**
- Test cấu hình
- Trả lương khẩn cấp
- Chạy bù sau khi sửa lỗi

---

## Biến môi trường

Thêm vào file `.env`:

```bash
# Payroll API Configuration
PAYROLL_API_KEY=your_payroll_api_key_here
PAYROLL_API_BASE_URL=http://localhost:3000/api/payroll
```

**Lưu ý:**
- `PAYROLL_API_KEY`: API key do quản trị bot "Viện kiểm sát" cấp
- `PAYROLL_API_BASE_URL`: URL của Payroll API
- Bot sẽ không khởi động được nếu thiếu 2 biến này

---

## Ràng buộc và giới hạn

### 1. Số tiền

- **Tối thiểu**: 1 coin
- **Tối đa**: 100 coins (giới hạn của Payroll API)
- Nếu tổng hệ số > 100 → tự động cap xuống 100

### 2. Role

- Chỉ role trong `salary_eligible_roles` mới được xử lý
- User phải **đang có** role lúc trả lương
- Không thể dùng `@everyone`
- Bot account bị loại trừ

### 3. Deduplicate

- Mỗi user chỉ xử lý **1 lần** mỗi đợt
- API chống trả trùng: **1 lần mỗi role mỗi tháng**
- Gọi lại → `duplicate: true`, không trừ tiền

### 4. Retry Policy

**Retry (3 lần, backoff 2s/4s/8s):**
- `409 Conflict`: Request trùng đang xử lý
- `503 Service Unavailable`: Bot đang khởi động

**Không retry:**
- `400 Bad Request`: Dữ liệu sai
- `403 Forbidden`: User không có role
- `404 Not Found`: User không trong server
- `200` + `status: FAILED`: Ví bot hết tiền

### 5. Timezone

- Cron chạy theo giờ server
- **Khuyến nghị**: Set env `TZ=Asia/Ho_Chi_Minh` khi deploy
- Hoặc đảm bảo server timezone đúng

---

## Xử lý lỗi

### Lỗi thường gặp

| Lỗi | Nguyên nhân | Giải pháp |
|-----|-------------|-----------|
| `PAYROLL_API_KEY is required` | Thiếu env variable | Kiểm tra file `.env` |
| `Guild not found` | Bot không ở trong server | Kiểm tra `GUILD_ID` |
| `Role not found` | Role đã bị xóa | Cập nhật lại danh sách role |
| `HTTP 403` | User không có role | Bỏ qua, log warning |
| `HTTP 404` | User đã rời server | Bỏ qua, log warning |
| `status: FAILED` | Ví bot hết tiền | Nạp tiền vào ví bot |
| `Connection timeout` | API không phản hồi | Retry tự động, kiểm tra network |

### Best Practices

1. **Kiểm tra balance trước khi chạy:**
   - Sử dụng `/salary-payout-now` để test
   - Xem log balance warning

2. **Test cấu hình:**
   - Tạo test role với 1-2 user
   - Chạy `/salary-payout-now`
   - Kiểm tra lịch sử trong database

3. **Monitor logs:**
   - `[Payroll]`: Thông tin xử lý
   - `[WARN]`: Cảnh báo (không ảnh hưởng)
   - `[ERROR]`: Lỗi cần xử lý

4. **Backup:**
   - Export `salary_history` định kỳ
   - Lưu cấu hình role và coefficient

---

## Edge Cases

### Case 1: User có nhiều eligible role

```
User có: "Sao đỏ" (coef=2), "Sao vàng" (coef=3), "Sao xanh" (coef không set)
→ Tổng = 2 + 3 + 1(default) = 6 coins
→ API call với role "Sao đỏ" (first in list)
```

### Case 2: User đã được trả trong tháng

```
Lần 1: API trả thành công → status=SUCCESS, duplicate=false
Lần 2 (cùng tháng): API trả về → status=SUCCESS, duplicate=true
→ Không trừ tiền, lưu history với status=DUPLICATE
```

### Case 3: Tổng hệ số > 100

```
User có 5 role, mỗi role hệ số 30
→ Tổng = 150
→ Cap xuống 100
→ Lưu: amount=100, rawAmount=150, isCapped=true
```

### Case 4: User rời server giữa chừng

```
Lấy danh sách: User A có trong list
Xử lý đến User A: API trả về 404
→ Lưu history với status=NOT_IN_SERVER
→ Tiếp tục xử lý user khác
```

### Case 5: Ví bot hết tiền

```
API trả về: status=FAILED, error="Insufficient balance"
→ Lưu history với status=FAILED
→ Log ERROR nhưng KHÔNG dừng xử lý
→ Admin cần nạp tiền và chạy lại `/salary-payout-now`
```

---

## Workflow Setup

### Lần đầu setup

```bash
# 1. Cấu hình API credentials
# Chỉnh file .env:
PAYROLL_API_KEY=<your-key>
PAYROLL_API_BASE_URL=http://<host>:3000/api/payroll

# 2. Restart bot để load env variables
npm start

# 3. Thêm role được trả lương
/salary-roles add @Sao-đỏ
/salary-roles add @Sao-vàng

# 4. Cấu hình hệ số (optional, mặc định = 1)
/salary-coefficient set @Sao-đỏ 2
/salary-coefficient set @Sao-vàng 3

# 5. Đặt lịch trả lương
/salary-schedule day:Thu-hai hour:0

# 6. Test
/salary-payout-now
```

### Thay đổi lịch trình

```bash
# Đổi sang Thứ Sáu 18:00
/salary-schedule day:Thu-sau hour:18
```

### Thêm role mới

```bash
# Thêm role
/salary-roles add @Sao-xanh

# Đặt hệ số (optional)
/salary-coefficient set @Sao-xanh 4
```

---

## Troubleshooting

### Bot không trả lương tự động

1. Kiểm tra scheduler đã init:
   ```
   [INFO] Payroll scheduler initialized
   ```

2. Kiểm tra lịch trình:
   ```
   /salary-schedule day:Thu-hai hour:0
   ```

3. Kiểm tra timezone server:
   ```bash
   echo $TZ
   # Should be: Asia/Ho_Chi_Minh
   ```

### Lệnh không response

1. Kiểm tra đã register commands:
   ```
   [SUCCESS] Da dang ky lenh thanh cong!
   ```

2. Restart bot để reload commands

3. Kiểm tra permission: User phải có Administrator

### API call thất bại

1. Test connectivity:
   ```bash
   curl -H "x-api-key: $PAYROLL_API_KEY" \
     $PAYROLL_API_BASE_URL/balance
   ```

2. Kiểm tra API key hợp lệ

3. Xem log chi tiết:
   ```
   [Payroll API] Transfer error: ...
   ```

---

## Performance

### Metrics

- **Xử lý**: ~500ms/user (bao gồm API call + retry)
- **Throughput**: ~2 users/second
- **Memory**: ~50MB cho 1000 users

### Optimization

1. **Sequential processing**: Tránh 409 conflict
2. **Backoff retry**: Giảm load lên API
3. **Connection reuse**: Native fetch tự quản lý pool
4. **Database index**: roleId, userId, period

---

## Security

### API Key Management

- ✅ Store in `.env` (gitignore)
- ✅ Validate at startup
- ❌ Không log API key
- ❌ Không hardcode trong code

### Permission Control

- Tất cả lệnh yêu cầu `Administrator`
- Bot role phải cao hơn salary roles
- Không cho phép modify `@everyone`

### Audit Trail

- Mọi thay đổi lưu `updatedBy`
- Lịch sử trả lương đầy đủ trong `salary_history`
- Log tất cả actions

---

## Tài liệu tham khảo

- [Payroll API Documentation](../api/PAYROLL_API.md)
- [Discord.js Guide](https://discordjs.guide/)
- [Node-cron Documentation](https://www.npmjs.com/package/node-cron)
- [MongoDB Node Driver](https://www.mongodb.com/docs/drivers/node/current/)

---

## Changelog

### Version 1.0.0 (Initial Release)

- ✅ Auto payroll scheduler
- ✅ 4 admin commands
- ✅ Retry logic with backoff
- ✅ Deduplication
- ✅ History tracking
- ✅ Comprehensive error handling

---

**Liên hệ:** Quản trị viên bot để được hỗ trợ
