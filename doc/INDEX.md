# Documentation Index

> 📚 **Tất cả tài liệu về Discord Bot tại một chỗ**

---

## 🎯 Bắt đầu nhanh

### Mới với dự án?
👉 **[QUICK_START.md](./QUICK_START.md)** - Setup bot trong 5 phút

### Muốn hiểu tổng quan?
👉 **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Kiến trúc hệ thống đầy đủ

### Tìm hiểu về features cụ thể?
👉 **[features/README.md](./features/README.md)** - Danh sách tất cả features

---

## 📖 Tài liệu chính

### 1. Getting Started
- **[QUICK_START.md](./QUICK_START.md)** - Hướng dẫn setup & common tasks
- **[README.md](./README.md)** - Tổng quan cấu trúc documentation

### 2. System Design
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Kiến trúc tổng thể, data flow, integrations

### 3. Features Documentation
- **[features/README.md](./features/README.md)** - Index của tất cả features
- **[features/payroll/PAYROLL_SYSTEM.md](./features/payroll/PAYROLL_SYSTEM.md)** - Hệ thống trả lương
- **[features/name-validation/NAME_VALIDATION_SYSTEM.md](./features/name-validation/NAME_VALIDATION_SYSTEM.md)** - Hệ thống kiểm tra tên
- **[features/system-monitoring/SYSTEM_MONITORING.md](./features/system-monitoring/SYSTEM_MONITORING.md)** - Theo dõi thông tin thiết bị

### 4. API References
- **[api/external/PAYROLL_API.md](./api/external/PAYROLL_API.md)** - Payroll API (external)
- **[api/internal/SYSTEM_API.md](./api/internal/SYSTEM_API.md)** - System statistics API (internal)

---

## 🗺️ Roadmap đọc tài liệu

### Cho Developer mới
```
1. QUICK_START.md        (5 phút)
   └─► Setup & run bot

2. ARCHITECTURE.md       (15 phút)
   └─► Hiểu tổng quan hệ thống

3. features/README.md    (5 phút)
   └─► Overview các features

4. Feature-specific docs (khi cần)
   └─► Chi tiết từng tính năng
```

### Cho Product/PM
```
1. README.md             (2 phút)
   └─► Cấu trúc docs

2. features/README.md    (5 phút)
   └─► Các tính năng hiện có

3. Feature docs          (10-15 phút mỗi feature)
   └─► Business logic & flows
```

### Cho DevOps/SRE
```
1. QUICK_START.md        (5 phút)
   └─► Setup & config

2. ARCHITECTURE.md       (15 phút)
   └─► Dependencies & integrations

3. Monitoring section    (trong ARCHITECTURE.md)
   └─► Logs & metrics
```

---

## 📂 File Tree

```
doc/
├── INDEX.md                                    # ⭐ File này
├── README.md                                   # Overview cấu trúc docs
├── QUICK_START.md                              # 🚀 Setup nhanh
├── ARCHITECTURE.md                             # 🏗️ System architecture
│
├── api/                                        # 🔌 External APIs
│   ├── external/
│   │   └── PAYROLL_API.md                     # Payroll API reference
│   └── internal/
│       ├── BIRTHDAY_API.md
│       └── SYSTEM_API.md                      # Android/Termux system statistics
│
└── features/                                   # ✨ Features documentation
    ├── README.md                               # Features index
    ├── payroll/
    │   └── PAYROLL_SYSTEM.md                  # 💰 Payroll system
    ├── name-validation/
    │   └── NAME_VALIDATION_SYSTEM.md          # ✏️ Name validation
    └── system-monitoring/
        └── SYSTEM_MONITORING.md               # 📱 System monitoring feature
```

---

## 🔍 Tìm kiếm nhanh

### Tôi muốn...

| Mục tiêu | Xem file |
|----------|----------|
| Setup bot từ đầu | [QUICK_START.md](./QUICK_START.md) |
| Hiểu kiến trúc tổng thể | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Thêm role trả lương | [features/payroll/PAYROLL_SYSTEM.md](./features/payroll/PAYROLL_SYSTEM.md) |
| Config name validation | [features/name-validation/NAME_VALIDATION_SYSTEM.md](./features/name-validation/NAME_VALIDATION_SYSTEM.md) |
| Gọi Payroll API | [api/external/PAYROLL_API.md](./api/external/PAYROLL_API.md) |
| Xem API thông tin thiết bị | [api/internal/SYSTEM_API.md](./api/internal/SYSTEM_API.md) |
| Debug MongoDB issues | [ARCHITECTURE.md](./ARCHITECTURE.md) → Database section |
| Xem tất cả commands | [features/README.md](./features/README.md) |
| Troubleshoot errors | [QUICK_START.md](./QUICK_START.md) → Troubleshooting |

---

## 📊 Documentation Stats

- **Features documented**: 3 (Payroll, Name Validation, System Monitoring)
- **APIs**: 1 external, 2 internal
- **Last updated**: 2026-10-18

---

## 🤝 Contributing

Khi cập nhật docs:
1. ✅ Update file liên quan
2. ✅ Update INDEX.md này nếu thêm file mới
3. ✅ Update "Last updated" date
4. ✅ Review formatting (Markdown)
5. ✅ Commit với message rõ ràng

---

*Documentation maintained by Development Team*
