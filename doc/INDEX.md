# Danh mục tài liệu

> 📚 **Tất cả tài liệu về bot Discord tại một chỗ**

---

## 🎯 Bắt đầu nhanh

### Mới tham gia dự án?
👉 **[QUICK_START.md](./QUICK_START.md)** - Cài đặt bot trong 5 phút

### Muốn hiểu tổng quan?
👉 **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Kiến trúc hệ thống đầy đủ

### Muốn tìm hiểu một tính năng cụ thể?
👉 **[features/README.md](./features/README.md)** - Danh sách tất cả tính năng

---

## 📖 Tài liệu chính

### 1. Bắt đầu
- **[QUICK_START.md](./QUICK_START.md)** - Hướng dẫn cài đặt và thao tác thường dùng
- **[README.md](./README.md)** - Tổng quan cấu trúc tài liệu

### 2. Thiết kế hệ thống
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Kiến trúc tổng thể, luồng dữ liệu và tích hợp

### 3. Tài liệu tính năng
- **[features/README.md](./features/README.md)** - Danh mục tất cả tính năng
- **[features/payroll/PAYROLL_SYSTEM.md](./features/payroll/PAYROLL_SYSTEM.md)** - Hệ thống trả lương
- **[features/name-validation/NAME_VALIDATION_SYSTEM.md](./features/name-validation/NAME_VALIDATION_SYSTEM.md)** - Hệ thống kiểm tra tên
- **[features/birthday/BIRTHDAY_FEATURE.md](./features/birthday/BIRTHDAY_FEATURE.md)** - Tính năng sinh nhật
- **[features/system-monitoring/SYSTEM_MONITORING.md](./features/system-monitoring/SYSTEM_MONITORING.md)** - Theo dõi thông tin thiết bị
- **[features/reaction-roles/REACTION_ROLES_WORKFLOW.md](./features/reaction-roles/REACTION_ROLES_WORKFLOW.md)** - Quy trình nhận role bằng biểu tượng cảm xúc
- **[features/temporary-roles/TEMPORARY_ROLES.md](./features/temporary-roles/TEMPORARY_ROLES.md)** - Cấp và thu hồi role tạm thời
- **[features/fine-reports/FINE_REPORTS.md](./features/fine-reports/FINE_REPORTS.md)** - Lập và tra cứu biên bản phạt coins
- **[features/random-coins/RANDOM_COINS.md](./features/random-coins/RANDOM_COINS.md)** - Sự kiện random coins

### 4. Tài liệu API
- **[api/external/PAYROLL_API.md](./api/external/PAYROLL_API.md)** - API trả lương bên ngoài
- **[api/internal/SYSTEM_API.md](./api/internal/SYSTEM_API.md)** - API thông tin hệ thống nội bộ

---

## 🗺️ Lộ trình đọc tài liệu

### Dành cho nhà phát triển mới
```
1. QUICK_START.md        (5 phút)
   └─► Cài đặt và chạy bot

2. ARCHITECTURE.md       (15 phút)
   └─► Hiểu tổng quan hệ thống

3. features/README.md    (5 phút)
   └─► Tổng quan các tính năng

4. Tài liệu từng tính năng (khi cần)
   └─► Xem chi tiết từng tính năng
```

### Dành cho quản lý sản phẩm
```
1. README.md             (2 phút)
   └─► Cấu trúc tài liệu

2. features/README.md    (5 phút)
   └─► Các tính năng hiện có

3. Tài liệu tính năng    (10-15 phút mỗi tính năng)
   └─► Quy tắc nghiệp vụ và luồng xử lý
```

### Dành cho DevOps/SRE
```
1. QUICK_START.md        (5 phút)
   └─► Cài đặt và cấu hình

2. ARCHITECTURE.md       (15 phút)
   └─► Các phụ thuộc và tích hợp

3. Phần giám sát         (trong ARCHITECTURE.md)
   └─► Nhật ký và số liệu
```

---

## 📂 Cây thư mục tài liệu

