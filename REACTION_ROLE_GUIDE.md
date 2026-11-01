# Hướng Dẫn Sử Dụng Reaction Role

## Tổng quan

Reaction Role cho phép thành viên nhận role tự động khi react emoji vào tin nhắn. Hệ thống hỗ trợ:
- ✅ Giới hạn số người
- ✅ Thời hạn role (hết hạn tự động)
- ✅ Lịch thu hồi hàng ngày
- ✅ Phí coins (phải trả tiền để nhận role)
- ✅ Unreact không làm mất role

---

## Dành cho Admin

### 1. Cấu hình Reaction Role

**Cách 1: Dùng Context Menu (đơn giản nhất)**
1. Chuột phải vào tin nhắn bất kỳ
2. Chọn **Apps → Setup Reaction Role**
3. Điền form:
   - Role ID
   - Emoji
   - Limit (số người tối đa)
   - Thời hạn (30 ngày hoặc 08:00)
   - Giá (coins)
4. Submit

**Cách 2: Dùng Slash Command**
```
/reaction-role set
  message_id: [ID tin nhắn]
  role: @RoleName
  emoji: ❤️
```
→ Modal hiển thị để điền:
- Limit
- Thời hạn
- Giá

**Lấy Message ID:**
- Cách 1: Bật Developer Mode → chuột phải tin nhắn → Copy Message ID
- Cách 2: Copy Message Link → lấy số cuối cùng trong URL

### 2. Các Tham Số

| Tham số | Bắt buộc | Mô tả | Ví dụ |
|---------|----------|-------|-------|
| **Message ID** | ✅ | ID của tin nhắn | `1234567890` |
| **Role** | ✅ | Role sẽ được cấp | `@VIP` |
| **Emoji** | ✅ | Emoji để react | `❤️` hoặc `:heart:` |
| **Limit** | ✅ | Số người tối đa | `10` |
| **Thời hạn** | ❌ | Số ngày HOẶC giờ | `30` hoặc `08:00` |
| **Giá** | ❌ | Số coins (0 = miễn phí) | `100` |

### 3. Thời hạn Role

**Option 1: Số ngày**
- Nhập: `30`
- Hiệu ứng: Role tự động bị thu hồi sau 30 ngày kể từ khi nhận
- Ví dụ: Nhận ngày 1/11 → hết hạn ngày 1/12

**Option 2: Giờ hàng ngày**
- Nhập: `08:00`
- Hiệu ứng: Role tự động bị thu hồi **mỗi ngày lúc 8:00 sáng**
- Người dùng phải react lại mỗi ngày
- Ví dụ: Reaction role cho "điểm danh hàng ngày"

**Không nhập gì:** Role vĩnh viễn (không hết hạn)

### 4. Giá (Coins)

**Miễn phí:**
- Để trống hoặc nhập `0`
- User react → nhận role ngay

**Có phí:**
- Nhập số coins, ví dụ: `100`
- User react → hệ thống trừ 100 coins → cấp role
- Không đủ coins → reaction bị gỡ + DM thông báo

### 5. Xem Danh Sách Config

```
/reaction-role list
```

Hiển thị tối đa 20 config gần nhất:
```
• Tin nhắn 123... → @VIP | emoji: ⭐ | limit: 10 | thời hạn: 30 ngày | giá: 1000 coins | đã nhận: 3
```

### 6. Xóa Config

```
/reaction-role remove
  message_id: [ID]
  role: @RoleName
```

**Lưu ý:**
- User đã có role từ config này sẽ **BỊ THU HỒI** role (trừ khi là pre-existing)
- User nhận DM thông báo
- Không hoàn coins

---

## Dành cho Thành Viên

### 1. Nhận Role

1. Tìm tin nhắn có reaction role
2. Click vào emoji (ví dụ: ❤️)
3. **Nếu miễn phí:**
   - Nhận role ngay
   - Nhận DM xác nhận
4. **Nếu có phí:**
   - Hệ thống trừ coins tự động
   - Nhận role + DM xác nhận (có thông tin đã trả bao nhiêu coins)
   - Nếu không đủ coins → nhận DM báo lỗi + reaction bị gỡ

