# Hệ thống trả lương tự động

## Tổng quan

Hệ thống trả lương tự động cho bot Discord giúp trả coin hàng tuần cho thành viên
có role được cấu hình. Hệ thống tích hợp với API trả lương của bot "Viện kiểm
sát" để thực hiện giao dịch.

### Đặc điểm chính

- **Tự động**: Chạy theo lịch hàng tuần với độ chính xác đến từng phút (mặc định: Thứ Hai 00:00)
- **Linh hoạt**: Quản trị viên có thể cấu hình role, hệ số lương và lịch trình
- **Lương cố định theo role**: Có thể cộng mức lương cố định cho role vào cùng kỳ trả lương tự động
- **An toàn**: Chống trả lương trùng lặp, tự động thử lại và ghi nhật ký đầy đủ
- **Thông báo trước**: Hệ thống tự động thông báo trước khi trả lương
- **Quản lý nợ**: Tự động ghi nợ khi thiếu coin, có lệnh trả nợ sau
- **Kiểm tra**: Có lệnh thủ công để kiểm thử và trả lương ngoài lịch

---

## Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────┐
│                        Bot Discord                            │
│                                                              │
│  ┌────────────────┐         ┌──────────────────┐           │
│  │ Tác vụ định kỳ │────────►│ Dịch vụ trả lương│           │
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
                           │ API trả lương        │
                           │ (bot Viện kiểm sát)  │
                           └──────────────────────┘
```

---

## Quy trình nghiệp vụ

### Luồng trả lương tự động

```
1. KÍCH HOẠT LẬP LỊCH
   └─► Tác vụ cron chạy vào thời gian đã cấu hình

2. LẤY CẤU HÌNH
   ├─► Lấy role đủ điều kiện theo hệ số và role lương cố định
   ├─► Lấy bảng hệ số từ DB (salary_coefficients)
   └─► Lấy mức lương cố định từ DB (salary_simple_roles)

3. LẤY DANH SÁCH THÀNH VIÊN
   ├─► Lấy đầy đủ thành viên máy chủ qua Discord API (không chỉ dùng bộ nhớ đệm)
   ├─► Lọc thành viên có role đủ điều kiện theo hệ số hoặc lương cố định
   └─► Loại bỏ trùng lặp theo Discord user ID

   Trước khi trả lương:
   ├─► Đọc salary_history của kỳ tuần hiện tại (YYYY-Www)
   └─► Bỏ qua thành viên đã có bản ghi SUCCESS

4. XỬ LÝ TỪNG THÀNH VIÊN
   ├─► Lọc các role đủ điều kiện mà thành viên đang có
   │   
   ├─► Tính tổng lương:
   │   ├─ A = tổng hệ số của tất cả role nếu thành viên có role trong salary_eligible_roles
   │   ├─ B = tổng lương cố định của các role trong salary_simple_roles
   │   ├─ Chỉ có role lương cố định thì nhận B, không tự phát sinh A
   │   ├─ Role chưa cấu hình hệ số mặc định bằng 1 khi tính A
   │   ├─ Tổng trước giới hạn = A + B
   │   └─ Giới hạn tối đa 100 coin
   │
   ├─► Chọn role đầu tiên để gọi API
   │
   ├─► Gọi API trả lương:
   │   ├─ POST /transfer với userId là Discord ID dạng chuỗi số, roleId và amount
   │   ├─ Thử lại 3 lần nếu nhận 409/503
   │   └─ Nhận phản hồi
   │
   └─► Lưu lịch sử vào DB (salary_history)
       ├─ SUCCESS: Trả lương thành công
       ├─ DUPLICATE: Đã trả trong kỳ tuần này
       ├─ NO_ROLE / NOT_IN_SERVER: Bỏ qua thành viên và tiếp tục
       ├─ FAILED: API không chuyển được tiền; dừng đợt trả lương
       └─ ERROR: Lỗi mạng/hệ thống; dừng đợt trả lương

5. TỔNG KẾT
   └─► Ghi nhật ký và trả về: total, success, failed, skipped, alreadyPaid, unprocessed
