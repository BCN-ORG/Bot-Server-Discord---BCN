# Tính năng sinh nhật

Hệ thống API dùng để lấy danh sách thành viên có sinh nhật theo ngày.

---

## Tổng quan

Tính năng sinh nhật cung cấp các điểm cuối REST API để:
- Lấy danh sách thành viên có sinh nhật hôm nay
- Lấy danh sách thành viên có sinh nhật vào ngày cụ thể
- Tự động nhận diện múi giờ Việt Nam (`Asia/Ho_Chi_Minh`)

---

## Cấu trúc thư mục mã nguồn

```
src/
├── configs/
│   └── birthday.config.js         # Cấu hình tính năng
├── controllers/
│   └── birthdayController.js      # Bộ xử lý yêu cầu HTTP
├── services/
│   └── birthdayService.js         # Xử lý nghiệp vụ
├── repositories/
│   └── memberRepository.js        # Truy vấn cơ sở dữ liệu
├── routes/
│   ├── index.js                   # Định tuyến chính
│   └── birthdayRoutes.js          # Định tuyến tính năng sinh nhật
└── database/
    └── bcn.js                     # Kết nối cơ sở dữ liệu BCN
```

---

## Cấu trúc cơ sở dữ liệu

### Bộ sưu tập `BCN.members`

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

## Các điểm cuối API

Các điểm cuối sinh nhật yêu cầu tiêu đề `X-API-Key`. Cấu hình một hoặc nhiều
khóa, phân tách bằng dấu phẩy, qua `API_KEYS` trong `.env`. Điểm cuối
`/api/health` vẫn được truy cập công khai.

### 1. GET `/api/birthdays/today`

Lấy danh sách thành viên có sinh nhật hôm nay (theo múi giờ Việt Nam).

**Ví dụ:**
```bash
curl http://localhost:3000/api/birthdays/today \
  -H "X-API-Key: $API_KEY"
```

**Phản hồi:**
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

Lấy danh sách thành viên có sinh nhật vào ngày cụ thể.

**Ví dụ:**
```bash
curl -X POST http://localhost:3000/api/birthdays/by-date \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"date":"24/01"}'
```

**Phản hồi:**
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
Yêu cầu HTTP
    ↓
Định tuyến (birthdayRoutes.js)
    ↓
Điều khiển (birthdayController.js)
    ↓
Dịch vụ (birthdayService.js)
    ↓
Truy xuất dữ liệu (memberRepository.js)
    ↓
Cơ sở dữ liệu (BCN.members)
    ↓
Truy vấn MongoDB: { dob: /^DD\/MM\// }
    ↓
Chuyển đổi và trả kết quả
```

---

## Chi tiết từng lớp xử lý

### 1. Lớp định tuyến (`birthdayRoutes.js`)

Định nghĩa điểm cuối và ánh xạ tới bộ điều khiển.

```javascript
router.get('/today', birthdayController.getTodayBirthdays);
router.post('/by-date', birthdayController.getBirthdaysByDate);
```

---

### 2. Lớp bộ điều khiển (`birthdayController.js`)

Xử lý yêu cầu HTTP, kiểm tra dữ liệu đầu vào và trả về phản hồi.

**Nhiệm vụ:**
- Đọc nội dung và tham số của yêu cầu
- Kiểm tra dữ liệu đầu vào
- Gọi lớp dịch vụ
- Định dạng phản hồi
- Xử lý lỗi

**Ví dụ:**
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

### 3. Lớp dịch vụ (`birthdayService.js`)

Xử lý logic nghiệp vụ và chuyển đổi dữ liệu.

**Nhiệm vụ:**
- Áp dụng quy tắc nghiệp vụ
- Kiểm tra dữ liệu
- Gọi lớp truy xuất dữ liệu
- Chuyển đổi định dạng dữ liệu

**Ví dụ:**
```javascript
export async function getTodayBirthdays() {
  const members = await memberRepository.getMembersWithBirthdayToday();
  
  // Chuyển đổi: _id ObjectId → chuỗi
  return members.map(member => ({
    id: member._id.toString(),
    ...member
  }));
}
```

---

### 4. Lớp truy xuất dữ liệu (`memberRepository.js`)

Thực hiện truy vấn và truy cập cơ sở dữ liệu.

**Nhiệm vụ:**
- Thực hiện truy vấn MongoDB
- Thao tác với cơ sở dữ liệu
- Trả về dữ liệu gốc

**Ví dụ:**
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

### 5. Lớp cơ sở dữ liệu (`bcn.js`)

Quản lý kết nối MongoDB.

**Nhiệm vụ:**
- Kết nối tới cơ sở dữ liệu BCN
- Cung cấp đối tượng kết nối cơ sở dữ liệu
- Xử lý lỗi kết nối

---

## Cách truy vấn dữ liệu

### Đối chiếu ngày bằng biểu thức chính quy

**Đầu vào:** `"24/01"` (DD/MM)
**Dữ liệu trong cơ sở dữ liệu:** `"24/01/2006"`, `"24/01/2005"`, ... (DD/MM/YYYY)

**Truy vấn:**
```javascript
const regex = new RegExp(`^24/01/`);
db.collection('members').find({ dob: { $regex: regex } });
```

**Kết quả khớp:**
- ✅ `"24/01/2006"`
- ✅ `"24/01/2005"`
- ✅ `"24/01/2000"`
- ❌ `"25/01/2006"`
- ❌ `"01/24/2006"`

---

## Xử lý múi giờ

### Lấy ngày hiện tại tại Việt Nam

```javascript
const now = new Date();
const vietnamDate = new Date(
  now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })
);

