# Documentation

Tài liệu hệ thống Discord Bot.

## Cấu trúc thư mục

```
doc/
├── README.md                    # File này
├── api/                         # Tài liệu API bên ngoài
│   └── PAYROLL_API.md          # API trả lương (Viện kiểm sát bot)
└── features/                    # Tài liệu các tính năng của bot
    ├── payroll/                 # Hệ thống trả lương tự động
    │   └── PAYROLL_SYSTEM.md   # Kiến trúc, luồng nghiệp vụ, commands
    └── name-validation/         # Hệ thống kiểm tra & quản lý tên
        └── (đang phát triển)
```

## Tài liệu theo tính năng

### 🔹 Payroll System (Trả lương tự động)
📄 [`features/payroll/PAYROLL_SYSTEM.md`](./features/payroll/PAYROLL_SYSTEM.md)

Hệ thống tự động trả lương hàng tuần cho members có role được cấu hình.

**Nội dung:**
- Kiến trúc hệ thống & luồng nghiệp vụ
- Cấu trúc database (4 collections)
- Admin commands (coefficient, roles, schedule, payout)
- Edge cases & error handling

### 🔹 Name Validation System (Kiểm tra tên)
📄 `features/name-validation/` _(đang phát triển)_

Hệ thống kiểm tra nickname thành viên và quản lý vi phạm.

**Nội dung:** (sẽ được bổ sung)
- Quy tắc kiểm tra tên
- Luồng vi phạm & kick tự động
- Rename workflow
- Exception list management

---

## Tài liệu API bên ngoài

### 🔸 Payroll API
📄 [`api/PAYROLL_API.md`](./api/PAYROLL_API.md)

API của bot "Viện kiểm sát" để thực hiện giao dịch trả lương.

**Endpoints:**
- `POST /transfer` - Trả lương cho 1 user
- `GET /balance` - Kiểm tra số dư ví bot
- `GET /payouts` - Lịch sử trả lương

---

## Hướng dẫn đóng góp tài liệu

Khi thêm tính năng mới:

1. Tạo thư mục trong `doc/features/<feature-name>/`
2. Tạo file markdown chính (ví dụ: `FEATURE_NAME_SYSTEM.md`)
3. Bao gồm các phần:
   - **Tổng quan**: Mục đích, đặc điểm chính
   - **Kiến trúc**: Diagram, components
   - **Luồng nghiệp vụ**: Sequence, business rules
   - **Database**: Collections, schema
   - **API/Commands**: Endpoints/slash commands
   - **Configuration**: Env vars, settings
   - **Error Handling**: Edge cases, retry logic
4. Cập nhật file README.md này

---

*Cập nhật lần cuối: 2026-10-18*
