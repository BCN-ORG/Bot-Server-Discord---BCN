# Tài liệu tính năng

Tài liệu chi tiết về các tính năng của bot Discord.

---

## 📦 Danh sách tính năng

### 1. 💰 Hệ thống trả lương tự động
📄 **[PAYROLL_SYSTEM.md](./payroll/PAYROLL_SYSTEM.md)**

**Mô tả**: Tự động trả lương hàng tuần cho thành viên có role được cấu hình,
tích hợp với API trả lương.

**Trạng thái**: ✅ **Hoàn thành**

**Điểm nổi bật**:
- Tự động chạy theo lịch (mặc định: Thứ Hai, 0 giờ)
- Tính tổng hệ số từ nhiều role
- Tự động loại bỏ thành viên trùng lặp
- Tự động thử lại khi gọi API thất bại
- Có các lệnh quản trị để quản lý

**Công nghệ sử dụng**:
- Node-cron (lập lịch)
- MongoDB (4 collection)
- API trả lương
- Lệnh slash của Discord.js

### 2. ✏️ Hệ thống kiểm tra và quản lý tên
📄 **[NAME_VALIDATION_SYSTEM.md](./name-validation/NAME_VALIDATION_SYSTEM.md)**

**Mô tả**: Tự động kiểm tra biệt danh thành viên theo quy tắc, theo dõi vi phạm
và tự động kick sau 48 giờ.

**Trạng thái**: ✅ **Đã triển khai** (đang tài liệu hóa)

**Điểm nổi bật**:
- Kiểm tra định dạng biệt danh (2-5 từ, chỉ chữ cái)
- Theo dõi vi phạm với thời hạn 48 giờ
- Tự động kick thành viên quá hạn
- Biểu mẫu đổi tên có kiểm tra dữ liệu
- Danh sách tài khoản được miễn kiểm tra

**Công nghệ sử dụng**:
- MongoDB (collection `violations`)
- Node-cron (bộ kiểm tra vi phạm)
- Biểu mẫu và sự kiện Discord.js
- Dịch vụ kiểm tra tên

### 3. 🎂 Tính năng sinh nhật
📄 **[BIRTHDAY_FEATURE.md](./birthday/BIRTHDAY_FEATURE.md)**

**Mô tả**: Cung cấp API tra cứu thành viên có sinh nhật theo ngày, sử dụng múi
giờ Việt Nam.

**Trạng thái**: ✅ **Đã triển khai**

**API**: `GET /api/birthdays/today`, `POST /api/birthdays/by-date`

### 4. 📱 Theo dõi thông tin hệ thống
📄 **[SYSTEM_MONITORING.md](./system-monitoring/SYSTEM_MONITORING.md)**

**Mô tả**: Cung cấp thông tin pin, RAM, CPU và nhiệt độ khi bot chạy trên
Android/Termux.

**Điểm nổi bật**:
- Chỉ chạy lệnh hệ thống trên Android/Termux
- Trả về các chỉ số hiện có nếu một số lệnh hoặc tệp hệ thống không khả dụng

**API**: [`GET /api/system`](../api/internal/SYSTEM_API.md)
**Lệnh Discord**: `/battery`
**Cấu hình role nhận DM**: `/battery-alert-role add`, `/battery-alert-role remove`, `/battery-alert-role list`

### 5. 🎭 Nhận role bằng biểu tượng cảm xúc
📄 **[REACTION_ROLES_WORKFLOW.md](./reaction-roles/REACTION_ROLES_WORKFLOW.md)**

**Mô tả**: Thành viên thêm biểu tượng cảm xúc vào tin nhắn để nhận role; mỗi cặp tin
nhắn/role có emoji và giới hạn thành viên riêng.

**Trạng thái**: ✅ **Đã triển khai**

**Lệnh**: `/reaction-role set`, `/reaction-role remove`, `/reaction-role list`

### 6. ⏳ Quản lý role tạm thời
📄 **[TEMPORARY_ROLES.md](./temporary-roles/TEMPORARY_ROLES.md)**

**Mô tả**: Cấp role có thời hạn theo danh sách thành viên tại thời điểm chạy
lệnh của một role nhóm; hỗ trợ gia hạn, xem phiên và thu hồi thủ công hoặc tự
động.

**Trạng thái**: ✅ **Đã triển khai**

**Lệnh**: `/role set`, `/role list`, `/role revoke`

### 7. 🧾 Biên bản phạt coins
📄 **[FINE_REPORTS.md](./fine-reports/FINE_REPORTS.md)**

**Mô tả**: Lập, lưu và tra cứu biên bản phạt coins; thành viên được cấp role
có thể lập, cá nhân xem biên bản của mình và quản trị viên cập nhật trạng thái.

**Trạng thái**: ✅ **Đã triển khai**

**Lưu ý**: Bot chỉ ghi nhận coins, không tự trừ. Quản trị viên xử lý coins riêng
rồi cập nhật trạng thái theo mã biên bản.

