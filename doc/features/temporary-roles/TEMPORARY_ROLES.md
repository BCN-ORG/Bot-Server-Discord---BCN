# Quản lý role tạm thời

## Tổng quan

Quản trị viên có thể cấp role tạm thời cho các thành viên hiện có một role
nhóm được chọn. Mỗi phiên đang hoạt động được xác định theo máy chủ và cặp
role nhóm/role đích. Khi chạy lại `/role set`, bot cập nhật thời hạn và chụp
lại danh sách thành viên nhưng không xóa các bản ghi của những lần chạy trước.

## Lệnh

- `/role set group_role target_role [duration]`: cấp role đích cho thành viên
  đủ điều kiện. Thời hạn tính theo ngày 24 giờ, mặc định là 1 ngày, có thể đặt
  từ 1 đến 36.500 ngày.
- `/role list`: xem tối đa 15 phiên đang hoạt động trong máy chủ hiện tại.
- `/role revoke session_id`: bắt đầu thu hồi thủ công theo mã phiên.

Người dùng lệnh cần quyền `Manage Roles`. Bot cũng cần quyền `Manage Roles`, và
role cao nhất của bot phải cao hơn role đích. Role nhóm và role đích phải khác
nhau.

Thành viên đã có role đích nhưng chưa có bản ghi cấp role trong phiên sẽ bị bỏ
qua. Khi chụp lại danh sách, bot giữ các bản ghi cấp role từ trước để vẫn thu
hồi được role của thành viên đã rời nhóm. Nếu không có thành viên đủ điều kiện,
bot vẫn tạo phiên rỗng; phiên kết thúc khi hết thời hạn.

## Lưu trữ dữ liệu

MongoDB sử dụng hai bộ sưu tập:

- `role_schedules`: lưu máy chủ, role nhóm, role đích, thời hạn, các mốc thời
  gian, thời điểm hết hạn, số thành viên đang được quản lý, trạng thái phiên và
  trạng thái kết thúc đang chờ (nếu có).
- `schedule_member_details`: lưu một bản ghi cho mỗi cặp phiên/thành viên, gồm
  trạng thái cấp/thu hồi role, thao tác, các mốc thời gian và lỗi gần nhất.

MongoDB tự tạo chỉ mục duy nhất có điều kiện trên cặp máy chủ/role nhóm/role
đích đang hoạt động, chỉ mục duy nhất trên cặp phiên/thành viên và các chỉ mục
phục vụ scheduler.

Trạng thái thành viên gồm `PENDING_ASSIGN`, `ASSIGNED`, `PENDING_REVOKE`,
`REVOKED`, `FAILED` và `USER_LEFT`. Trạng thái chờ giúp khôi phục thao tác cấp
hoặc thu hồi sau khi tiến trình bị gián đoạn. Nếu thu hồi thất bại, phiên vẫn
hoạt động để scheduler có thể thử lại thay vì ghi nhận hoàn tất.

## Scheduler và khôi phục

Scheduler chạy mỗi phút và thực hiện một lượt khôi phục khi bot khởi động.
Các phiên đã hết hạn được thu hồi theo từng thành viên. Lỗi với một thành viên
được ghi nhận nhưng không ngăn xử lý những thành viên còn lại. Thành viên không
còn trong máy chủ được đánh dấu `USER_LEFT`. Nếu role đích đã bị xóa thì không
còn role nào cần thu hồi, nên bản ghi được xem là đã xử lý.

Mọi truy vấn phiên và thành viên đều được giới hạn theo mã máy chủ và mã phiên.