```

Hệ thống trả lương cần bật intent `GuildMembers` trong mã nguồn và
**Server Members Intent** trong Discord Developer Portal để lấy đầy đủ thành
viên, bao gồm người đang ngoại tuyến hoặc chưa có trong bộ nhớ đệm. Nếu không
lấy được danh sách thành viên, đợt trả lương sẽ dừng thay vì xử lý danh sách
không đầy đủ.

### Loại bỏ thành viên trùng lặp

Thành viên có nhiều role:
- **Chỉ xử lý một lần** trong mỗi đợt trả lương
- **Tính lương** bằng tổng hệ số của các role thường và mức cố định của các role được cấu hình
- **Chọn role đầu tiên** để gọi API (API chỉ nhận một role mỗi lần)

**Ví dụ:**
```
Thành viên A có role: "Sao đỏ" (hệ số 2), "Sao vàng" (lương cố định 10), "Thành viên" (chưa cấu hình)
trong đó "Sao đỏ" thuộc `salary_eligible_roles`
→ A = tổng hệ số các role = 2 + 1 + 1 = 4 coin
→ B = lương cố định của "Sao vàng" = 10 coin
→ Tổng lương = A + B = 14 coin
→ Gọi API bằng roleId của "Sao đỏ" (role đầu tiên)
→ Nếu đã trả trong tuần này: API trả duplicate=true, không trừ tiền
```

---

## Cấu trúc cơ sở dữ liệu

### Bộ sưu tập `salary_coefficients`

Lưu hệ số lương của từng role.

| Trường | Kiểu dữ liệu | Mô tả |
|-------|------|-------------|
| `roleId` | string | Discord role ID (snowflake) |
| `roleName` | string | Tên role (để hiển thị) |
| `coefficient` | number | Hệ số lương (1-100) |
| `updatedAt` | Date | Thời điểm cập nhật |
| `updatedBy` | string | ID người dùng thực hiện cập nhật |

**Chỉ mục**: `roleId` (duy nhất)

---

### Bộ sưu tập `salary_simple_roles`

Lưu mức lương cố định cho từng role. Thành viên có role này đủ điều kiện nhận phần lương cố định **B**. Phần lương hệ số **A** chỉ áp dụng nếu thành viên có role thuộc `salary_eligible_roles`; khi đủ điều kiện, A vẫn tính theo tất cả role như quy tắc hiện tại. Tổng lương trước giới hạn là **A + B**, tối đa 100 coin theo giới hạn API.

| Trường | Kiểu dữ liệu | Mô tả |
|-------|------|-------------|
| `roleId` | string | Discord role ID |
| `roleName` | string | Tên role để hiển thị |
| `amount` | number | Mức lương cố định cho mỗi kỳ |
| `updatedAt` | Date | Thời điểm cập nhật |
| `updatedBy` | string | ID người cập nhật |

---

### Bộ sưu tập `salary_eligible_roles`

Danh sách role đủ điều kiện nhận lương theo hệ số. Role được cấu hình tại `salary_simple_roles` cũng tự đủ điều kiện nhận lương.

| Trường | Kiểu dữ liệu | Mô tả |
|-------|------|-------------|
| `roleId` | string | ID role Discord |
| `roleName` | string | Tên role |
| `addedAt` | Date | Thời điểm thêm |
| `addedBy` | string | ID người dùng thực hiện thao tác thêm |

**Chỉ mục**: `roleId` (duy nhất)

---

### Bộ sưu tập `salary_config`

Cấu hình lịch trả lương (một tài liệu duy nhất).

| Trường | Kiểu dữ liệu | Mô tả |
|-------|------|-------------|
| `_id` | string | `"schedule"` (giá trị cố định) |
| `dayOfWeek` | number | 0=Chủ nhật, 1=Thứ Hai, ..., 6=Thứ Bảy |
| `hour` | number | Giờ chạy (0-23) |
| `timezone` | string | `"Asia/Ho_Chi_Minh"` |
| `updatedAt` | Date | Thời điểm cập nhật |
| `updatedBy` | string | ID người dùng thực hiện cập nhật |

**Mặc định**: Thứ Hai (1) lúc 00:00

---

### Bộ sưu tập `salary_history`

Lịch sử trả lương.

| Trường | Kiểu dữ liệu | Mô tả |
|-------|------|-------------|
| `guildId` | string | ID máy chủ Discord |
| `userId` | string | ID Discord của thành viên, chỉ gồm chữ số; gửi `member.user.id`, không gửi username |
| `paidAt` | Date | Thời điểm trả |
| `period` | string | Kỳ lương tuần (YYYY-Www, ví dụ `2026-W42`) |
| `eligibleRoles` | array | Chi tiết role được tính lương: `[{roleId, roleName, payType, coefficient}]` hoặc `[{roleId, roleName, payType, amount}]` |
| `paidWithRole` | object | Role dùng để gọi API: `{roleId, roleName}` |
| `amount` | number | Số coin đã trả (sau khi giới hạn) |
| `rawAmount` | number | Tổng lương theo hệ số và lương cố định trước khi giới hạn |
| `coefficientAmount` | number | Phần lương tính theo hệ số |
| `fixedSalaryAmount` | number | Phần lương cố định được tính vào khoản trả |
| `isCapped` | boolean | Có bị giới hạn xuống 100 hay không |
| `allRolesAtTime` | array | Tất cả role thành viên có tại thời điểm đó: `[{roleId, roleName}]` |
| `status` | string | `SUCCESS`, `DUPLICATE`, `FAILED`, `NO_ROLE`, `NOT_IN_SERVER`, `ERROR` |
| `apiResponse` | object | Phản hồi từ API trả lương |
| `httpStatus` | number | Mã trạng thái HTTP |
| `error` | string | Thông báo lỗi (nếu có) |
| `createdAt` | Date | Thời điểm tạo bản ghi |

**Chỉ mục**: `userId`, `period`, `paidAt`

---

## Lệnh quản trị
Tất cả lệnh yêu cầu quyền `Administrator`.

### 1. `/salary-coefficient`

Quản lý hệ số lương cho các role.

#### Lệnh con:

**`/salary-coefficient set <role> <coefficient>`**
- Đặt hệ số lương cho role
- `coefficient`: từ 1 đến 100
- Ví dụ: `/salary-coefficient set @Sao-đỏ 5`

**`/salary-coefficient get <role>`**
- Xem hệ số của role
- Hiển thị hệ số đã cấu hình hoặc giá trị mặc định (1).

**`/salary-coefficient list`**
- Xem danh sách tất cả hệ số đã cấu hình
- Sắp xếp theo hệ số giảm dần

**`/salary-coefficient delete <role>`**
- Xóa hệ số của role
- Role sẽ dùng hệ số mặc định (1)

---

### 2. `/salary-simple-role`

Cấu hình mức lương cố định riêng cho role, trả tự động theo cùng lịch chung với hệ thống lương.

**`/salary-simple-role set <role> <amount>`**
- Đặt mức lương cố định 1-100 coin cho mỗi kỳ.
- Ví dụ: `/salary-simple-role set @Nhân-viên 20`

**`/salary-simple-role get <role>`**
- Xem mức lương cố định đã cấu hình.

**`/salary-simple-role list`**
- Xem các role và mức lương cố định.

**`/salary-simple-role delete <role>`**
- Xóa mức lương cố định của role.

Role có lương cố định tự đủ điều kiện nhận khoản B, nhưng không tự tạo khoản A. Nếu thành viên cũng có role trong `salary_eligible_roles`, A được tính theo hệ số của tất cả role (bao gồm role lương cố định, mặc định 1 nếu chưa cấu hình); sau đó cộng B.

---

### 3. `/salary-roles`

Quản lý danh sách role được trả lương.

#### Lệnh con:

**`/salary-roles add <role>`**
- Thêm role vào danh sách được trả lương
- Ví dụ: `/salary-roles add @Sao-đỏ`

**`/salary-roles remove <role>`**
- Xóa role khỏi danh sách
- Nếu role không được cấu hình tại `/salary-simple-role`, thành viên chỉ còn role này sẽ không đủ điều kiện nhận lương.

**`/salary-roles list`**
- Xem danh sách role đủ điều kiện
- Hiển thị tên và ID.

---

### 4. `/salary-schedule`

Đặt lịch trả lương tự động.

#### Cú pháp:

```
/salary-schedule <day> <hour>
```

**Tham số:**
- `day`: Ngày trong tuần (Chủ nhật đến Thứ bảy)
- `hour`: Giờ (0-23)

**Ví dụ:**
```
/salary-schedule day:Thu-hai hour:0
→ Trả lương vào Thứ Hai hàng tuần lúc 00:00
```

**Lưu ý:**
- Thay đổi có hiệu lực ngay lập tức.
- Tác vụ cron sẽ khởi động lại theo lịch mới.

---

### 4. `/salary-payout-now`

Chạy trả lương ngay lập tức (không cần chờ lịch).

#### Cú pháp:

```
/salary-payout-now
```

**Chức năng:**
- Xử lý toàn bộ quy trình trả lương ngay lập tức.
- Hiển thị kết quả chi tiết:
  - Tổng số thành viên
  - Thành công
  - Thất bại
  - Số thành viên được bỏ qua (đã trả/không đủ điều kiện)
  - Thời gian xử lý

**Trường hợp sử dụng:**
- Kiểm thử cấu hình
- Trả lương khẩn cấp
- Chạy bù sau khi sửa lỗi

---

## Biến môi trường

Thêm vào file `.env`:

```bash
# Cấu hình API trả lương
PAYROLL_API_KEY=your_payroll_api_key_here
PAYROLL_API_BASE_URL=http://localhost:3000/api/payroll
```

**Lưu ý:**
- `PAYROLL_API_KEY`: khóa API do quản trị bot "Viện kiểm sát" cấp
- `PAYROLL_API_BASE_URL`: địa chỉ cơ sở của API trả lương
- Bot sẽ không khởi động được nếu thiếu hai biến này.

---

## Ràng buộc và giới hạn

### 1. Số tiền

- **Tối thiểu**: 1 coin
- **Tối đa**: 100 coin (giới hạn của API trả lương)
- Tổng lương theo hệ số và lương cố định được cộng lại; nếu tổng vượt 100 coin thì giới hạn ở 100.

### 2. Role

- Thành viên cần có ít nhất một role trong `salary_eligible_roles` hoặc `salary_simple_roles`.
- Nếu chỉ có role trong `salary_simple_roles`, thành viên nhận khoản cố định B; khoản hệ số A chỉ áp dụng khi có role trong `salary_eligible_roles`.
- Thành viên phải **đang có** role tại thời điểm trả lương
- Không thể dùng `@everyone`
- Tài khoản bot không được tính

### 3. Loại bỏ thành viên trùng lặp

- Mỗi thành viên chỉ được xử lý **một lần** mỗi đợt
- API chống trả trùng: **1 lần mỗi role mỗi tháng**
- Gọi lại → `duplicate: true`, không trừ tiền

### 4. Chính sách thử lại

**Thử lại (3 lần, thời gian chờ tăng dần 2/4/8 giây):**
- `409 Conflict`: Yêu cầu trùng đang được xử lý
- `503 Service Unavailable`: Bot đang khởi động

**Không thử lại:**
- `400 Bad Request`: Dữ liệu sai
- `403 Forbidden`: Thành viên không có role
- `404 Not Found`: Thành viên không ở trong máy chủ
- `200` + `status: FAILED`: Ví bot hết tiền

### 5. Múi giờ

- Cron chạy theo giờ máy chủ.
- **Khuyến nghị**: Đặt biến môi trường `TZ=Asia/Ho_Chi_Minh` khi triển khai.
- Hoặc bảo đảm múi giờ máy chủ được cấu hình chính xác.

---

## Xử lý lỗi

### Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|-----|-------------|-----------|
| `PAYROLL_API_KEY is required` | Thiếu biến môi trường | Kiểm tra tệp `.env` |
| `Guild not found` | Bot không ở trong máy chủ | Kiểm tra `GUILD_ID` |
| `Role not found` | Role đã bị xóa | Cập nhật lại danh sách role |
| `HTTP 403` | Thành viên không có role | Bỏ qua và ghi nhật ký cảnh báo |
| `HTTP 404` | Thành viên đã rời máy chủ | Bỏ qua và ghi nhật ký cảnh báo |
| `status: FAILED` | Ví bot hết tiền | Nạp tiền vào ví bot |
| `Connection timeout` | API không phản hồi | Tự động thử lại và kiểm tra mạng |

### Thực hành tốt

1. **Kiểm tra số dư trước khi chạy:**
   - Dùng `/salary-payout-now` để kiểm thử.
   - Kiểm tra cảnh báo số dư trong nhật ký.

2. **Kiểm thử cấu hình:**
   - Tạo role thử nghiệm với 1-2 thành viên.
   - Chạy `/salary-payout-now`
   - Kiểm tra lịch sử trong database

3. **Theo dõi nhật ký:**
   - `[Payroll]`: Thông tin xử lý.
   - `[WARN]`: Cảnh báo (không ảnh hưởng).
   - `[ERROR]`: Lỗi cần xử lý.

4. **Sao lưu:**
   - Xuất `salary_history` định kỳ.
   - Lưu cấu hình role và hệ số.

---

## Trường hợp ngoại lệ

### Trường hợp 1: Thành viên có nhiều role đủ điều kiện

```
Thành viên có: "Sao đỏ" (hệ số=2), "Sao vàng" (hệ số=3), "Sao xanh" (chưa cấu hình hệ số)
→ Tổng = 2 + 3 + 1 (mặc định) = 6 coin
→ Gọi API bằng role "Sao đỏ" (role đầu tiên trong danh sách)
```

### Trường hợp 2: Thành viên đã được trả trong tháng

```
Lần 1: API trả thành công → status=SUCCESS, duplicate=false
Lần 2 (cùng tháng): API trả về → status=SUCCESS, duplicate=true
→ Không trừ tiền, lưu lịch sử với status=DUPLICATE
```

### Trường hợp 3: Tổng hệ số lớn hơn 100

```
Thành viên có 5 role, mỗi role có hệ số 30
→ Tổng = 150
→ Giới hạn ở mức 100
→ Lưu: amount=100, rawAmount=150, isCapped=true
```

### Trường hợp 4: Thành viên rời máy chủ giữa chừng

```
Lấy danh sách: Thành viên A có trong danh sách
Xử lý đến thành viên A: API trả về 404
→ Lưu lịch sử với status=NOT_IN_SERVER
→ Tiếp tục xử lý thành viên khác
```

### Trường hợp 5: Ví bot hết tiền

```
API trả về: status=FAILED, error="Insufficient balance"
→ Lưu history với status=FAILED
→ Ghi nhật ký ERROR nhưng KHÔNG dừng xử lý.
→ Quản trị viên cần nạp tiền và chạy lại `/salary-payout-now`.
```

---

## Quy trình cài đặt

### Cài đặt lần đầu

```bash
# 1. Cấu hình thông tin xác thực API
# Chỉnh sửa tệp .env:
PAYROLL_API_KEY=<your-key>
PAYROLL_API_BASE_URL=http://<host>:3000/api/payroll