**Lệnh**: `/fine create`, `/fine list`, `/fine detail`, `/fine status`

### 8. 🎲 Sự kiện random coins
📄 **[RANDOM_COINS.md](./random-coins/RANDOM_COINS.md)**

**Mô tả**: Quản trị viên tạo embed sự kiện có nút random; mỗi thành viên nhận
một kết quả riêng trong từng sự kiện, không có giao dịch coins.

**Lệnh**: `/coin-random create`

---

## 🗂️ Cấu trúc mã nguồn

### Hệ thống trả lương
```text
src/
├── features/payroll/
│   ├── index.js                      # Xuất module
│   ├── scheduler.js                  # Tác vụ định kỳ
│   ├── commands/
│   │   ├── salaryCoefficient.js      # /salary-coefficient
│   │   ├── salaryRoles.js            # /salary-roles
│   │   ├── salarySchedule.js         # /salary-schedule
│   │   └── salaryPayoutNow.js        # /salary-payout-now
│   └── services/
│       ├── apiClient.js              # Trình gọi API trả lương
│       └── payrollService.js         # Xử lý nghiệp vụ
├── database/
│   └── payroll.js                    # Thao tác dữ liệu MongoDB
└── schedulers/
    └── (scheduler trả lương được tích hợp trong tính năng)
```

### Hệ thống kiểm tra tên
```text
src/
├── features/rename/
│   ├── index.js                      # Xuất module
│   ├── command.js                    # Lệnh /rename
│   ├── modal.js                      # Biểu mẫu
│   └── validate.js                   # Kiểm tra tên
├── services/
│   └── nameValidationService.js      # Xử lý kiểm tra tên
├── database/
│   └── violations.js                 # Thao tác dữ liệu MongoDB
├── events/
│   ├── guildMemberAdd.js             # Kiểm tra khi tham gia máy chủ
│   ├── guildMemberUpdate.js          # Kiểm tra khi đổi biệt danh
│   ├── messageCreate.js              # Kiểm tra khi gửi tin nhắn đầu tiên
│   └── voiceStateUpdate.js           # Kiểm tra khi vào kênh thoại
└── schedulers/
    └── violationChecker.js           # Lập lịch tự động kick
```

---

## 🚀 Liên kết nhanh

| Tính năng | Tài liệu | Mã nguồn chính | Lệnh |
|---|---|---|---|
| **Trả lương** | [📄](./payroll/PAYROLL_SYSTEM.md) | `src/features/payroll/index.js` | `/salary-*` |
| **Kiểm tra tên** | [📄](./name-validation/NAME_VALIDATION_SYSTEM.md) | `src/features/rename/index.js` | `/rename` |
| **Sinh nhật** | [📄](./birthday/BIRTHDAY_FEATURE.md) | `src/services/birthdayService.js` | `/api/birthdays/*` |
| **Theo dõi hệ thống** | [📄](./system-monitoring/SYSTEM_MONITORING.md) | `src/features/system-monitoring/` | `/battery`, `/battery-alert-role`, `GET /api/system` |
| **Nhận role bằng biểu tượng cảm xúc** | [📄](./reaction-roles/REACTION_ROLES_WORKFLOW.md) | `src/features/reactionRoles/index.js` | `/reaction-role` |
| **Role tạm thời** | [📄](./temporary-roles/TEMPORARY_ROLES.md) | `src/features/temporaryRoles/index.js` | `/role` |
| **Biên bản phạt coins** | [📄](./fine-reports/FINE_REPORTS.md) | `src/features/fineReports/index.js` | `/fine` |
| **Sự kiện random coins** | [📄](./random-coins/RANDOM_COINS.md) | `src/features/coinRandom/index.js` | `/coin-random` |

---

## 📝 Hướng dẫn viết tài liệu

Khi viết tài liệu cho tính năng mới, hãy bao gồm:

1. **Tổng quan**
   - Mục đích chính
   - Đặc điểm nổi bật
   - Trạng thái (đang phát triển/hoàn thành)
2. **Kiến trúc**
   - Sơ đồ kiến trúc (ASCII/Mermaid)
   - Các thành phần chính
   - Các phụ thuộc
3. **Luồng nghiệp vụ**
   - Luồng trình tự
   - Quy tắc nghiệp vụ
   - Trường hợp ngoại lệ
4. **Cơ sở dữ liệu**
   - Cấu trúc collection
   - Chỉ mục
   - Quan hệ
5. **API và lệnh**
   - Lệnh slash
   - Bộ xử lý sự kiện
   - API bên ngoài
6. **Cấu hình**
   - Biến môi trường
   - Tùy chọn cấu hình
   - Giá trị mặc định
7. **Kiểm thử**
   - Kịch bản kiểm thử
   - Trường hợp ngoại lệ
   - Danh sách kiểm tra

---

*Cập nhật lần cuối: 2026-10-23*
