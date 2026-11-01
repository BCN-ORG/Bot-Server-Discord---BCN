# Reaction Role với Payment System

## Tổng quan

Đã thêm tính năng **trả coins để nhận role** vào hệ thống reaction role.

## Thay đổi

### 1. Command `/reaction-role set`

Thêm option mới: `price`

```
/reaction-role set
  message_id: [ID]
  role: @role
  limit: [số]
  emoji: ❤️
  duration_days: [số ngày] (optional)
  every: [HH:mm] (optional)
  price: [số coins] (MỚI - optional, mặc định: 0)
```

### 2. Database

Thêm field `price` vào collection `reaction_role_configs`:
- Mặc định: `0` (miễn phí)
- Giá trị: số coins cần trả

### 3. API Integration

**Endpoint mới:** `POST /transfer-to-bot`
- Trừ coins từ user
- Body: `{ userId, amount: -X, description }`

**Function:** `chargeCoins(userId, amount, description)`
- Return: `{ httpStatus, insufficientBalance, data }`

### 4. Logic Workflow

#### Khi user react (có price):

1. ✅ User react
2. 💰 Bot gọi API trừ coins
3. **Nếu ĐỦ coins:**
   - ✅ Trừ coins thành công
   - ✅ Cấp role
   - 📩 DM: "Đã nhận role + đã trả X coins"
4. **Nếu KHÔNG ĐỦ coins:**
   - ❌ Gỡ reaction
   - ❌ Không cấp role
   - 📩 DM: "Không đủ coins, cần X coins"
5. **Nếu LỖI API:**
   - ❌ Gỡ reaction
   - ❌ Không cấp role
   - 📩 DM: "Lỗi thanh toán, thử lại"

#### Khi user unreact:

- ⚠️ **KHÔNG hoàn coins**
- Role giữ nguyên cho đến hết hạn
- User đã trả coins = đã mua role

## Ví dụ sử dụng

### Tạo role miễn phí:
```
/reaction-role set
  message_id: 123456789
  role: @Member
  limit: 100
  emoji: ✅
  duration_days: 30
  price: 0 (hoặc không điền)
```

### Tạo role có phí:
```
/reaction-role set
  message_id: 123456789
  role: @VIP
  limit: 10
  emoji: ⭐
  duration_days: 30
  price: 1000
```
→ User react → trừ 1000 coins → nhận role VIP

### Xem danh sách config:
```
/reaction-role list
```
Hiển thị:
```
• Tin nhắn 123... → @VIP | emoji: ⭐ | limit: 10 | thời hạn: 30 ngày | giá: 1000 coins | đã nhận: 3
```

## Message DM

### Thành công (có phí):
```
✅ Bạn đã nhận role

Bạn đã nhận role VIP trong máy chủ [Server].

Lý do: Bạn đã đăng ký nhận role bằng reaction.

💰 Đã trả: 1000 coins

Thời gian sử dụng role: 30 ngày
```

### Không đủ coins:
```
❌ Không đủ coins

Bạn cần 1000 coins để nhận role VIP, nhưng số dư không đủ.

Dùng `/coins-balance` để kiểm tra số dư.
```

### Lỗi thanh toán:
```
❌ Lỗi thanh toán

Không thể trừ coins để nhận role VIP.
Vui lòng thử lại sau hoặc liên hệ admin.
```

## API Requirements

Bot cần có các biến môi trường:
```env
PAYROLL_API_BASE_URL=https://api.example.com
PAYROLL_API_KEY=your_api_key
```

Endpoint cần implement:
```
POST /transfer-to-bot
Headers:
  x-api-key: [API_KEY]
  Content-Type: application/json

Body:
{
  "userId": "123456789",
  "amount": -1000,
  "description": "Nhận role VIP"
}

Response (200 - Success):
{
  "success": true,
  "newBalance": 5000
}

Response (403 - Insufficient):
{
  "error": "Insufficient balance",
  "required": 1000,
  "current": 500
}
```

## Lưu ý

1. **Không hoàn coins khi unreact** - user đã mua role
2. **Role hết hạn** - không tự động hoàn coins
3. **Retry logic** - API lỗi sẽ retry 3 lần với exponential backoff
4. **Transaction atomic** - nếu trừ coins thành công nhưng cấp role thất bại, cần manual refund

## Files đã thay đổi

1. `src/features/reactionRoles/command.js` - Thêm option `price`
2. `src/features/reactionRoles/controller.js` - Logic trừ coins + import `chargeCoins`
3. `src/features/payroll/services/apiClient.js` - Function `chargeCoins()`
4. `src/database/reactionRoles.js` - Lưu field `price`
5. `src/features/reactionRoles/controller.js` - Unreact logic (bỏ qua hoàn toàn)

## Testing

1. **Setup role có phí:**
   ```
   /reaction-role set message_id:XXX role:@Test limit:5 emoji:❤️ price:100
   ```

2. **User đủ coins react:**
   - Kiểm tra coins bị trừ
   - Nhận role
   - Nhận DM confirm

3. **User không đủ coins react:**
   - Reaction bị gỡ
   - Không nhận role
   - Nhận DM cảnh báo

4. **User unreact:**
   - Role vẫn giữ
   - Coins không hoàn

Restart bot và test!