# 2. Khởi động lại bot để tải biến môi trường
npm start

# 3. Thêm role được trả lương
/salary-roles add @Sao-đỏ
/salary-roles add @Sao-vàng

# 4. Cấu hình hệ số (không bắt buộc, mặc định = 1)
/salary-coefficient set @Sao-đỏ 2
/salary-coefficient set @Sao-vàng 3

# Hoặc cấu hình role nhận lương cố định theo kỳ
/salary-simple-role set @Nhân-viên 20

# 5. Đặt lịch trả lương
/salary-schedule day:Thu-hai hour:0

# 6. Kiểm thử
/salary-payout-now
```

### Thay đổi lịch trình

```bash
# Đổi lịch sang Thứ Sáu lúc 18:00
/salary-schedule day:Thu-sau hour:18
```

### Thêm role mới

```bash
# Thêm role mới
/salary-roles add @Sao-xanh

# Đặt hệ số (không bắt buộc)
/salary-coefficient set @Sao-xanh 4
```

---

## Khắc phục sự cố

### Bot không tự động trả lương

1. Kiểm tra scheduler đã init:
   ```
   [INFO] Payroll scheduler initialized
   ```

2. Kiểm tra lịch trình:
   ```
   /salary-schedule day:Thu-hai hour:0
   ```

3. Kiểm tra múi giờ máy chủ:
   ```bash
   echo $TZ
   # Kết quả dự kiến: Asia/Ho_Chi_Minh
   ```

### Lệnh không phản hồi

1. Kiểm tra lệnh đã được đăng ký:
   ```
   [SUCCESS] Da dang ky lenh thanh cong!
   ```

2. Khởi động lại bot để tải lại lệnh.

3. Kiểm tra quyền: người dùng cần có `Administrator`.

### Gọi API thất bại

1. Kiểm tra kết nối:
   ```bash
   curl -H "x-api-key: $PAYROLL_API_KEY" \
     $PAYROLL_API_BASE_URL/balance
   ```

2. Kiểm tra khóa API có hợp lệ hay không.

3. Xem log chi tiết:
   ```
   [Payroll API] Transfer error: ...
   ```

---

## Hiệu năng

### Số liệu tham khảo

- **Thời gian xử lý**: khoảng 500 ms/thành viên (bao gồm gọi API và thử lại)
- **Thông lượng**: khoảng 2 thành viên/giây
- **Bộ nhớ**: khoảng 50 MB cho 1.000 thành viên

### Tối ưu hóa

1. **Xử lý tuần tự**: Tránh xung đột `409`.
2. **Thử lại với thời gian chờ tăng dần**: Giảm tải cho API.
3. **Tái sử dụng kết nối**: `fetch` tích hợp sẵn tự quản lý nhóm kết nối.
4. **Chỉ mục cơ sở dữ liệu**: `roleId`, `userId`, `period`.

---

## Bảo mật

### Quản lý khóa API

- ✅ Lưu trong `.env` (đã được loại trừ khỏi Git)
- ✅ Kiểm tra khi khởi động
- ❌ Không ghi nhật ký khóa API.
- ❌ Không ghi cứng khóa API trong mã nguồn.

### Kiểm soát quyền
- Tất cả lệnh yêu cầu quyền `Administrator`.
- Role của bot phải cao hơn các role được trả lương.
- Không cho phép thay đổi `@everyone`.

### Nhật ký kiểm toán
- Lưu người thực hiện mọi thay đổi trong `updatedBy`.
- Lưu đầy đủ lịch sử trả lương trong `salary_history`.
- Ghi nhật ký mọi thao tác.

---

## Tài liệu tham khảo

- [Tài liệu API trả lương](../api/PAYROLL_API.md)
- [Hướng dẫn Discord.js](https://discordjs.guide/)
- [Tài liệu Node-cron](https://www.npmjs.com/package/node-cron)
- [Trình điều khiển MongoDB cho Node.js](https://www.mongodb.com/docs/drivers/node/current/)

---

## Lịch sử thay đổi

### Phiên bản 1.0.0 (phát hành lần đầu)

- ✅ Tác vụ trả lương tự động theo lịch.
- ✅ Các lệnh quản trị.
- ✅ Tự động thử lại với thời gian chờ tăng dần.
- ✅ Loại bỏ thành viên trùng lặp.
- ✅ Theo dõi lịch sử.
- ✅ Xử lý lỗi đầy đủ.

---

**Liên hệ:** Quản trị viên bot để được hỗ trợ.


---

## 🔔 Hệ thống thông báo

### Tổng quan

Hệ thống tự động gửi thông báo trước khi trả lương để quản trị viên biết:
- Tổng số coin cần trả
- Số dư hiện tại
- Ví có đủ tiền hay không

### Cách hoạt động

```
1. Scheduler chạy theo lịch đã cấu hình.
2. Tính tổng số coin cần trả theo cùng logic với quy trình trả lương.
3. Gọi API `GET /balance` để lấy số dư.
4. Gửi embed thông báo đến các role được chỉ định.
```

### Lệnh

#### 1. Đặt lịch thông báo
```
/salary-notification-schedule <day> <hour> <minute> <roles...>

