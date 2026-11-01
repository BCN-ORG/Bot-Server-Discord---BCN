# Sửa lỗi Notification Trả Lương

## Vấn đề
Hệ thống đã được cấu hình gửi thông báo vào **Chủ nhật 20:00** nhưng không thấy notification tự động.

## Phân tích

### Có 2 loại thông báo khác nhau:

1. **Lệnh `/salary-info`** (xem thủ công)
   - Tiêu đề: "ℹ️ THÔNG TIN HỆ THỐNG TRẢ LƯƠNG"
   - Hiển thị khi admin gõ lệnh
   - Luôn hoạt động

2. **Notification tự động** (scheduled)
   - Tiêu đề: "🔔 Bao cao tra luong sap toi"
   - Gửi tự động vào Chủ nhật 20:00
   - Cần bot đang chạy và scheduler hoạt động

## Các cải tiến đã thực hiện

### 1. Thêm Command Test Notification
Tạo lệnh `/salary-notification-test` để:
- Test notification ngay lập tức (không cần chờ đến Chủ nhật)
- Kiểm tra xem hệ thống có hoạt động không
- Xác nhận roles được tag đúng

**Cách dùng:**
```
/salary-notification-test
```

Bot sẽ gửi notification test vào channel hiện tại với:
- ✅ Tag tất cả admin/roles đã cấu hình
- 📊 Hiển thị dự toán lương
- ⚠️ Cảnh báo nếu thiếu coins

### 2. Cải thiện Logging
Thêm logging chi tiết hơn trong scheduler:
```javascript
[SCHEDULER] ⏰ Starting payroll notification at [timestamp]...
[SCHEDULER] ✅ Payroll notification completed successfully
```

### 3. Cải thiện Cron Configuration
Thêm option `scheduled: true` và `timezone: 'Asia/Ho_Chi_Minh'` để đảm bảo timezone đúng:
```javascript
cron.schedule(cronExpression, async () => {
  // ...
}, {
  scheduled: true,
  timezone: 'Asia/Ho_Chi_Minh'
});
```

## Cách kiểm tra xem Scheduler có hoạt động

### Kiểm tra trong logs khi bot khởi động:
```
[Payroll Notification] Initializing notification scheduler...
[Payroll Notification] Schedule: Chu nhat at 20:00 (Asia/Ho_Chi_Minh)
[Payroll Notification] Cron expression: 0 20 * * 0
[INFO] ✓ Payroll notification scheduler initialized successfully
```

### Kiểm tra cấu hình hiện tại:
```
/salary-info
```

Sẽ hiển thị:
- 📅 Lịch trả lương (Monday 08:00)
- 🔔 Lịch thông báo (Sunday 20:00)
- 💰 Dự toán kỳ tiếp theo

## Các nguyên nhân có thể khiến notification không gửi

1. **Bot không chạy vào lúc 20:00 Chủ nhật**
   - Giải pháp: Đảm bảo bot luôn chạy (dùng PM2 hoặc systemd)

2. **Không tìm thấy channel để gửi**
   - Bot tìm channel theo thứ tự: `salary-notification`, `thong-bao-luong`, `mod-logs`
   - Giải pháp: Tạo một trong các channel này

3. **Roles thông báo chưa được cấu hình**
   - Bot sẽ vẫn gửi notification nhưng không tag ai
   - Giải pháp: Dùng `/salary-notification-roles` để thêm roles

4. **Timezone không đúng**
   - Giải pháp: Đã fix bằng cách thêm timezone option vào cron

## Cách test ngay lập tức

1. **Chạy lệnh test:**
   ```
   /salary-notification-test
   ```

2. **Kiểm tra xem notification có xuất hiện không**
   - Nếu có → Scheduler hoạt động tốt, chờ đến Chủ nhật 20:00
   - Nếu không → Kiểm tra logs để xem lỗi gì

3. **Kiểm tra xem roles có được tag không**
   - Nếu roles được tag → Cấu hình đúng
   - Nếu không → Dùng `/salary-notification-roles` để thêm

## Lệnh liên quan

- `/salary-notification-schedule` - Đặt lịch thông báo
- `/salary-notification-roles` - Cấu hình roles nhận thông báo
- `/salary-notification-test` - **MỚI** Test notification ngay
- `/salary-info` - Xem tổng quan hệ thống

## Files đã thay đổi

1. `src/features/payroll/commands/salaryNotificationTest.js` - **MỚI**
2. `src/features/payroll/index.js` - Export command mới
3. `src/features/payroll/notificationScheduler.js` - Cải thiện logging và timezone
4. `src/discord.js` - Đăng ký command mới

## Kết luận

Hệ thống notification đã được cải thiện với:
- ✅ Command test để kiểm tra ngay lập tức
- ✅ Logging tốt hơn để debug
- ✅ Timezone configuration chính xác
- ✅ Khả năng kiểm tra trước khi chờ đến Chủ nhật

**Hãy chạy `/salary-notification-test` để xác nhận mọi thứ hoạt động!**
