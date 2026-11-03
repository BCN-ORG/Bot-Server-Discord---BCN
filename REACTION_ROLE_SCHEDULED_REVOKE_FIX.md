# 🔧 Hướng dẫn quản lý Scheduled Revoke cho Reaction Role

## 📋 Tổng quan

Khi bạn setup reaction role với thời gian thu hồi hàng ngày (ví dụ: `00:00`), bot sẽ tự động:
- Thu hồi role khỏi tất cả người dùng vào giờ đã đặt
- Xóa reaction của họ
- Giải phóng slot để người khác có thể nhận role

## ⚠️ Vấn đề đã sửa

**Trước khi sửa:**
- Scheduler không có timezone configuration
- Chạy theo giờ hệ thống (UTC) thay vì giờ Việt Nam
- Không có logging để debug

**Sau khi sửa:**
- ✅ Scheduler chạy theo timezone `Asia/Ho_Chi_Minh`
- ✅ Logging chi tiết mỗi phút
- ✅ Thêm lệnh để chỉnh thời gian

## 🎯 Lệnh mới: `/reaction-role update-time`

### Cú pháp:
```
/reaction-role update-time
  message_id: [ID tin nhắn]
  role: @RoleName
  new_time: [HH:MM hoặc "off"]
```

### Ví dụ:

**1. Đổi từ 00:00 sang 08:00:**
```
/reaction-role update-time
  message_id: 1566832527795298408
  role: @Website Learning
  new_time: 08:00
```
Result: Role sẽ được thu hồi mỗi ngày lúc **08:00** thay vì 00:00

**2. Tắt tự động thu hồi:**
```
/reaction-role update-time
  message_id: 1566832527795298408
  role: @Website Learning
  new_time: off
```
Result: Role **KHÔNG** bị thu hồi tự động (giữ vĩnh viễn)

**3. Đổi sang giờ khác:**
```
/reaction-role update-time
  message_id: 1566832527795298408
  role: @Website Learning
  new_time: 23:59
```
Result: Role sẽ được thu hồi mỗi ngày lúc **23:59**

## 📊 Kiểm tra config hiện tại

```
/reaction-role list
```

Kết quả sẽ hiển thị:
```
• Tin nhắn 1566832527795298408 → @Website Learning 
  | emoji: 💻 
  | limit: 999 
  | thời hạn: mỗi ngày lúc 00:00  ← Thời gian hiện tại
  | giá: 10 coins 
  | đã nhận: 36
```

## 🔍 Kiểm tra logs

Xem bot có đang chạy scheduler không:

```bash
tail -f bot.log | grep "Reaction Role"
```

Bạn sẽ thấy mỗi phút:
```
[Reaction Role Scheduler] Checking scheduled revoke at 00:45...
[Reaction Role Scheduler] No configs scheduled for 00:45
```

Khi đến đúng giờ (ví dụ 00:00):
```
[Reaction Role Scheduler] Checking scheduled revoke at 00:00...
[Reaction Role Scheduler] Found 1 config(s) scheduled for 00:00
[Reaction Role Scheduler] Processing config: messageId=1566832527795298408, roleId=1566832804686332064, claimants=36
```

## ⚙️ Cách hoạt động

1. **Scheduler chạy mỗi phút** với timezone `Asia/Ho_Chi_Minh`
2. **Kiểm tra thời gian hiện tại** (ví dụ: `00:00`)
3. **Tìm configs có `every: "00:00"`** và có người đã nhận
4. **Thu hồi role** từ tất cả người dùng trong config đó
5. **Xóa reaction** của họ khỏi tin nhắn
6. **Xóa record claimants** - giải phóng slot

## 🎯 Use cases

### Case 1: Daily role (reset mỗi ngày)
```
Setup: every: "00:00"
→ Mọi người nhận role trong ngày
→ 00:00 hôm sau: tất cả bị thu hồi
→ Họ có thể nhận lại bằng cách react lại
```

### Case 2: Time-limited event (8 tiếng)
```
Setup: every: "08:00"
→ Mọi người nhận role từ 00:00-08:00
→ 08:00: tất cả bị thu hồi
→ Họ có thể nhận lại sau 08:00
```

### Case 3: Tắt auto-revoke
```
/reaction-role update-time new_time: off
→ Role được giữ vĩnh viễn
→ Chỉ bị thu hồi khi unreact hoặc admin xóa config
```

## ⚠️ Lưu ý quan trọng

1. **Timezone**: Bot chạy theo giờ Việt Nam (UTC+7)
2. **Không hoàn coins**: Khi role bị thu hồi, coins KHÔNG được hoàn lại
3. **Có thể nhận lại**: User có thể react lại để nhận role (nếu còn slot và đủ coins)
4. **Unreact không thu hồi**: Theo design mới, unreact KHÔNG thu hồi role - chỉ scheduled time mới thu hồi
5. **Bot phải đang chạy**: Nếu bot tắt lúc 00:00, scheduled revoke sẽ không chạy

## 🧪 Test trước khi dùng thật

**Đề xuất**: Test với thời gian gần (ví dụ: 5 phút sau) trước:

```bash
# Bây giờ là 14:25, đặt thời gian 14:30
/reaction-role update-time
  message_id: [test message]
  role: @TestRole
  new_time: 14:30

# Đợi đến 14:30 và kiểm tra logs
tail -f bot.log | grep "Reaction Role"
```

## 📝 Summary

- ✅ Timezone đã fix (Asia/Ho_Chi_Minh)
- ✅ Logging đã cải thiện
- ✅ Có lệnh chỉnh thời gian an toàn
- ✅ Có thể tắt auto-revoke bất kỳ lúc nào
- ✅ DRY RUN test đã confirm logic đúng

Config hiện tại của bạn (`every: "00:00"`) sẽ chạy đúng vào **00:00 giờ Việt Nam** từ bây giờ.