Ví dụ:
/salary-notification-schedule sunday 20 00 @Admin @Manager
→ Mỗi Chủ Nhật lúc 20:00, gửi thông báo cho Admin và Manager
```

#### 2. Quản lý role nhận thông báo
```
/salary-notification-roles add @Role     # Thêm role
/salary-notification-roles remove @Role  # Xóa role
/salary-notification-roles list          # Xem danh sách
```

### Định dạng embed thông báo

```
📊 BÁO CÁO TRẢ LƯƠNG SẮP TỚI

📅 Thời gian trả: Thứ Hai, 21/10/2026 lúc 00:00

👥 Số người: 45 thành viên
💰 Tổng số coin cần trả: 1,250

🏦 Số dư hiện tại: 1,500 coins
✅ Trạng thái: Đủ để trả lương

---

⏰ Lưu ý: Bot sẽ tự động trả lương vào thời gian đã định
```

Hoặc nếu thiếu:

```
📊 BÁO CÁO TRẢ LƯƠNG SẮP TỚI

📅 Thời gian trả: Thứ Hai, 21/10/2026 lúc 00:00

👥 Số người: 45 thành viên
💰 Tổng số coin cần trả: 1,250

🏦 Số dư hiện tại: 800 coins
⚠️ THIẾU: 450 coins