const day = String(vietnamDate.getDate()).padStart(2, '0');
const month = String(vietnamDate.getMonth() + 1).padStart(2, '0');
const dateString = `${day}/${month}`;
```

**Ví dụ:**
- Giờ máy chủ: `2026-10-19 03:00 UTC` (sáng thứ Hai)
- Giờ Việt Nam: `2026-10-19 10:00 +07` (sáng thứ Hai)
- `dateString`: `"19/10"`

---

## Xử lý lỗi

### Lỗi dữ liệu đầu vào (400)

```javascript
// Thiếu trường date
{
  "success": false,
  "error": "Bad request",
  "message": "Field \"date\" is required"
}

// Định dạng không hợp lệ
{
  "success": false,
  "error": "Bad request",
  "message": "Invalid date format. Expected DD/MM"
}
```

### Lỗi máy chủ (500)

```javascript
{
  "success": false,
  "error": "Internal server error",
  "message": "Connection to BCN database failed"
}
```

---

## Kiểm thử

### Kiểm thử thủ công bằng curl

```bash
# Kiểm tra sinh nhật hôm nay
curl http://localhost:3000/api/birthdays/today \
  -H "X-API-Key: $API_KEY"

# Kiểm tra một ngày cụ thể
curl -X POST http://localhost:3000/api/birthdays/by-date \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"date":"24/01"}'

# Kiểm tra định dạng sai (dự kiến trả về 400)
curl -X POST http://localhost:3000/api/birthdays/by-date \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"date":"2024-01-24"}'
```

---

## Cấu hình

Tệp: `src/configs/birthday.config.js`

```javascript
export const BIRTHDAY_CONFIG = {
  TIMEZONE: 'Asia/Ho_Chi_Minh',
  DATE_FORMAT: 'DD/MM',
  DATABASE_NAME: 'BCN',
  COLLECTION_NAME: 'members'
};
```

---

## Biến môi trường

Không cần thêm biến môi trường mới. Sử dụng:

```bash
# Nạp từ atlas-credentials.env
MONGODB_URI=mongodb+srv://...
```

---

## Theo dõi và ghi nhật ký

### Ví dụ nhật ký

```
[BCN] Đang kết nối tới cơ sở dữ liệu BCN...
[BCN] Đã kết nối thành công tới cơ sở dữ liệu BCN
[MemberRepo] Đang lấy danh sách thành viên có sinh nhật hôm nay: 19/10
[MemberRepo] Tìm thấy 2 thành viên có sinh nhật ngày 19/10
[BirthdayService] Lỗi khi lấy danh sách sinh nhật hôm nay: ...
```

---

## Hướng phát triển trong tương lai

1. **Bộ nhớ đệm:** Lưu kết quả trong một ngày
2. **Phân trang:** Thêm limit/offset cho kết quả lớn
3. **Tích hợp Discord:** Tự động gửi thông báo sinh nhật
4. **Thống kê:** Thêm điểm cuối thống kê sinh nhật theo tháng
5. **Nhắc sinh nhật:** Lập lịch gửi nhắc trước một số ngày

---

## Khắc phục sự cố

### Sự cố: "Database not connected"

**Cách khắc phục:**
```javascript
// Đảm bảo connectBCN() được gọi trong index.js
await connectBCN();
```

### Sự cố: "No members found"

**Nguyên nhân có thể:**
- Cơ sở dữ liệu BCN không có collection `members`.
- Trường `dob` không đúng định dạng DD/MM/YYYY.
- Múi giờ máy chủ khác với múi giờ Việt Nam.

---

## Tài liệu API

Xem chi tiết tại [tài liệu API sinh nhật](../../api/internal/BIRTHDAY_API.md).
