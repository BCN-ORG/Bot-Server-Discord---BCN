# Hệ thống kiểm tra và quản lý tên

> 📝 **Trạng thái**: Đang hoàn thiện tài liệu dựa trên mã nguồn hiện có

## Tổng quan

Hệ thống tự động kiểm tra biệt danh thành viên Discord theo quy tắc đặt tên,
quản lý vi phạm và tự động kick sau 48 giờ nếu thành viên không sửa tên.

### Đặc điểm chính

- ✅ **Tự động kiểm tra**: Khi thành viên tham gia máy chủ, đổi biệt danh hoặc gửi tin nhắn
- ✅ **Quy trình đổi tên**: Biểu mẫu để thành viên tự nhập tên đúng định dạng
- ✅ **Theo dõi vi phạm**: Lưu thời điểm vi phạm đầu tiên và theo dõi trong 48 giờ
- ✅ **Tự động kick**: Tác vụ định kỳ kick thành viên đã quá hạn
- ✅ **Danh sách miễn trừ**: ID người dùng được miễn kiểm tra

---

## Quy tắc đặt tên

### Định dạng yêu cầu
```
Họ Tên Đệm Tên
```

### Ràng buộc
- **Số từ**: 2-5 từ (ví dụ: "Nguyen Van A" ✅, "A" ❌)
- **Ký tự**: Chỉ chữ cái tiếng Việt (có hoặc không dấu)
- **Không cho phép**: Số, emoji, ký tự đặc biệt
- **Viết hoa**: Mỗi từ viết hoa chữ cái đầu

### Ví dụ

| Biệt danh | Hợp lệ | Lý do |
|----------|--------|-------|
| `Nguyen Minh Vu` | ✅ | Đúng định dạng |
| `Nguyen Van A` | ✅ | 3 từ, chỉ có chữ cái |
| `Vu` | ❌ | Chỉ 1 từ (cần 2-5) |
| `Nguyen123` | ❌ | Có số |
| `Vu🔥` | ❌ | Có emoji |

---

## Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────┐
│                         Bot Discord                           │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │       Sự kiện (guildMemberAdd và các sự kiện khác)     │ │
│  └────────────────────────────────────────────────────────┘ │
│         │                                                    │
│         ▼                                                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │        nameValidationService.js                        │ │
│  │  - checkMemberNickname()                               │ │
│  │  - handleInvalidNickname()                             │ │
│  │  - handleValidNickname()                               │ │
│  └────────────────────────────────────────────────────────┘ │
│         │                                                    │
│         ▼                                                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           violations.js (MongoDB)                      │ │
│  │  - createViolation()                                   │ │
│  │  - deleteViolation()                                   │ │
│  │  - getExpiredViolations()                              │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │       violationChecker.js (tác vụ định kỳ)             │ │
│  │  - Chạy mỗi 6 giờ                                      │ │
│  │  - Kick thành viên quá hạn 48 giờ                      │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         rename/ (module tính năng)                     │ │
│  │  - Lệnh /rename                                        │ │
│  │  - Biểu mẫu nhập tên                                   │ │
│  │  - Kiểm tra và cập nhật biệt danh                     │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Luồng nghiệp vụ

### 1. Thành viên tham gia máy chủ

```
1. SỰ KIỆN: guildMemberAdd
   └─► handleGuildMemberAdd(member)

2. KIỂM TRA BIỆT DANH
   └─► checkMemberNickname(member)
       ├─► Lấy tên hiển thị
       ├─► Kiểm tra danh sách miễn trừ
       ├─► Kiểm tra theo quy tắc
       └─► Trả về { valid: boolean, nickname: string }

3a. HỢP LỆ ✅
    └─► Không làm gì

3b. KHÔNG HỢP LỆ ❌
    └─► handleInvalidNickname(member, nickname)
        ├─► Tạo bản ghi vi phạm (DB)
        │   └─ { userId, guildId, firstViolationAt, notifiedAt: [] }
        │
        └─► Gửi thông báo vào kênh "huong-dan"
            ├─ Embed: Yêu cầu đổi tên
            ├─ Nút: "Nhập họ và tên"
            └─ Thời hạn: 48 giờ
```

