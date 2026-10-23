# Kick Manager

Tính năng này cho phép quản trị viên cấp quyền theo role để thành viên có role đó sử dụng lệnh kick/rollback.

- Admin cấu hình quyền bằng `/kick-manager add-role`, `/kick-manager remove-role` và xem danh sách bằng `/kick-manager list`.
- Admin cấu hình các kênh log bằng `/kick-manager add-log-channel`, `/kick-manager remove-log-channel` và xem cấu hình bằng `/kick-manager log-channels`. Khi có thành viên bị kick bằng lệnh bot hoặc bởi moderator khác, các kênh đã cấu hình chỉ nhận embed ai kick ai, lý do, thời điểm, mã kick và role snapshot. Bot cần quyền xem nhật ký kiểm toán để nhận diện các lần kick do moderator khác thực hiện.
- Dùng `/kick user` để kick trực tiếp; người gọi phải có ít nhất một role được cấp quyền.
- Sau khi kick thành công, bot trả về mã kick. Admin dùng `/kick-manager detail kick-id` để xem đầy đủ thông tin và thuộc tính role snapshot.
- Khi dùng `/kick`, bot gửi DM thông báo trước khi thực hiện kick; nếu người dùng tắt DM, thao tác kick vẫn tiếp tục và người thực hiện được báo. Sau khi rollback thành công, bot gửi DM liệt kê các role được khôi phục.
- Dùng `/kick-rollback user` để khôi phục role sau khi người bị kick quay lại server.
- Mỗi lần kick được lưu snapshot role hiện tại của người bị kick, kèm tên người kick, thời điểm kick và thời hạn rollback (24h).
- Chỉ người kick có role được cấp quyền mới có thể rollback lần kick gần nhất của chính họ trong vòng 24 giờ.
- Mỗi lần kick chỉ được rollback tối đa 1 lần.
- Rollback chỉ có thể thực hiện sau khi người bị kick đã tự quay lại máy chủ và bot mới bổ sung lại role snapshot.