---

❌ CẢNH BÁO: Không đủ coins để trả lương!
📝 Hệ thống sẽ tự động ghi nợ nếu không nạp thêm.
```

### Cấu trúc cơ sở dữ liệu

**Bộ sưu tập: `salary_notification_config`**
```javascript
{
  _id: "notification_schedule",
  dayOfWeek: 0,              // 0=CN, 1=T2, ..., 6=T7
  hour: 20,
  minute: 0,
  timezone: "Asia/Ho_Chi_Minh",
  notificationRoles: [       // Các role nhận thông báo
    "1234567890",
    "9876543210"
  ],
  updatedAt: ISODate()
}
```

---

## 💳 Hệ thống theo dõi nợ

### Tổng quan

Khi số dư ví bot không đủ để trả lương cho tất cả thành viên, hệ thống sẽ:
- **Không trả lương** cho bất kỳ ai.
- **Ghi lại khoản nợ** trong cơ sở dữ liệu.
- Cho phép quản trị viên **trả nợ sau** khi nạp thêm tiền.

### Khi nào ghi nợ?

```
1. Scheduler tự động chạy quy trình trả lương.
2. Hoặc quản trị viên dùng `/salary-payout-now`.

→ Tính tổng số coin cần trả.
→ Gọi `GET /balance`.
→ Nếu số dư nhỏ hơn tổng cần trả:
   ├─ Tạo bản ghi khoản nợ.
   ├─ Lưu danh sách tất cả thành viên cần được trả.
   └─ KHÔNG gọi API chuyển tiền.