### 2. Thành viên đổi biệt danh

```
1. SỰ KIỆN: guildMemberUpdate
   └─► nếu biệt danh thay đổi

2. KIỂM TRA BIỆT DANH
   └─► checkMemberNickname(member)

3a. HIỆN ĐÃ HỢP LỆ ✅
    └─► handleValidNickname(member)
        ├─► Xóa vi phạm (nếu có)
        └─► Gửi tin nhắn riêng chúc mừng (nếu có thể)

3b. VẪN KHÔNG HỢP LỆ ❌
    └─► handleInvalidNickname(member, nickname)
        └─► Cập nhật notifiedAt, gửi nhắc nhở
```

### 3. Thành viên gửi tin nhắn đầu tiên

```
1. SỰ KIỆN: messageCreate
   └─► nếu đây là tin nhắn đầu tiên của người dùng

2. KIỂM TRA BIỆT DANH
   └─► checkMemberNickname(member)

3. KHÔNG HỢP LỆ ❌
   └─► Trả lời bằng nút "Đổi tên ngay"
```

### 4. Tác vụ định kỳ - tự động kick

```
1. TÁC VỤ CRON (mỗi 6 giờ)
   └─► violationChecker.checkViolations(client)

2. LẤY CÁC VI PHẠM QUÁ HẠN
   └─► getExpiredViolations(guildId)
       └─► Lấy các vi phạm có firstViolationAt quá 48 giờ

3. KICK THÀNH VIÊN
   ├─► Với từng vi phạm:
   │   ├─► Gửi tin nhắn riêng thông báo (nếu có thể)
   │   ├─► Kick khỏi máy chủ
   │   └─► Xóa bản ghi vi phạm
   │
   └─► Ghi nhật ký kết quả
```

### 5. Lệnh đổi tên và biểu mẫu

```
1. NGƯỜI DÙNG: /rename (hoặc bấm nút)

2. HIỂN THỊ BIỂU MẪU
   └─► Biểu mẫu có trường nhập "Họ và tên"

3. NGƯỜI DÙNG: Gửi biểu mẫu

4. KIỂM TRA DỮ LIỆU
   └─► validateName(input)
       ├─► Kiểm tra định dạng
       └─► Trả về { valid, reason }

5a. HỢP LỆ ✅
    └─► Cập nhật biệt danh
        ├─► member.setNickname(newName)
        ├─► Xóa vi phạm
        └─► Trả lời thành công

5b. KHÔNG HỢP LỆ ❌
    └─► Trả lời kèm lý do lỗi
```

---

## Cấu trúc cơ sở dữ liệu

### Bộ sưu tập `violations`

```javascript
{
  _id: ObjectId,
  userId: "123456789",           // ID người dùng Discord
  guildId: "987654321",          // ID máy chủ Discord
  nickname: "InvalidName123",    // Tên không hợp lệ
  firstViolationAt: ISODate("2026-10-15T10:00:00Z"),
  notifiedAt: [                   // Lịch sử thông báo
    ISODate("2026-10-15T10:00:00Z"),
    ISODate("2026-10-16T10:00:00Z")
  ],
  status: "active",               // active | resolved
  createdAt: ISODate("2026-10-15T10:00:00Z"),
  updatedAt: ISODate("2026-10-16T10:00:00Z")
}
```

### Chỉ mục
```javascript
{ userId: 1, guildId: 1 }        // Duy nhất
{ firstViolationAt: 1 }          // Phục vụ truy vấn quá hạn
{ status: 1 }
```

---

## Cấu hình

### Biến môi trường

```env
# Danh sách ID người dùng được miễn kiểm tra
VALIDATION_EXCEPTION_UIDS=946236759522545665,1202579919196917812
```

### Cấu hình tác vụ định kỳ

