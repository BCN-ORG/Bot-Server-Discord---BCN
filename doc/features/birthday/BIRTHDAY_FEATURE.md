# Birthday Feature

Hệ thống API để lấy danh sách members có sinh nhật theo ngày.

---

## Tổng quan

Birthday Feature cung cấp REST API endpoints để:
- Lấy danh sách members có sinh nhật hôm nay
- Lấy danh sách members có sinh nhật vào ngày cụ thể
- Tự động detect timezone Việt Nam (Asia/Ho_Chi_Minh)

---

## Cấu trúc thư mục

```
src/
├── configs/
│   └── birthday.config.js         # Cấu hình feature
├── controllers/
│   └── birthdayController.js      # HTTP request handlers
├── services/
│   └── birthdayService.js         # Business logic
├── repositories/
│   └── memberRepository.js        # Database queries
├── routes/
│   ├── index.js                   # Main routes
│   └── birthdayRoutes.js          # Birthday routes
└── database/
    └── bcn.js                     # BCN database connection
```

---

## Database Schema

### Collection: `BCN.members`

```javascript
{
  _id: ObjectId('...'),
  studentId: '24668051',           // Mã sinh viên
  cohort: 'K20',                   // Khóa
  fullName: 'Nguyễn Ngọc Thùy Dương',  // Họ tên
  dob: '24/01/2006',               // Ngày sinh (DD/MM/YYYY)
  email: 'duongnguyen@gmail.com',  // Email
  phone: '0833173195',             // SĐT
  major: '',                       // Chuyên ngành
  role: 'Thành viên',              // Vai trò
  status: 'Đang hoạt động'         // Trạng thái
}
```

---

## API Endpoints

Birthday endpoints require the `X-API-Key` header. Configure one or more
comma-separated keys with `API_KEYS` in `.env`. `/api/health` remains public.

### 1. GET `/api/birthdays/today`

Lấy danh sách members có sinh nhật hôm nay (theo timezone VN).

**Example:**
```bash
curl http://localhost:3000/api/birthdays/today \
  -H "X-API-Key: $API_KEY"
```

**Response:**
```json
{
  "success": true,
  "date": "19/10/2026",
  "count": 2,
  "data": [...]
}
```

---

### 2. POST `/api/birthdays/by-date`

Lấy danh sách members có sinh nhật vào ngày cụ thể.

**Example:**
```bash
curl -X POST http://localhost:3000/api/birthdays/by-date \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"date":"24/01"}'
```

**Response:**
```json
{
  "success": true,
  "date": "24/01",
  "count": 3,
  "data": [...]
}
```

---

## Luồng xử lý

```
HTTP Request
    ↓
Route (birthdayRoutes.js)
    ↓
Controller (birthdayController.js)
    ↓
Service (birthdayService.js)
    ↓
Repository (memberRepository.js)
    ↓
Database (BCN.members)
    ↓
MongoDB Query: { dob: /^DD\/MM\// }
    ↓
Transform & Return
```

---

## Chi tiết từng layer

### 1. Routes Layer (`birthdayRoutes.js`)

Định nghĩa endpoints và mapping tới controllers.

```javascript
router.get('/today', birthdayController.getTodayBirthdays);
router.post('/by-date', birthdayController.getBirthdaysByDate);
```

---

### 2. Controller Layer (`birthdayController.js`)

Xử lý HTTP requests, validation, và trả về responses.

**Responsibilities:**
- Parse request body/params
- Validate input
- Call service layer
- Format response
- Handle errors

**Example:**
```javascript
export async function getTodayBirthdays(req, res) {
  try {
    const members = await birthdayService.getTodayBirthdays();
    res.status(200).json({
      success: true,
      count: members.length,
      data: members
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
```

---

### 3. Service Layer (`birthdayService.js`)

Business logic và data transformation.

**Responsibilities:**
- Business rules
- Data validation
- Call repository
- Transform data format

**Example:**
```javascript
export async function getTodayBirthdays() {
  const members = await memberRepository.getMembersWithBirthdayToday();
  
  // Transform: _id ObjectId → string
  return members.map(member => ({
    id: member._id.toString(),
    ...member
  }));
}
```

---

### 4. Repository Layer (`memberRepository.js`)

Database queries và data access.

