# Theo dõi thông tin hệ thống

Tính năng theo dõi hệ thống cung cấp thông tin RAM và pin qua
`GET /api/system`. Tuyến API được đăng ký trong `src/routes/index.js` và xử lý
tại `src/routes/systemRoutes.js`.

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