```

### Định dạng mã khoản nợ

Mã khoản nợ được tạo từ dấu thời gian:
```
Định dạng: DDMMYYYYHHmm (14 chữ số)

Ví dụ:
- Trả lương lúc: 19/10/2026 08:31
- DebtId: 191020260831
```

### Cấu trúc cơ sở dữ liệu

**Bộ sưu tập: `salary_debts`**
```javascript
{
  debtId: "191020260831",
  createdAt: ISODate("2026-10-19T08:31:00Z"),
  payrollDate: ISODate("2026-10-19T08:31:00Z"),
  
  totalCoinsNeeded: 1250,    // Tổng coins cần trả
  walletBalance: 800,        // Số dư lúc đó
  deficit: 450,              // Thiếu bao nhiêu
  
  memberCount: 45,           // Số người không được trả
  
  unpaidMembers: [           // Danh sách chi tiết
    {
      userId: "123456789",
      username: "Nguyen Van A",
      amount: 25,
      eligibleRoles: [
        { roleId: "111", roleName: "Member", coefficient: 1 },
        { roleId: "222", roleName: "Active", coefficient: 1 }
      ],
      paidWithRole: {
        roleId: "111",
        roleName: "Member"
      }
    }
    // ... 44 members khác
  ],
  
  status: "unpaid",          // "unpaid" | "paid"
  paidAt: null,              // Thời gian trả nợ (nếu có)
  
  updatedAt: ISODate("2026-10-19T08:31:00Z")
}
```

### Lệnh quản lý nợ

#### 1. Xem danh sách nợ
```
/salary-debts list