### 2. Unreact (Gỡ Reaction)

**Quan trọng:** Unreact **KHÔNG làm mất role**!

- Role chỉ bị thu hồi khi:
  - ⏰ Hết thời hạn
  - 🤖 Bot/admin xóa config
- Coins **KHÔNG được hoàn** khi unreact
- Bạn đã trả tiền = đã mua role

### 3. Kiểm Tra Coins

```
/coins-balance
```

Xem số dư để biết có đủ tiền nhận role không.

### 4. Thông Báo Nhận

Khi nhận role thành công, bạn nhận DM:

**Role miễn phí:**
```
✅ Bạn đã nhận role

Bạn đã nhận role VIP trong máy chủ [Server Name].

Lý do: Bạn đã đăng ký nhận role bằng reaction.

Thời gian sử dụng role: 30 ngày
```

**Role có phí:**
```
✅ Bạn đã nhận role

Bạn đã nhận role VIP trong máy chủ [Server Name].

Lý do: Bạn đã đăng ký nhận role bằng reaction.

💰 Đã trả: 1000 coins

Thời gian sử dụng role: 30 ngày
```

### 5. Thông Báo Lỗi

**Không đủ coins:**
```
❌ Không đủ coins

Bạn cần 1000 coins để nhận role VIP, nhưng số dư không đủ.

Dùng `/coins-balance` để kiểm tra số dư.
```

**Hết slot (đầy limit):**
- Reaction bị gỡ tự động
- Không nhận DM
- Thử lại sau khi có người gỡ role

### 6. Khi Role Hết Hạn

**Thời hạn theo ngày:**
```
📅 Role đã được thu hồi

Role VIP đã được thu hồi trong máy chủ [Server Name].

Lý do: Thời hạn nhận role đã kết thúc.
```

**Thời hạn theo giờ (hàng ngày):**
```
📅 Role đã được thu hồi

Role Daily Check-in đã được thu hồi trong máy chủ [Server Name].

Lý do: Role được gỡ theo lịch hàng ngày lúc 08:00.
```

Reaction của bạn cũng bị gỡ tự động. Muốn nhận lại → react lại (và trả tiền lại nếu có phí).

---

## Ví Dụ Thực Tế

### Ví dụ 1: Role VIP có phí

**Admin setup:**
```
/reaction-role set
  message_id: 123456789
  role: @VIP
  emoji: ⭐

Modal:
  Limit: 10
  Thời hạn: 30
  Giá: 1000
```

**User sử dụng:**
1. User react ⭐
2. Hệ thống trừ 1000 coins
3. User nhận role @VIP
4. Sau 30 ngày → role tự động bị thu hồi

### Ví dụ 2: Điểm danh hàng ngày miễn phí

**Admin setup:**
```
/reaction-role set
  message_id: 987654321
  role: @Daily Check-in
  emoji: ✅

Modal:
  Limit: 1000
  Thời hạn: 08:00
  Giá: 0
```

**User sử dụng:**
1. Sáng 6:00 - User react ✅
2. User nhận role @Daily Check-in
3. Sáng 8:00 - Role tự động bị thu hồi
4. Muốn điểm danh ngày hôm sau → react lại

### Ví dụ 3: Role vĩnh viễn có giới hạn

**Admin setup:**
```
/reaction-role set
  message_id: 555666777
  role: @Early Member
  emoji: 🎉

Modal:
  Limit: 100
  Thời hạn: [để trống]
  Giá: 0
```

**Hiệu ứng:**
- Chỉ 100 người đầu tiên react được nhận
- Role không hết hạn
- Miễn phí

---

## Quy Tắc & Giới Hạn

### 1. Limit (Giới hạn người)

- Khi **đủ số người** → reaction mới bị gỡ tự động
- Khi role hết hạn/bị thu hồi → **slot được giải phóng**
- Người khác có thể react vào slot trống

### 2. Pre-existing Role

- Nếu user **ĐÃ CÓ role** trước khi react → role được đánh dấu "pre-existing"
- Khi config bị xóa → role **KHÔNG bị thu hồi** (vì có sẵn từ trước)

### 3. Một User - Nhiều Config