**Responsibilities:**
- MongoDB queries
- Database operations
- Return raw data

**Example:**
```javascript
export async function getMembersByBirthday(dateString) {
  const db = getBCNDatabase();
  const regex = new RegExp(`^${dateString}/`);
  
  return await db.collection('members').find({
    dob: { $regex: regex }
  }).toArray();
}
```

---

### 5. Database Layer (`bcn.js`)

MongoDB connection management.

**Responsibilities:**
- Connect to BCN database
- Export database instance
- Handle connection errors

---

## Query Logic

### Date Matching với Regex

**Input:** `"24/01"` (DD/MM)  
**Database:** `"24/01/2006"`, `"24/01/2005"`, ... (DD/MM/YYYY)

**Query:**
```javascript
const regex = new RegExp(`^24/01/`);
db.collection('members').find({ dob: { $regex: regex } });
```

**Matches:**
- ✅ `"24/01/2006"`
- ✅ `"24/01/2005"`
- ✅ `"24/01/2000"`
- ❌ `"25/01/2006"`
- ❌ `"01/24/2006"`

---

## Timezone Handling

### Get Current Date in Vietnam

```javascript
const now = new Date();
const vietnamDate = new Date(
  now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })
);

const day = String(vietnamDate.getDate()).padStart(2, '0');
const month = String(vietnamDate.getMonth() + 1).padStart(2, '0');
const dateString = `${day}/${month}`;
```

**Example:**
- Server time: `2026-10-19 03:00 UTC` (Thứ Hai sáng)
- Vietnam time: `2026-10-19 10:00 +07` (Thứ Hai sáng)
- `dateString`: `"19/10"`

---

## Error Handling

### Validation Errors (400)

```javascript
// Missing date field
{
  "success": false,
  "error": "Bad request",
  "message": "Field \"date\" is required"
}

// Invalid format
{
  "success": false,
  "error": "Bad request",
  "message": "Invalid date format. Expected DD/MM"
}
```

### Server Errors (500)

```javascript
{
  "success": false,
  "error": "Internal server error",
  "message": "Connection to BCN database failed"
}
```

---

## Testing

### Manual Test với curl

```bash
# Test today's birthdays
curl http://localhost:3000/api/birthdays/today \
  -H "X-API-Key: $API_KEY"

# Test specific date
curl -X POST http://localhost:3000/api/birthdays/by-date \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"date":"24/01"}'

# Test invalid format (should return 400)
curl -X POST http://localhost:3000/api/birthdays/by-date \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"date":"2024-01-24"}'
```

---

## Configuration

File: `src/configs/birthday.config.js`

```javascript
export const BIRTHDAY_CONFIG = {
  TIMEZONE: 'Asia/Ho_Chi_Minh',
  DATE_FORMAT: 'DD/MM',
  DATABASE_NAME: 'BCN',
  COLLECTION_NAME: 'members'
};
```

---

## Environment Variables

Không cần thêm biến môi trường mới. Sử dụng:

```bash
# From atlas-credentials.env
MONGODB_URI=mongodb+srv://...
```

---

## Monitoring & Logging

### Logs Example

```
[BCN] Connecting to BCN database...
[BCN] Connected successfully to BCN database
[MemberRepo] Getting members with birthday today: 19/10
[MemberRepo] Found 2 members with birthday 19/10
[BirthdayService] Error getting today birthdays: ...
```

---

## Future Improvements

1. **Caching:** Cache results trong 1 ngày
2. **Pagination:** Thêm limit/offset cho kết quả lớn
3. **Discord Integration:** Tự động gửi thông báo sinh nhật
4. **Statistics:** Endpoint thống kê sinh nhật theo tháng
5. **Birthday Reminders:** Scheduler gửi reminder trước N ngày

---

## Troubleshooting

### Issue: "Database not connected"

**Solution:**
```javascript
// Ensure connectBCN() is called in index.js
await connectBCN();
```

### Issue: "No members found"

**Possible causes:**
- Database BCN không có collection `members`
- Field `dob` không đúng format DD/MM/YYYY
- Timezone khác nhau giữa server và VN

---

## API Documentation

Xem chi tiết: [`doc/api/BIRTHDAY_API.md`](../../api/BIRTHDAY_API.md)
