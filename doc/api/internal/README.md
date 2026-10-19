# Internal APIs

API nội bộ của Discord Bot server, chỉ sử dụng trong hệ thống.

---

## 📋 Danh sách APIs

### 1. **Birthday API**

**Purpose:** Lấy danh sách members có sinh nhật  
**Documentation:** [BIRTHDAY_API.md](./BIRTHDAY_API.md)

**Base URL:** `http://localhost:3000/api`

**Key Endpoints:**
- `GET /birthdays/today` - Members sinh nhật hôm nay
- `POST /birthdays/by-date` - Members sinh nhật theo ngày

**Authentication:** API key qua header `X-API-Key`; `/api/health` public

**Status:** ✅ Active

---

## 🏠 Scope

### **Internal APIs là gì?**

API chỉ dùng trong nội bộ server, không expose ra internet công khai.

**Đặc điểm:**
- Chạy trên `localhost` hoặc private network
- Birthday endpoints vẫn yêu cầu API key, kể cả khi gọi nội bộ
- Khai báo một hoặc nhiều key trong `API_KEYS`, phân tách bằng dấu phẩy
- `/api/health` public để health check

---

## 🔐 Authentication

Birthday API xác thực bằng API key trong header `X-API-Key`.

---

## 📝 Request/Response Format

### **Standard Success Response:**

```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": "...",
      "fullName": "Nguyễn Văn A",
      "dob": "19/10/2006"
    }
  ]
}
```

### **Empty Results:**

```json
{
  "success": true,
  "count": 0,
  "data": []
}
```

### **Error Response:**

```json
{
  "success": false,
  "error": "Bad request",
  "message": "Invalid date format. Expected DD/MM"
}
```

---

## 🚦 HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Request successful |
| 400 | Bad Request | Invalid input |
| 401 | Unauthorized | Missing or invalid API key |
| 503 | Service Unavailable | `API_KEYS` is not configured |
| 500 | Internal Server Error | Server error |

---

## 🧪 Testing

### **Manual Test:**

```bash
# Health check
curl http://localhost:3000/api/health

# Birthday today
curl http://localhost:3000/api/birthdays/today \
  -H "X-API-Key: $API_KEY"

# Birthday by date
curl -X POST http://localhost:3000/api/birthdays/by-date \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"date":"24/01"}'
```

### **Automated Test:**

```bash
# Run test script
./test-birthday-api.sh
```

---

## 🔌 Usage

### **Từ Discord Commands:**

```javascript
// Trong Discord slash command
import * as birthdayService from '../services/birthdayService.js';

const members = await birthdayService.getTodayBirthdays();
// Gửi message với danh sách members
```

### **Từ Schedulers:**

```javascript
// Scheduler chạy mỗi ngày
import * as birthdayService from '../services/birthdayService.js';

cron.schedule('0 8 * * *', async () => {
  const members = await birthdayService.getTodayBirthdays();
  if (members.length > 0) {
    // Gửi notification
  }
});
```

### **Từ HTTP Endpoints:**

```bash
# External tool gọi vào
curl http://localhost:3000/api/birthdays/today \
  -H "X-API-Key: $API_KEY"
```

---

## 📊 Architecture

```
┌─────────────────────────────────┐
│     Discord Bot Commands        │
│     Internal Schedulers         │
│     HTTP Requests (localhost)   │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│      Express Routes             │
│      /api/birthdays/*           │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│      Controllers                │
│      (HTTP handlers)            │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│      Services                   │
│      (Business logic)           │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│      Repositories               │
│      (Database access)          │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│      MongoDB (BCN database)     │
└─────────────────────────────────┘
```

---

## 🔗 Related Services

| API | Used By | Purpose |
|-----|---------|---------|
| Birthday API | Future: Birthday scheduler | Sinh nhật tự động |

---

## 🛠️ Development

### **Thêm Internal API mới:**

1. **Create routes:**
   ```javascript
   // src/routes/newRoutes.js
   import express from 'express';
   const router = express.Router();
   
   router.get('/endpoint', controller.handler);
   export default router;
   ```

2. **Register routes:**
   ```javascript
   // src/routes/index.js
   import newRoutes from './newRoutes.js';
   router.use('/new', newRoutes);
   ```

3. **Document API:**
   ```bash
   # Create doc/api/internal/NEW_API.md
   ```

4. **Test:**
   ```bash
   curl http://localhost:3000/api/new/endpoint
   ```

---

## 📚 Related Documentation

- [API Overview](../README.md)
- [External APIs](../external/)
- [Features Documentation](../../features/)

---

## ⚠️ Security Notes

1. **Không expose ra internet:**
   - Chỉ bind localhost
   - Hoặc dùng firewall block external access

2. **Nếu cần expose:**
   - API key đã được yêu cầu cho Birthday API
   - Add rate limiting
   - Input validation nghiêm ngặt
   - HTTPS only

3. **Data protection:**
   - Không trả về sensitive data không cần thiết
   - Validate input để tránh injection

---

## 🎯 Future Plans

- [ ] Thêm birthday scheduler (gửi notification tự động)
- [ ] API thống kê members theo cohort
- [ ] API quản lý roles
- [ ] API logs và monitoring

---

_Last updated: October 19, 2026_