- **Tần suất**: Mỗi 6 giờ
- **Cron**: `0 */6 * * *`
- **Thời hạn vi phạm**: 48 giờ (2880 phút)

---

## Lệnh và tương tác

### Lệnh slash: `/rename`

**Mô tả**: Đổi biệt danh theo định dạng yêu cầu

**Luồng xử lý**:
1. Người dùng gọi `/rename`.
2. Bot hiển thị biểu mẫu nhập liệu.
3. Người dùng nhập tên mới.
4. Bot kiểm tra tên và cập nhật biệt danh.

**Quyền**: Không yêu cầu quyền đặc biệt; mọi thành viên đều có thể sử dụng.

### Nút: "Nhập họ và tên" / "Đổi tên ngay"

**Kích hoạt**: Bấm nút trong embed.
**Thao tác**: Mở biểu mẫu đổi tên (giống `/rename`).

---

## Tệp liên quan

### Xử lý chính
- `src/services/nameValidationService.js` - Kiểm tra tên và xử lý vi phạm
- `src/database/violations.js` - Thao tác dữ liệu vi phạm trong MongoDB

### Sự kiện
- `src/events/guildMemberAdd.js` - Kiểm tra khi tham gia máy chủ
- `src/events/guildMemberUpdate.js` - Kiểm tra khi đổi biệt danh
- `src/events/messageCreate.js` - Kiểm tra khi gửi tin nhắn đầu tiên
- `src/events/voiceStateUpdate.js` - Kiểm tra khi vào kênh thoại

### Module tính năng
- `src/features/rename/command.js` - Lệnh /rename
- `src/features/rename/modal.js` - Giao diện biểu mẫu
- `src/features/rename/validate.js` - Kiểm tra tên
- `src/features/rename/index.js` - Xuất module

### Tác vụ định kỳ
- `src/schedulers/violationChecker.js` - Tác vụ tự động kick

---

## Trường hợp ngoại lệ và xử lý lỗi

### 1. Thành viên rời máy chủ trước khi bị kick
- Bản ghi vi phạm vẫn còn trong cơ sở dữ liệu.
- Scheduler ghi nhật ký "Member not found" rồi xóa bản ghi vi phạm.

### 2. Bot không có quyền kick
- Ghi nhật ký lỗi.
- Không xóa bản ghi vi phạm để thử lại ở lần chạy sau.

### 3. Bot không có quyền đổi biệt danh
- Hiển thị lỗi khi người dùng gửi biểu mẫu.
- Không xóa bản ghi vi phạm.

### 4. Thành viên thuộc danh sách miễn trừ
- Bỏ qua hoàn toàn việc kiểm tra.
- Không tạo bản ghi vi phạm.

### 5. Thành viên tắt tin nhắn riêng
- Không gửi được tin nhắn riêng.
- Vẫn kick theo quy trình.
- Ghi nhật ký cảnh báo.

### 6. Vi phạm bị ghi nhận trùng
- Không tạo bản ghi mới.
- Cập nhật mảng `notifiedAt`.

---

## Danh sách kiểm tra

- [ ] Thành viên mới tham gia với tên sai → Tạo bản ghi vi phạm.
- [ ] Thành viên tham gia với tên đúng → Không tạo bản ghi vi phạm.
- [ ] Thành viên đổi tên sai thành đúng → Xóa bản ghi vi phạm.
- [ ] Thành viên đổi tên đúng thành sai → Tạo bản ghi vi phạm.
- [ ] Scheduler kick thành viên khi vi phạm quá hạn 48 giờ.
- [ ] `/rename` với tên hợp lệ → Cập nhật thành công.
- [ ] `/rename` với tên không hợp lệ → Hiển thị lỗi.
- [ ] Thành viên được miễn trừ → Bỏ qua kiểm tra.
- [ ] Nút mở đúng biểu mẫu.
- [ ] Gửi được tin nhắn riêng thông báo kick.

---

*Cập nhật lần cuối: 2026-10-22*
