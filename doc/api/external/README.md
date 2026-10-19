# External APIs

API được cung cấp bởi các services bên ngoài mà Discord Bot của chúng ta gọi vào.

---

## 📋 Danh sách APIs

### 1. **Payroll API**

**Provider:** Bot "Viện kiểm sát"  
**Purpose:** Hệ thống trả lương tự động  
**Documentation:** [PAYROLL_API.md](./PAYROLL_API.md)

**Base URL:** `http://localhost:3000/api/payroll` (hoặc URL production)

**Key Endpoints:**
- `POST /transfer` - Chuyển coins cho user
- `GET /balance` - Lấy số dư ví bot

**Authentication:** 
- API Key trong header `X-API-Key`
- Hoặc env variable `PAYROLL_API_KEY`

**Status:** ✅ Active

---

## 🔐 Authentication

Tất cả External APIs đều yêu cầu authentication.

### **API Key Format:**

**Header:**
```
X-API-Key: your_api_key_here
```

**Environment Variable:**
```bash
# .env
PAYROLL_API_KEY=your_api_key_here
PAYROLL_API_BASE_URL=http://localhost:3000/api/payroll
```

---

## 📝 Request/Response Format

### **Standard Success Response:**

```json
{
  "success": true,
  "data": {
    "status": "SUCCESS",
    "userId": "123456789",
    "amount": 10,
    "balance": 1000
  },
  "message": "Transfer completed successfully"
}
```

### **Standard Error Response:**

```json
{
  "success": false,
  "error": "INSUFFICIENT_BALANCE",
  "message": "Wallet balance is insufficient",
  "statusCode": 400
}
```

---

## 🚦 HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Request successful |
| 400 | Bad Request | Invalid input parameters |
| 401 | Unauthorized | Missing/invalid API key |
| 403 | Forbidden | User không có quyền |
| 404 | Not Found | User/Resource không tồn tại |
| 409 | Conflict | Duplicate request |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Service đang khởi động |

---

## 🔄 Retry Policy

### **Nên retry:**
- `409 Conflict` - Request trùng đang xử lý (backoff: 2s, 4s, 8s)
- `503 Service Unavailable` - Service đang khởi động
- Network timeout/errors

### **Không nên retry:**
- `400 Bad Request` - Dữ liệu sai
- `401 Unauthorized` - API key sai
- `403 Forbidden` - Không có quyền
- `404 Not Found` - Resource không tồn tại

**Max retries:** 3 lần  
**Backoff strategy:** Exponential (2s → 4s → 8s)

---

## 🧪 Testing

### **Development:**

```bash
# Test với local API
curl -X POST http://localhost:3000/api/payroll/transfer \
  -H "X-API-Key: test_key_123" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "123456789",
    "roleId": "987654321",
    "amount": 10,
    "description": "Test transfer"
  }'
```

### **Production:**

```bash
# Thay URL và API key thật
curl -X POST https://api.production.com/api/payroll/transfer \
  -H "X-API-Key: $PAYROLL_API_KEY" \
  -H "Content-Type: application/json" \
  -d @request.json
```

---

## 📊 API Monitoring

### **Health Check:**

Kiểm tra API có hoạt động không:

```bash
curl http://localhost:3000/api/payroll/health
```

### **Rate Limiting:**

Một số API có thể có rate limits:
- **Requests per minute:** 60
- **Burst limit:** 100

---

## 🔗 Dependencies

| API | Required By | Purpose |
|-----|-------------|---------|
| Payroll API | Payroll Feature | Trả lương tự động |

---

## 📚 Related Documentation

- [API Overview](../README.md)
- [Internal APIs](../internal/)
- [Payroll Feature](../../features/payroll/)

---

## ⚠️ Important Notes

1. **Bảo mật API Keys:**
   - Không commit vào git
   - Lưu trong `.env` hoặc secrets manager
   - Rotate định kỳ

2. **Error Handling:**
   - Luôn check `success` field
   - Log errors để debug
   - Có fallback strategy

3. **Versioning:**
   - API có thể thay đổi
   - Follow changelog của provider
   - Test kỹ khi upgrade

---

_Last updated: October 19, 2026_
