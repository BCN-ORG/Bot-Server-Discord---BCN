# Chức năng xem lịch học

Chức năng cho phép thành viên có ít nhất một role được cấu hình đăng nhập bằng
tài khoản sinh viên, sau đó xem lịch học và lịch thi theo ngày. API lịch hiện
tại sử dụng dịch vụ sinh viên IUH; tên lệnh và cấu trúc tính năng được đặt
trung lập để có thể thay phần tích hợp API riêng.

## Lệnh Discord

| Lệnh | Mô tả | Quyền |
|---|---|---|
| `/lich-hoc [ngay]` | Xem lịch theo ngày `YYYY-MM-DD`; bỏ trống để xem ngày hiện tại theo giờ Việt Nam | Có ít nhất một role đã cấu hình |
| `/lich-hoc-login` | Mở modal đăng nhập tài khoản sinh viên | Có ít nhất một role đã cấu hình |
| `/lich-hoc-roles add <role>` | Cho phép role sử dụng chức năng | Quản trị viên |
| `/lich-hoc-roles remove <role>` | Gỡ role khỏi danh sách | Quản trị viên |
| `/lich-hoc-roles list` | Xem các role đã được cấu hình | Quản trị viên |

Danh sách role được cấu hình riêng theo máy chủ. Khi chưa có role nào trong
danh sách, thành viên chưa thể đăng nhập hoặc xem lịch. Thành viên có nhiều
role chỉ cần có một role trong danh sách.

## Đăng nhập và lưu dữ liệu

- Mã sinh viên và mật khẩu chỉ được dùng để lấy token; mật khẩu không được lưu
  trong MongoDB.
- Access token và refresh token được mã hóa AES-256-GCM trước khi lưu trong
  collection `schedule_credentials`, theo Discord user ID.
- Khi access token gần hết hạn, bot tự làm mới bằng refresh token. Nếu phiên
  không còn hợp lệ, thông tin token bị xóa và bot yêu cầu đăng nhập lại.
- Role được lưu trong collection `schedule_config`.
- Không ghi token, mật khẩu hoặc nội dung modal vào log.

## Cấu hình môi trường

Thêm các biến sau vào `.env` của bot:

```env
SCHEDULE_API_CLIENT_SECRET=client_secret_duoc_cap
SCHEDULE_TOKEN_ENCRYPTION_KEY=64_ky_tu_hex_tuong_duong_32_byte
```

Tạo encryption key bằng:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Giữ bí mật key và dùng cùng key trên mọi instance bot kết nối chung MongoDB.
Nếu thay key, các token đã lưu không thể giải mã và thành viên cần đăng nhập
lại. Không commit các giá trị trên vào Git.

## Triển khai và kiểm tra

1. Cấu hình hai biến môi trường và khởi động lại bot.
2. Quản trị viên chạy `/lich-hoc-roles add <role>`.
3. Thành viên có role đó chạy `/lich-hoc-login` và nhập thông tin trong modal.
4. Chạy `/lich-hoc` hoặc `/lich-hoc ngay=<YYYY-MM-DD>`.

Token endpoint, API lịch và chứng chỉ TLS của API được đóng gói trong
`src/features/schedule/services/`. Nếu nhà cung cấp đổi API hoặc certificate,
cập nhật phần tích hợp này; không cần đổi lệnh và phân quyền role.