→ Hiện embed với tất cả khoản nợ:

📋 DANH SÁCH NỢ LƯƠNG

🔴 Chưa trả (2 khoản):
  • 191020260831 - 19/10/2026 08:31
    Thiếu: 450 coins | 45 người
    
  • 121020260800 - 12/10/2026 08:00
    Thiếu: 230 coins | 23 người

✅ Đã trả (1 khoản):
  • 051020260800 - 05/10/2026 08:00
    Đã trả lúc: 06/10/2026 14:23

---
Dùng /salary-debt-detail <debtId> để xem chi tiết
```

#### 2. Xem chi tiết một khoản nợ
```
/salary-debt-detail 191020260831

→ Hiện embed chi tiết:

📄 CHI TIẾT NỢ LƯƠNG
ID: 191020260831

📅 Ngày: 19/10/2026 08:31
💰 Tổng cần trả: 1,250 coins
🏦 Số dư lúc đó: 800 coins
⚠️ Thiếu: 450 coins

👥 Danh sách nợ (45 người):
  1. Nguyen Van A - 25 coins
  2. Tran Thi B - 30 coins
  3. Le Van C - 28 coins
  ... (xem đầy đủ trong DB)

🔴 Trạng thái: Chưa trả

---
Dùng /salary-pay-debt 191020260831 để trả nợ
```

#### 3. Trả nợ
```
/salary-pay-debt 191020260831

→ Bot sẽ:
  1. Tải bản ghi khoản nợ.
  2. Kiểm tra số dư hiện tại.
  3. Nếu đủ tiền:
     ├─ Trả lần lượt cho từng thành viên.
     ├─ Cập nhật trạng thái nợ thành "paid".
     ├─ Ghi dấu thời gian vào paidAt.
     └─ Trả lời kèm kết quả.
  4. Nếu vẫn thiếu tiền:
     └─ Trả lời lỗi kèm số dư hiện tại.

Reply khi thành công:
✅ ĐÃ TRẢ NỢ THÀNH CÔNG

Debt ID: 191020260831
Đã trả cho: 45/45 thành viên
Tổng: 1,250 coin

Số dư còn lại: 750 coin
```

### Luồng xử lý nợ

```
┌─────────────────────────────────────────────┐
│  Scheduler trả lương / Trả lương thủ công   │
└────────────────┬────────────────────────────┘
                 │
                 ▼
        ┌────────────────┐
        │ Tính tổng số   │
        │ coin cần trả   │
        └────────┬───────┘
                 │
                 ▼
         ┌──────────────┐
         │ Kiểm tra số dư│
         └──────┬───────┘
                 │
        ┌────────┴────────┐
        │                 │
    Đủ tiền?          Không đủ?
        │                 │
        ▼                 ▼
┌───────────────┐   ┌──────────────┐
│ Xử lý thanh   │   │ Tạo bản ghi  │
│ toán bình     │   │ khoản nợ     │
│ thường        │   │              │
└───────────────┘   └──────┬───────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Bỏ qua toàn bộ │
                  │ khoản thanh toán│
                  └─────────────────┘
                  
Later...
                  
┌─────────────────────────┐
│ /salary-pay-debt <id>   │
└───────────┬─────────────┘
            │
            ▼
    ┌──────────────┐
    │ Kiểm tra số dư│
    └──────┬───────┘
            │
    ┌───────┴────────┐
    │                │
Đủ tiền?         Vẫn thiếu?
    │                │
    ▼                ▼
┌──────────┐   ┌─────────┐
│ Trả cho  │   │ Thông  │
│ tất cả   │   │ báo lỗi│
│ thành viên│  │         │
└────┬─────┘   └─────────┘
     │
     ▼
