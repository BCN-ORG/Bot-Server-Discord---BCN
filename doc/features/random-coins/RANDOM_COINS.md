# Sự kiện random coins

## Tổng quan

Quản trị viên tạo một sự kiện random bằng lệnh `/coin-random create`. Bot đăng
embed kèm nút ngay trong kênh đang dùng lệnh, không cần nhập ID kênh. Hỗ trợ
kênh chat văn bản và chat tích hợp trong kênh thoại. Thành viên nhấn nút để
nhận ngẫu nhiên từ 1 đến mức coins tối đa được cấu hình.

Kết quả được lưu lại và thông báo công khai trong kênh, có nhắc tên người nhận:
“@thành viên vừa nhận được X coin từ hòm khi báu”. Đây chỉ là thông báo kết quả; bot không chuyển
hoặc cộng coins.

## Lệnh và cách dùng

- `/coin-random create max-coins duration-days`: chỉ quản trị viên được dùng.
  Tạo sự kiện trong kênh hiện tại, với kết quả nguyên từ 1 đến `max-coins`
  (bao gồm cả hai đầu mút) và thời hạn bắt buộc từ 1 đến 3650 ngày.
- `/coin-random disable event-id`: chỉ quản trị viên được dùng. Vô hiệu hóa
  ngay sự kiện có ID tương ứng, chặn các lượt bấm tiếp theo và tắt nút trên
  embed gốc nếu bot truy cập được tin nhắn. Trạng thái trên chính embed được
  sửa thành **Đã vô hiệu hóa**.
- `/coin-random enable event-id`: kích hoạt lại sự kiện đã vô hiệu hóa nếu
  chưa đến thời điểm hết hạn. Sự kiện hết hạn không thể kích hoạt lại.
- Nút **Random coins**: mỗi thành viên chỉ nhận kết quả một lần cho mỗi sự
  kiện. Nhấn lại sẽ nhận thông báo rằng đã tham gia.

## Lưu trữ

- `coin_random_events`: máy chủ, kênh, người tạo, mức tối đa, thời hạn, thời
  điểm hết hạn, trạng thái, thời điểm tạo và tin nhắn embed.
- `coin_random_results`: mã sự kiện, người tham gia, kết quả và thời điểm nhận.
- Chỉ mục duy nhất trên `(eventId, userId)` ngăn một người nhận nhiều kết quả
  trong cùng sự kiện, kể cả khi nhấn nút đồng thời từ nhiều thiết bị.

## Quy tắc

- Mỗi lần tạo lệnh sinh một sự kiện riêng; không có chức năng chuyển coins.
- Sự kiện bị admin vô hiệu hóa có trạng thái `DISABLED`; mọi lần bấm nút sau
  đó bị từ chối dù nút trên tin nhắn chưa cập nhật được.
- Sự kiện tự chuyển sang `EXPIRED` khi hết thời hạn; bot kiểm tra mỗi phút và
  sửa embed gốc để hiển thị trạng thái mới, đồng thời tắt nút.
- Thời hạn bắt đầu từ lúc tạo và vẫn trôi qua khi sự kiện bị vô hiệu hóa.
  `/coin-random enable` chỉ hoạt động trước hạn hết sự kiện.
- Embed gốc luôn hiển thị trạng thái sự kiện; khi trạng thái đổi, bot sửa
  embed và nút trực tiếp trên tin nhắn sự kiện đã lưu.
- Mức tối đa phải là số nguyên dương, không vượt `2,147,483,647`.
- Mỗi kết quả được chọn đồng đều trong khoảng từ 1 đến mức tối đa.
- Kết quả được trả lời công khai trong kênh; không gửi DM riêng.
- Nếu bot không đăng được embed, sự kiện được đánh dấu thất bại và nút không
  thể cấp kết quả.

## Kiểm tra

- [ ] Thành viên không phải admin không thể tạo sự kiện.
- [ ] Sự kiện được đăng kèm nút với mức tối đa đã cấu hình.
- [ ] Kết quả luôn nằm trong khoảng từ 1 đến mức tối đa.
- [ ] Một thành viên không thể nhận hơn một kết quả trong cùng sự kiện.
- [ ] Sự kiện hết hạn tự chuyển trạng thái và embed gốc được cập nhật.
- [ ] Admin có thể kích hoạt lại sự kiện đã disable trước khi hết hạn, nhưng
      không thể enable sự kiện hết hạn.
- [ ] Thành viên nhận câu thông báo công khai có nhắc tên “@thành viên vừa nhận được X coin từ hòm khi báu”.
- [ ] Không có thao tác chuyển hoặc cộng coins.