User có thể nhận cùng role từ nhiều config khác nhau:
- Config A: @VIP từ message X
- Config B: @VIP từ message Y
- User react cả 2 → role chỉ cấp 1 lần (không trùng)
- Khi 1 config hết hạn → role vẫn còn (vì config kia còn)

### 4. Bot Permissions

Bot cần các quyền sau:
- ✅ Manage Roles
- ✅ Read Messages / View Channels
- ✅ Add Reactions
- ✅ Read Message History
- ✅ Manage Messages (để gỡ reactions)

### 5. Role Hierarchy

- Bot **KHÔNG thể** cấp role cao hơn role cao nhất của bot
- Admin setup role cao hơn bot → lỗi khi user react

---

## Troubleshooting

### User react nhưng không nhận role

**Nguyên nhân:**
1. **Hết slot** (limit đầy) → chờ có người gỡ role
2. **Không đủ coins** (role có phí) → nạp thêm coins
3. **Bot thiếu quyền** → admin kiểm tra permissions
4. **Role cao hơn bot** → admin di chuyển role bot lên cao hơn

### Reaction bị gỡ tự động

**Nguyên nhân:**
1. **Limit đầy** → slot đã hết
2. **Không đủ coins** → kiểm tra số dư
3. **Lỗi API** → thử lại sau

### Role không bị thu hồi khi hết hạn

**Kiểm tra:**
1. Bot có đang chạy không?
2. Scheduler có hoạt động không? (xem logs)
3. User có role từ config khác không? (giữ role nếu còn config khác)

### Admin không thể setup

**Nguyên nhân:**
1. Thiếu quyền `Manage Roles`
2. Message ID sai → kiểm tra lại ID
3. Emoji không hợp lệ → dùng emoji chuẩn Discord

---

## Best Practices

### 1. Đặt Tên Role Rõ Ràng

❌ `Role 1`, `Test`, `ABC`
✅ `VIP Member`, `Daily Check-in`, `Early Supporter`

### 2. Giá Hợp Lý

- Role vĩnh viễn → giá cao (1000-5000 coins)
- Role ngắn hạn (7-30 ngày) → giá trung bình (100-500 coins)
- Role hàng ngày → miễn phí hoặc rất rẻ (0-10 coins)

### 3. Limit Phù Hợp

- Role độc quyền → limit thấp (10-50)
- Role phổ biến → limit cao (100-1000)
- Role không giới hạn → limit = tổng members

### 4. Thông Báo Rõ Ràng

Trong tin nhắn setup reaction role, nên ghi:
```
🎯 React ⭐ để nhận role @VIP

📊 Thông tin:
• Giá: 1000 coins
• Giới hạn: 10 người đầu tiên
• Thời hạn: 30 ngày
• Đặc quyền: [liệt kê quyền lợi của role]
```

### 5. Backup Config

Nên note lại config quan trọng để tái tạo nếu cần:
```
Message ID: 123456789
Role: @VIP
Emoji: ⭐
Limit: 10
Duration: 30 days
Price: 1000 coins
```

---

## API Integration

Reaction role sử dụng Payroll API để xử lý coins:

**Endpoint:** `POST /api/payroll/topup`

**Khi user react (có phí):**
1. Bot gọi API topup
2. Coins từ ví user → ví bot
3. Nếu thành công → cấp role
4. Nếu thất bại → gỡ reaction + DM lỗi

**Không hoàn tiền khi:**
- User unreact
- Role hết hạn
- Admin xóa config

---

## Changelog

**v2.0 (2026-11-01)**
- ✅ Thêm tính năng payment (trả coins)
- ✅ Modal form cho các options phụ
- ✅ Unreact không làm mất role
- ✅ Context menu support
- ✅ Luôn xóa reactions khi update config

**v1.0 (2026-10-XX)**
- ✅ Reaction role cơ bản
- ✅ Limit + duration
- ✅ Scheduled revoke

---

## Liên Hệ

Gặp vấn đề? Liên hệ admin hoặc report tại:
- Discord: Tag @Admin
- GitHub: [Link repo nếu có]

---

**Lưu ý:** Tài liệu này được cập nhật lần cuối: 2026-11-01