┌──────────────┐
│ Đánh dấu đã trả │
└──────────────┘
```

---

## 🎯 Danh sách lệnh tổng hợp

### Lệnh quản trị

| Lệnh | Mô tả | Ví dụ |
|---------|-------|-------|
| `/salary-coefficient <role> <số>` | Đặt hệ số lương cho role | `/salary-coefficient @Member 2` |
| `/salary-simple-role set <role> <amount>` | Đặt lương cố định cho role mỗi kỳ | `/salary-simple-role set @Member 20` |
| `/salary-simple-role get <role>` | Xem lương cố định của role | `/salary-simple-role get @Member` |
| `/salary-simple-role list` | Xem danh sách role lương cố định | `/salary-simple-role list` |
| `/salary-simple-role delete <role>` | Xóa cấu hình lương cố định | `/salary-simple-role delete @Member` |
| `/salary-roles add <role>` | Thêm role được trả lương | `/salary-roles add @Active` |
| `/salary-roles remove <role>` | Xóa role khỏi danh sách | `/salary-roles remove @Inactive` |
| `/salary-roles list` | Xem danh sách role | `/salary-roles list` |
| `/salary-schedule <day> <hour> <minute>` | Đặt lịch trả lương | `/salary-schedule monday 8 30` |
| `/salary-payout-now` | Trả lương ngay lập tức | `/salary-payout-now` |
| `/salary-notification-schedule <day> <hour> <minute> <roles...>` | Đặt lịch thông báo | `/salary-notification-schedule sunday 20 0 @Admin` |
| `/salary-notification-roles add <role>` | Thêm role nhận thông báo | `/salary-notification-roles add @Manager` |
| `/salary-notification-roles remove <role>` | Xóa role khỏi danh sách nhận thông báo | `/salary-notification-roles remove @Manager` |
| `/salary-notification-roles list` | Xem role nhận thông báo | `/salary-notification-roles list` |
| `/salary-debts list` | Xem danh sách nợ | `/salary-debts list` |
| `/salary-debt-detail <debtId>` | Chi tiết khoản nợ | `/salary-debt-detail 191020260831` |
| `/salary-pay-debt <debtId>` | Trả nợ cho một đợt | `/salary-pay-debt 191020260831` |
| `/salary-preview` | Xem bản xem trước tổng số coin cần trả | `/salary-preview` |
| `/salary-info` | Xem thông tin hệ thống (lịch và bản xem trước) | `/salary-info` |

**Tất cả lệnh trên đều yêu cầu quyền `Administrator`.**

---

### Lệnh thành viên

Lệnh dành cho thành viên (không cần quyền quản trị):

| Lệnh | Mô tả | Ví dụ |
|---------|-------|-------|
| `/salary-check` | Kiểm tra lương cá nhân | `/salary-check` |

**Lệnh này hiển thị:**
- Các role tính theo hệ số và role có lương cố định.
- Tổng hệ số, phần lương cố định và tổng coin dự kiến mỗi kỳ.
- Lịch trả lương tiếp theo.

**Lưu ý:**
- Bạn cần có ít nhất một role trong danh sách role đủ điều kiện hoặc danh sách role lương cố định.
- Lương hệ số A chỉ áp dụng khi bạn có role thuộc danh sách `/salary-roles`; lương cố định B áp dụng theo các role đã cấu hình tại `/salary-simple-role`.
- Tổng nhận được là A + B, tối đa 100 coin.
- Role thường chưa cấu hình hệ số sẽ dùng giá trị mặc định = 1.
- Tổng số coin tối đa là 100; nếu vượt sẽ bị giới hạn ở mức này.

---

## 📊 Tổng hợp các collection MongoDB

| Bộ sưu tập | Mục đích | Trường chính |
|------------|----------|------------|
| `salary_coefficients` | Hệ số lương theo role | `roleId`, `coefficient` |
| `salary_simple_roles` | Lương cố định theo role | `roleId`, `amount` |
| `salary_eligible_roles` | Các role được trả lương | `roleId` |
| `salary_config` | Lịch trả lương | `dayOfWeek`, `hour`, `minute` |
| `salary_notification_config` | Lịch thông báo | `dayOfWeek`, `hour`, `minute`, `notificationRoles` |
| `salary_history` | Lịch sử trả lương | `userId`, `amount`, `status`, `paidAt` |
| `salary_debts` | Các khoản nợ lương chưa trả | `debtId`, `unpaidMembers`, `status` |

---

## 🔄 Luồng hoạt động đầy đủ

### Ví dụ dòng thời gian

```
Chủ Nhật 20:00 (Thông báo)
├─► Tác vụ gửi thông báo được kích hoạt
├─► Tính tổng số coin cần: 1.250
├─► Kiểm tra số dư: 800 coin
├─► Gửi embed cảnh báo thiếu 450 coin
└─► Nhắc đến @Admin @Manager

Thứ Hai 08:30 (Trả lương)
├─► Tác vụ trả lương được kích hoạt
├─► Tính tổng số coin cần: 1.250
├─► Kiểm tra số dư: 800 coin (vẫn thiếu)
├─► Tạo bản ghi nợ: 211020260830
├─► Lưu 45 thành viên chưa được trả lương
└─► Bỏ qua thanh toán và ghi nhật ký

Quản trị viên nạp tiền...

Thứ Ba 14:00 (Trả nợ thủ công)
├─► Quản trị viên: /salary-pay-debt 211020260830
├─► Kiểm tra số dư: 2.000 coin (đã đủ)
├─► Trả lần lượt cho 45 thành viên
├─► Đánh dấu khoản nợ đã trả
└─► Trả lời kèm tổng kết thành công
```

---

*Cập nhật lần cuối: 2026-10-22*
