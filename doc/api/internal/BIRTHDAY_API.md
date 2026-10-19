# Birthday API Documentation

## Authentication

Các endpoint `/api/birthdays/*` yêu cầu API key trong header `X-API-Key`.
Thiết lập một hoặc nhiều key trong biến môi trường `API_KEYS`, phân tách bằng dấu phẩy.
Không commit key vào Git. Endpoint `/api/health` không yêu cầu key.
Mỗi client sử dụng một key riêng; `$API_KEY` trong ví dụ là một giá trị đơn lẻ
được lấy từ danh sách `API_KEYS`.

```bash
curl http://localhost:3000/api/birthdays/today \
  -H "X-API-Key: $API_KEY"
```

API endpoints để lấy danh sách members có sinh nhật.

---

## Base URL

```
http://localhost:3000/api
```

---

## Endpoints

### 1. Health Check

**Endpoint:** `GET /health`

**Description:** Kiểm tra API có hoạt động không.

**Response:**
```json
{
  "success": true,
  "message": "Discord Bot API is running",
  "timestamp": "2026-10-19T10:30:00.000Z"
}
```

---

### 2. Get Today's Birthdays

**Endpoint:** `GET /birthdays/today`

**Description:** Lấy danh sách members có sinh nhật hôm nay (theo timezone Việt Nam).

**Request:**
```bash
curl -X GET http://localhost:3000/api/birthdays/today \
  -H "X-API-Key: $API_KEY"
```

**Response Success (200):**
```json
{
  "success": true,
  "date": "19/10/2026",
  "count": 2,
  "data": [
    {
      "id": "123",
      "studentId": "24000001",
      "fullName": "Nguyễn Văn A",
      "dob": "01/01/2000",
      "cohort": "K20",
      "email": "A@gmail.com",
      "phone": "0300000000",
      "major": "",
      "role": "Thành viên",
      "status": "Đang hoạt động"
    }
  ]
}
```

**Response Empty (200):**
```json
{
  "success": true,
  "date": "19/10/2026",
  "count": 0,
  "data": []
}
```

**Response Error (500):**
```json
{
  "success": false,
  "error": "Internal server error",
  "message": "Error details..."
}
```

Missing or invalid `X-API-Key` returns `401 Unauthorized`. If `API_KEYS` is not
configured, the endpoint returns `503 Service Unavailable`.

---

### 3. Get Birthdays by Date

**Endpoint:** `POST /birthdays/by-date`

**Description:** Lấy danh sách members có sinh nhật vào ngày cụ thể.

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "date": "24/01"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/birthdays/by-date \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"date":"24/01"}'
```

**Response Success (200):**
```json
{
  "success": true,
  "date": "24/01",
  "count": 3,
  "data": [
    {
      "id": "6ad5c2770235488236a5b18d",
      "studentId": "24668051",
      "fullName": "Nguyễn Ngọc Thùy Dương",
      "dob": "24/01/2006",
      "cohort": "K20",
      "email": "duongnguyen.24012006@gmail.com",
      "phone": "0833173195",
      "major": "",
      "role": "Thành viên",
      "status": "Đang hoạt động"
    },
    {
      "id": "6ad5c2770235488236a5b18e",
      "studentId": "24668052",
      "fullName": "Trần Văn Nam",
      "dob": "24/01/2005",
      "cohort": "K19",
      "email": "nam.tv@example.com",
      "phone": "0912345678",
      "major": "CNTT",
      "role": "Thành viên",
      "status": "Đang hoạt động"
    }
  ]
}
```

**Response Bad Request (400):**
```json
{
  "success": false,
  "error": "Bad request",
  "message": "Field \"date\" is required in request body (format: DD/MM)"
}
```

```json
{
  "success": false,
  "error": "Bad request",
  "message": "Invalid date format. Expected DD/MM (e.g., \"24/01\")"
}
```

**Response Error (500):**
```json
{
  "success": false,
  "error": "Internal server error",
  "message": "Error details..."
}
```

---

## Data Model

### Member Object

```typescript
{
  id: string;          // MongoDB ObjectId as string
  studentId: string;   // Mã sinh viên
  fullName: string;    // Họ tên đầy đủ
  dob: string;         // Ngày sinh (DD/MM/YYYY)
  cohort: string;      // Khóa (K19, K20, ...)
  email: string;       // Email
  phone: string;       // Số điện thoại
  major: string;       // Chuyên ngành
  role: string;        // Vai trò trong CLB
  status: string;      // Trạng thái
}
```

---

## Notes

### Date Format
- **Input format:** `DD/MM` (2 chữ số ngày + 2 chữ số tháng)
- **Examples:** `"01/01"`, `"24/12"`, `"31/05"`
- **Database format:** `DD/MM/YYYY` (vd: `"24/01/2006"`)
- **Query logic:** Regex match `^DD/MM/` để tìm tất cả năm

### Timezone
- API sử dụng timezone **Asia/Ho_Chi_Minh** (UTC+7)
- Endpoint `/birthdays/today` tự động lấy ngày hiện tại theo timezone VN

### Database
- **Database name:** `BCN`
- **Collection:** `members`
- **Connection:** Dùng chung `MONGODB_URI` từ `atlas-credentials.env`

---

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 400 | Bad Request (invalid input) |
| 500 | Internal Server Error |

---

## Testing

### Test với curl:

```bash
# 1. Health check
curl http://localhost:3000/api/health

# 2. Get today's birthdays
curl http://localhost:3000/api/birthdays/today \
  -H "X-API-Key: $API_KEY"

# 3. Get birthdays by specific date
curl -X POST http://localhost:3000/api/birthdays/by-date \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"date":"24/01"}'
```

### Test với Postman:

1. Import collection từ file hoặc tạo manual
2. Base URL: `http://localhost:3000/api`
3. Thêm requests theo endpoints trên

---

## Architecture

```
Request
   │
   ├─► Route (/api/birthdays/today)
   │      │
   │      ├─► Controller (birthdayController.getTodayBirthdays)
   │      │      │
   │      │      ├─► Service (birthdayService.getTodayBirthdays)
   │      │      │      │
   │      │      │      ├─► Repository (memberRepository.getMembersWithBirthdayToday)
   │      │      │      │      │
   │      │      │      │      └─► Database (BCN.members)
   │      │      │      │
   │      │      │      └─► Transform data
   │      │      │
   │      │      └─► Return response
   │      │
   │      └─► Response JSON
```

---

## Future Enhancements

- [ ] Add pagination for large result sets
- [ ] Add filtering by cohort, role, status
- [ ] Add birthday reminders via Discord notifications
- [ ] Add caching layer (Redis) for performance
- [ ] Add authentication/authorization
- [ ] Add rate limiting
- [ ] Add birthday statistics endpoint
