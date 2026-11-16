# Theo dõi thông tin hệ thống

Tính năng theo dõi hệ thống cung cấp thông tin RAM và pin qua
`GET /api/system`. Tuyến API được đăng ký trong `src/routes/index.js` và xử lý
tại `src/routes/systemRoutes.js`.

## Lệnh Discord

Lệnh slash `/battery` hiển thị phần trăm pin, trạng thái sạc, nguồn điện, sức
khỏe và nhiệt độ pin. Lệnh lấy dữ liệu từ API nội bộ `GET /api/system`, nên bot
cần chạy trên Android/Termux và API phải được khởi động cùng ứng dụng.

Lệnh quản trị `/battery-alert-role add` thêm role nhận báo cáo pin; dùng
`/battery-alert-role remove` để xóa và `/battery-alert-role list` để xem danh
sách. Mỗi giờ vào phút `00` (múi giờ `Asia/Ho_Chi_Minh`), bot đọc pin một lần
rồi gửi cùng báo cáo qua DM cho các thành viên có ít nhất một role đã cấu hình.
Thành viên có nhiều role trong danh sách chỉ nhận một DM mỗi giờ.

## Nền tảng được hỗ trợ

Tuyến API chỉ lấy thông tin thiết bị khi phát hiện hệ điều hành Android hoặc
môi trường Termux. Trên nền tảng khác, API trả về HTTP `501` và không chạy các
lệnh dành riêng cho nền tảng.

## Nguồn dữ liệu

- **Pin:** lệnh `termux-battery-status`. Cần cài gói `termux-api` và ứng dụng
  Termux:API trên Android để lấy dữ liệu này.
- **Bộ nhớ:** lệnh `free -m`; API trả về tổng dung lượng, dung lượng đã dùng,
  dung lượng còn trống và tỷ lệ sử dụng theo MB.
- **Nhiệt độ:** nhiệt độ pin lấy từ `termux-battery-status`.

Các lệnh được chạy với thời hạn chờ giới hạn. Nếu thiếu lệnh hoặc dữ liệu trả
về không hợp lệ, chỉ số tương ứng có giá trị `null`; các chỉ số khác vẫn được
trả về bình thường.

Xem [tài liệu API](../../api/internal/SYSTEM_API.md) để biết đường dẫn, định
dạng phản hồi và các mã trạng thái HTTP.