```
doc/
├── INDEX.md                                    # ⭐ Tệp này
├── README.md                                   # Tổng quan cấu trúc tài liệu
├── QUICK_START.md                              # 🚀 Cài đặt nhanh
├── ARCHITECTURE.md                             # 🏗️ Kiến trúc hệ thống
│
├── api/                                        # 🔌 API bên ngoài và nội bộ
│   ├── external/
│   │   └── PAYROLL_API.md                     # Tài liệu API trả lương
│   └── internal/
│       ├── BIRTHDAY_API.md
│       └── SYSTEM_API.md                      # Thông tin hệ thống Android/Termux
│
└── features/                                   # ✨ Tài liệu tính năng
    ├── README.md                               # Danh mục tính năng
    ├── payroll/
    │   └── PAYROLL_SYSTEM.md                  # 💰 Hệ thống trả lương
    ├── name-validation/
    │   └── NAME_VALIDATION_SYSTEM.md          # ✏️ Kiểm tra tên
    ├── birthday/
    │   └── BIRTHDAY_FEATURE.md                 # 🎂 Tính năng sinh nhật
    ├── system-monitoring/
    │   └── SYSTEM_MONITORING.md               # 📱 Theo dõi hệ thống
    ├── reaction-roles/
    │   └── REACTION_ROLES_WORKFLOW.md         # 🎭 Quy trình nhận role bằng biểu tượng cảm xúc
    ├── temporary-roles/
    │   └── TEMPORARY_ROLES.md                 # ⏳ Quản lý role tạm thời
    ├── fine-reports/
        └── FINE_REPORTS.md                    # 🧾 Biên bản phạt coins
    └── random-coins/
        └── RANDOM_COINS.md                    # 🎲 Sự kiện random coins
```

---

## 🔍 Tìm kiếm nhanh

### Tôi muốn...

| Mục tiêu | Xem file |
|----------|----------|
| Cài đặt bot từ đầu | [QUICK_START.md](./QUICK_START.md) |
| Hiểu kiến trúc tổng thể | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Thêm role trả lương | [features/payroll/PAYROLL_SYSTEM.md](./features/payroll/PAYROLL_SYSTEM.md) |
| Cấu hình kiểm tra tên | [features/name-validation/NAME_VALIDATION_SYSTEM.md](./features/name-validation/NAME_VALIDATION_SYSTEM.md) |
| Gọi API trả lương | [api/external/PAYROLL_API.md](./api/external/PAYROLL_API.md) |
| Xem API thông tin thiết bị | [api/internal/SYSTEM_API.md](./api/internal/SYSTEM_API.md) |
| Xem quy trình nhận role bằng biểu tượng cảm xúc | [features/reaction-roles/REACTION_ROLES_WORKFLOW.md](./features/reaction-roles/REACTION_ROLES_WORKFLOW.md) |
| Tra cứu tính năng sinh nhật | [features/birthday/BIRTHDAY_FEATURE.md](./features/birthday/BIRTHDAY_FEATURE.md) |
| Lập hoặc tra cứu biên bản phạt coins | [features/fine-reports/FINE_REPORTS.md](./features/fine-reports/FINE_REPORTS.md) |
| Tạo sự kiện random coins | [features/random-coins/RANDOM_COINS.md](./features/random-coins/RANDOM_COINS.md) |
| Xử lý sự cố MongoDB | [ARCHITECTURE.md](./ARCHITECTURE.md) → Phần cơ sở dữ liệu |
| Xem tất cả lệnh | [features/README.md](./features/README.md) |
| Khắc phục sự cố | [QUICK_START.md](./QUICK_START.md) → Phần khắc phục sự cố |

---

## 📊 Thống kê tài liệu

- **Số tính năng đã có tài liệu**: 8 (Trả lương, Kiểm tra tên, Sinh nhật, Theo dõi hệ thống, Nhận role bằng biểu tượng cảm xúc, Role tạm thời, Biên bản phạt coins, Sự kiện random coins)
- **Số API**: 1 bên ngoài, 2 nội bộ
- **Cập nhật lần cuối**: 2026-10-23

---

## 🤝 Đóng góp

Khi cập nhật tài liệu:
1. ✅ Cập nhật tệp liên quan
2. ✅ Cập nhật INDEX.md nếu thêm tệp mới
3. ✅ Cập nhật ngày chỉnh sửa
4. ✅ Kiểm tra định dạng Markdown
5. ✅ Tạo commit với thông điệp rõ ràng

---

*Tài liệu được nhóm phát triển duy trì*
