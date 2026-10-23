# Biên bản phạt coins

## Tổng quan

Tính năng lưu biên bản phạt coins, cho phép thành viên được cấp quyền lập
biên bản qua role, và cho phép cá nhân tra cứu biên bản của mình. Bot chỉ ghi
nhận số coins; không tự trừ coins hay gọi API chuyển tiền. Quản trị viên xử lý
coins bên ngoài rồi cập nhật trạng thái biên bản theo mã.

Mỗi biên bản lưu người bị lập, người lập, thời điểm lập, số coins, lý do, ghi
chú/bằng chứng tùy chọn và lịch sử thay đổi trạng thái.

## Quyền hạn

- Quản trị viên cấu hình danh sách role được phép lập biên bản.
- Người có ít nhất một role trong danh sách được phép lập biên bản.
- Có thể lập biên bản cho bất kỳ thành viên nào trong máy chủ; không bắt buộc
  người bị lập phải có role đặc biệt.
- Mỗi thành viên chỉ xem danh sách và chi tiết biên bản của chính mình.
- Quản trị viên có thể tra cứu biên bản của thành viên khác và đổi trạng thái.
- Người bị lập được gửi thông báo riêng và có thể gửi một kháng cáo cho mỗi
  biên bản; quản trị viên xem danh sách và chi tiết kháng cáo.
- Bot không tự khấu trừ coins. Trừ coins được xử lý riêng bởi quản trị viên.

## Lệnh

### Lập và tra cứu biên bản

- `/fine create user`: chọn người bị lập bằng tùy chọn thành viên của Discord,
  sau đó mở form có đoạn văn bản hiển thị tên và ID thành viên đã chọn, cùng
  các ô số coins dự định phạt và lý do/nội dung biên bản. Tên người bị lập là
  văn bản chỉ đọc, không phải ô nhập; ID người bị lập được lấy từ lựa chọn
  Discord và dùng để lưu biên bản. Ô lý do dùng để trình bày đầy đủ sự việc và
  căn cứ lập biên bản. Người lập được xác định ngầm bằng ID Discord của người
  chạy lệnh và vẫn được lưu/hiển thị trên biên bản. Số coins chỉ được ghi nhận;
  bot không khấu trừ.
- `/fine list [member] [page]`: xem danh sách biên bản theo trang (10 biên bản
  mỗi trang); phần tổng số biên bản, tổng coins dự định phạt không bị từ chối
  và coins đang chờ xử lý được hiển thị cuối danh sách. Thành viên chỉ xem được
  biên bản của mình; quản trị viên có thể chọn thành viên khác.
- `/fine detail report_id`: xem chi tiết biên bản của bản thân.
- `/fine appeal report_id`: mở form kháng cáo phiếu phạt của bản thân. Form hiển
  thị lý do gốc và yêu cầu nhập nội dung trình bày kháng cáo.
- `/fine appeals [page]`: quản trị viên xem danh sách kháng cáo.
- `/fine appeal-detail report_id`: quản trị viên xem chi tiết kháng cáo theo mã
  phiếu phạt.

Embed biên bản hiển thị người lập theo ID Discord, người bị lập, số coins dự
định phạt (chưa trừ), lý do/nội dung biên bản, thời gian tạo, trạng thái và
lịch sử trạng thái. Khi lập phiếu thành công, bot nhắn riêng người bị lập với
mã phiếu, lý do, số coins chưa trừ và hướng dẫn kháng cáo. Nếu DM không gửi
được, phiếu vẫn được lưu và người lập nhận thông báo.
Mã biên bản là MongoDB
ObjectId 24 ký tự hệ thập lục phân.

Mỗi phiếu chỉ được gửi kháng cáo một lần. Nội dung và thời điểm kháng cáo được
lưu cùng biên bản với trạng thái `PENDING`; việc gửi kháng cáo không tự đổi
trạng thái phiếu phạt. Danh sách và chi tiết kháng cáo chỉ dành cho quản trị
viên.

### Cấu hình role và quản lý trạng thái

Các lệnh sau chỉ dành cho quản trị viên:

- `/fine role-add role`: thêm role được phép lập biên bản.
- `/fine role-remove role`: xóa role khỏi danh sách cho phép.
- `/fine roles`: xem danh sách role được phép.
- `/fine list member`: xem biên bản của thành viên được chọn.
- `/fine status report_id status [note]`: đặt trạng thái thành `PENDING`
  (chờ xử lý), `REJECTED` (từ chối) hoặc `PROCESSED` (đã xử lý). Ghi chú thay
  đổi trạng thái không bắt buộc.

Quản trị viên tự thực hiện việc trừ coins ngoài bot; sau đó dùng `/fine status`
để cập nhật biên bản tương ứng. Mọi lần đổi trạng thái được ghi lại cùng người
thực hiện, thời gian và ghi chú.

## Lưu trữ MongoDB

- `fine_reports`: biên bản phạt và lịch sử trạng thái.
- `fine_report_roles`: danh sách role được phép lập biên bản theo từng máy chủ.

Mỗi biên bản gồm các trường chính:

| Trường | Ý nghĩa |
| --- | --- |
| `_id` | Mã biên bản |
| `guildId` | Máy chủ lập biên bản |
| `targetUserId` | Người bị lập |
| `reporterUserId` | Người lập |
| `amount` | Số coins dự định phạt; không tự động trừ |
| `reason` | Lý do bắt buộc |
| `details`, `evidence` | Ghi chú và bằng chứng tùy chọn |
| `status` | `PENDING`, `REJECTED` hoặc `PROCESSED` |
| `createdAt` | Thời gian lập |
| `statusHistory` | Các lần chuyển trạng thái, người thực hiện, thời gian và ghi chú |
| `appeal` | Kháng cáo một lần: người gửi, thời điểm, nội dung và trạng thái |

## Các trường hợp cần lưu ý

- Không thể lập biên bản khi chưa cấu hình role được phép.
- Người lập phải còn role cho phép tại lúc gửi form; quyền được kiểm tra lại
  khi gửi form, không chỉ khi mở.
- Không cho lập biên bản cho tài khoản bot hoặc thành viên ngoài máy chủ.
- Số coins dự định phạt phải là số nguyên dương an toàn; lý do/nội dung biên
  bản không được để trống.
- Việc chuyển trạng thái không tự động thực hiện hay xác nhận giao dịch coins.
- Thành viên rời máy chủ không xóa biên bản; quản trị viên vẫn có thể tra cứu
  qua mã trong máy chủ.
- Ghi lại lịch sử khi đổi trạng thái, kể cả khi chuyển lại trạng thái cũ.

## Danh sách kiểm tra

- [ ] Người không có role cho phép không mở được form lập biên bản.
- [ ] Người có role cho phép có thể lập biên bản cho thành viên thường.
- [ ] `/fine create` yêu cầu chọn `user`, rồi đoạn văn bản chỉ đọc trên form
      hiển thị đúng người bị lập; ID đích lấy từ lựa chọn Discord.
- [ ] Lệnh yêu cầu `amount`; số coins dự định phạt được hiển thị rõ là chưa trừ.
- [ ] Thiếu lý do/nội dung biên bản, số coins không hợp lệ hoặc tài khoản đích
      là bot thì bị từ chối.
- [ ] Biên bản mới có trạng thái `PENDING` và lưu đúng người lập/người bị lập/
      thời điểm/số coins dự định phạt/lý do biên bản.
- [ ] Cá nhân chỉ xem được biên bản của chính mình.
- [ ] Quản trị viên xem được biên bản của thành viên khác và chi tiết theo ID.
- [ ] Tổng coins đang chờ xử lý chỉ tính biên bản `PENDING`; biên bản bị từ
      chối không cộng vào tổng.
- [ ] Cập nhật trạng thái lưu lại người thực hiện, thời gian và ghi chú.
- [ ] Cập nhật trạng thái không gọi API và không tự trừ coins.
- [ ] Khi lập phiếu, DM người bị lập có mã phiếu và hướng dẫn kháng cáo.
- [ ] Người dùng chỉ kháng cáo được phiếu lập cho chính mình; kháng cáo lặp lại
      cùng một phiếu bị từ chối, kể cả khi gửi đồng thời.
- [ ] Form kháng cáo hiển thị lý do gốc, lưu nội dung và thời điểm gửi; quản trị
      viên chỉ xem được danh sách/chi tiết kháng cáo trong máy chủ.

---

*Cập nhật lần cuối: 2026-10-22*
