# API Documentation

Tài liệu API của Discord Bot.

---

## 📁 Cấu trúc thư mục

```
doc/api/
├── README.md           # File này
├── external/           # API External (cho bên ngoài gọi vào)
│   └── PAYROLL_API.md  # API của bot "Viện kiểm sát" (payroll service)
└── internal/           # API Internal (nội bộ server)
    └── BIRTHDAY_API.md # API sinh nhật (internal endpoints)
```

---

## 🌐 External APIs

API được expose ra bên ngoài để các services khác gọi vào.

### **Payroll API** (`external/PAYROLL_API.md`)

**Provider:** Bot "Viện kiểm sát"  
**Consumer:** Discord Bot của chúng ta

**Endpoints:**
- `POST /api/payroll/transfer` - Chuyển coins cho user
- `GET /api/payroll/balance` - Lấy số dư ví bot

**Authentication:** API Key (PAYROLL_API_KEY)

**Docs:** [PAYROLL_API.md](./external/PAYROLL_API.md)

---

## 🏠 Internal APIs

API nội bộ của server bot, chỉ dùng trong hệ thống.

### **Birthday API** (`internal/BIRTHDAY_API.md`)

**Scope:** Internal server endpoints  
**Purpose:** Lấy danh sách members có sinh nhật

**Endpoints:**
- `GET /api/birthdays/today` - Members có sinh nhật hôm nay
- `POST /api/birthdays/by-date` - Members có sinh nhật theo ngày

**Authentication:** Header `X-API-Key` (danh sách key trong `API_KEYS`)

**Docs:** [BIRTHDAY_API.md](./internal/BIRTHDAY_API.md)

---

## 🔐 Authentication

### **External APIs:**
- Sử dụng **API Key** trong header `X-API-Key`
- Hoặc trong env variable (VD: `PAYROLL_API_KEY`)

### **Internal APIs:**
- Birthday endpoints yêu cầu API key qua header `X-API-Key`
- `/api/health` vẫn public để health check
- Khai báo một hoặc nhiều key trong `API_KEYS`, phân tách bằng dấu phẩy

---

## 📝 API Design Guidelines

### **Naming Convention:**
- **REST endpoints:** Dùng plural nouns (`/users`, `/birthdays`)
- **Actions:** Dùng verbs cho non-CRUD (`/transfer`, `/login`)
- **Versioning:** `/api/v1/...` (optional)

### **Response Format:**

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error type",
  "message": "Human-readable message"
}
```

### **HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (missing/invalid auth)
- `403` - Forbidden (not allowed)
- `404` - Not Found
- `500` - Internal Server Error

---

## 🛠️ Testing APIs

### **External APIs:**

Test với API keys thật:

```bash
# Payroll API
curl -X POST https://payroll-api.example.com/api/payroll/transfer \
  -H "X-API-Key: $PAYROLL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userId":"123","roleId":"456","amount":10}'
```

### **Birthday API:**

Gửi key trong header `X-API-Key`:

```bash
curl http://localhost:3000/api/birthdays/today \
  -H "X-API-Key: $API_KEY"
```

---

## 📊 API Comparison

| Feature | External APIs | Internal APIs |
|---------|--------------|---------------|
| **Purpose** | Inter-service communication | Nội bộ server |
| **Authentication** | Required (API Key) | Optional/None |
| **Hosting** | External services | Same server |
| **Network** | Public/Private internet | Localhost |
| **Documentation** | Must be complete | Can be simpler |
| **Versioning** | Highly recommended | Optional |
| **Rate Limiting** | Required | Optional |

---

## 🔄 Adding New APIs

### **Thêm External API:**

1. Tạo file: `doc/api/external/NEW_API.md`
2. Document endpoints, authentication, examples
3. Update file này (README.md) với link
4. Thêm vào `.env` nếu cần API keys

### **Thêm Internal API:**

1. Implement: `src/routes/newRoutes.js`
2. Document: `doc/api/internal/NEW_API.md`
3. Update file này (README.md) với link
4. Test endpoints

---

## 📚 Related Documentation

- [Architecture Overview](../ARCHITECTURE.md)
- [Quick Start Guide](../QUICK_START.md)
- [Features Documentation](../features/)

---

## 🎯 Quick Links

### External APIs
- [Payroll API](./external/PAYROLL_API.md)

### Internal APIs
- [Birthday API](./internal/BIRTHDAY_API.md)

---

_Last updated: October 19, 2026_
