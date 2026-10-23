# Quy trình nhận role bằng biểu tượng cảm xúc

## Tổng quan

Tính năng này cho phép thành viên nhận role bằng cách thêm biểu tượng cảm xúc
vào một tin nhắn đã cấu hình. Biểu tượng cảm xúc đóng vai trò đăng ký nhận
role, thay vì chỉ biểu thị cảm xúc.

Một tin nhắn có thể cấp nhiều role. Mỗi role trên cùng tin nhắn có cấu hình và
giới hạn riêng.

**Trạng thái:** Đã triển khai.

## Cấu hình

Quản trị viên tạo hoặc cập nhật cấu hình bằng lệnh slash, ví dụ:

```text
/reaction-role set channel message_id role limit emoji [duration_days]
```

Tham số:

| Tham số | Ý nghĩa |
| --- | --- |
| `channel` | Kênh chứa tin nhắn (cần thiết vì Discord API tìm tin nhắn qua ID kênh). |
| `message_id` | ID tin nhắn dùng để nhận role. |
| `role` | Role được cấp khi biểu tượng cảm xúc hợp lệ. |
| `limit` | Số thành viên tối đa được nhận role qua cấu hình này. Phải là số nguyên dương. |
| `emoji` | Emoji được chấp nhận; mặc định là `all`. Dùng `all` để chấp nhận mọi emoji. |
| `duration_days` | Thời hạn role tính theo ngày (1–36.500); bỏ trống để role không tự hết hạn. |

Các lệnh quản trị khác:

```text
/reaction-role remove message_id role
/reaction-role list
```

`set` yêu cầu quyền **Manage Roles**. Bot cũng cần quyền **Manage Roles** và
role cần cấp phải thấp hơn role cao nhất của bot. Trong kênh cấu hình, bot cần
quyền **View Channel**, **Read Message History** và **Manage Messages** để đọc
tin nhắn và gỡ biểu tượng cảm xúc vượt giới hạn.

Khi cấu hình emoji cụ thể, chỉ biểu tượng cảm xúc đó mới được xử lý. Với `all`,
mọi biểu tượng cảm xúc trên tin nhắn đều có thể kích hoạt cùng cấu hình role; một
thành viên chỉ được tính một lần trong cùng cấu hình, dù họ thêm nhiều biểu tượng.

Bot kiểm tra quyền quản lý cấu hình của người gọi, sự tồn tại của tin nhắn,
tính hợp lệ của role và quyền cấp role của bot (bao gồm thứ bậc role).

## Lưu cấu hình

MongoDB lưu cấu hình trong collection dành cho tính năng này. Mỗi tài liệu
đại diện cho một cặp tin nhắn và role:

```js
{
  guildId: "guild-id",
  channelId: "channel-id",
  messageId: "message-id",
  roleId: "role-id",
  emojiKey: "all", // hoặc định danh emoji cụ thể
  limit: 10,
  durationDays: 7, // null nếu role không hết hạn
  claimants: [
    {
      userId: "user-id",
      emojiKeys: ["emoji-id-or-name"],
      roleWasPreexisting: false,
      expireAt: Date // null nếu role không hết hạn
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

Khóa nhận diện cấu hình là `messageId + roleId` (được lưu kèm `guildId` để bảo
đảm dữ liệu thuộc đúng máy chủ). Khi quản trị viên tạo lại cấu hình với cùng
`messageId + roleId`, bot cập nhật tài liệu hiện có. Vì vậy, cùng một tin nhắn
có thể có nhiều tài liệu với các `roleId` khác nhau; mỗi role có `limit` và
`emoji` riêng. Mảng `claimants` lưu thành viên đang chiếm chỗ và các emoji họ
đã thêm; dữ liệu này cũng giúp bot chỉ gỡ role do tính năng cấp.

MongoDB tạo chỉ mục duy nhất cho `guildId + messageId + roleId` để tránh cấu
hình trùng lặp.

## Quy tắc tính giới hạn

- Giới hạn áp dụng riêng cho từng tài liệu `messageId + roleId`.
- Đếm số thành viên có biểu tượng cảm xúc hợp lệ cho cấu hình đó; không tính
  biểu tượng của bot.
- Thành viên đã có role từ nguồn khác không làm giảm số chỗ; giới hạn chỉ xét lượt
  nhận role qua cấu hình này.
- Một thành viên chỉ chiếm tối đa một chỗ trong cùng cấu hình.
- Nếu cấu hình có `duration_days`, thời hạn bắt đầu khi thành viên nhận role và
  được lưu riêng trong lượt nhận đó. Cập nhật thời hạn cấu hình chỉ áp dụng cho
  lượt nhận mới; lượt đang hoạt động giữ nguyên thời điểm hết hạn đã lưu.
- Khi `emoji` là một emoji cụ thể, chỉ tính người thêm biểu tượng đó.
- Khi `emoji` là `all`, tính thành viên duy nhất trên các biểu tượng của tin
  nhắn, không tính trùng người thêm nhiều biểu tượng.

Ví dụ: `limit = 10`, ban đầu chưa có biểu tượng hợp lệ. Mười thành viên đầu tiên
được cấp role. Thành viên thứ 11 bị từ chối; bot gỡ biểu tượng vừa thêm và không cấp
role. Việc này không phụ thuộc số thành viên vốn đã có role đó.

Việc kiểm tra số chỗ và cấp role được bảo vệ khi có nhiều biểu tượng được thêm
đồng thời, tránh trường hợp nhiều sự kiện cùng thấy còn chỗ và làm vượt giới hạn.

## Luồng quản trị viên

1. Quản trị viên chạy `/reaction-role set` với ID tin nhắn, role, giới hạn và
   emoji cụ thể hoặc `all`.
2. Bot xác thực quyền, dữ liệu đầu vào, tin nhắn, role và quyền cấp role.
3. Bot tìm cấu hình theo `guildId + messageId + roleId`.
4. Nếu tài liệu đã tồn tại, bot ghi đè các giá trị được cấu hình và cập nhật
   `updatedAt`; nếu chưa có, bot tạo tài liệu mới.
5. Bot phản hồi xác nhận cấu hình đã lưu. Cấu hình chỉ áp dụng cho đúng role
   trên đúng tin nhắn; các role khác trên tin nhắn không bị thay đổi.

## Luồng thành viên thêm biểu tượng cảm xúc

```text
Thành viên thêm biểu tượng cảm xúc vào tin nhắn
        |
        v
Bot nhận sự kiện thêm biểu tượng cảm xúc
        |
        v
Bỏ qua bot / biểu tượng của bot; kiểm tra tin nhắn và emoji
        |
        v
Tìm cấu hình theo ID tin nhắn, rồi lọc theo role và emoji
        |
   Không tìm thấy --------------------> Không làm gì
        |
   Có cấu hình
        v
Thành viên đã được tính trong cấu hình này?
   Có -------------------------------> Không chiếm thêm chỗ;
                                        bảo đảm role vẫn được cấp
   Không
        |
        v
Còn chỗ dưới giới hạn?
   Có -------------------------------> Cấp role, ghi nhận lượt nhận
   Không ----------------------------> Gỡ biểu tượng mới, không cấp role
```

Khi tìm cấu hình, bot lấy các tài liệu cùng `messageId`, sau đó xét riêng từng
`roleId` và điều kiện emoji. Nhiều cấu hình trên cùng một tin nhắn được đánh giá
độc lập.

## Luồng thành viên bỏ biểu tượng cảm xúc

Khi thành viên bỏ biểu tượng cảm xúc:
1. Bot nhận sự kiện bỏ biểu tượng và tìm cấu hình khớp tin nhắn, role, emoji.
2. Nếu cấu hình chỉ định một emoji cụ thể, bỏ chính emoji đó sẽ kết thúc lượt
   nhận của cấu hình, giải phóng chỗ và thu hồi role nếu không còn nguồn nhận
   role nào khác.
3. Nếu cấu hình là `all`, bot chỉ thu hồi lượt nhận khi thành viên bỏ hết mọi
   emoji họ đã dùng để nhận role trên tin nhắn đó. Bỏ một emoji nhưng vẫn còn
   emoji khác thì giữ role và chỗ đã chiếm.
4. Nếu thành viên vẫn đủ điều kiện nhận cùng role từ cấu hình khác, bot giữ role
   nhưng giải phóng chỗ của lượt nhận đã hủy.
5. Không gỡ role nếu thành viên đã có role đó trước khi nhận qua tính năng này.

Sau khi lượt nhận bị xóa, `/reaction-role list` hiển thị số lượt nhận giảm đi.
Thành viên khác có thể dùng chỗ vừa trống nếu cấu hình vẫn còn hiệu lực. Nếu bot
không thể thu hồi role do lỗi Discord hoặc thiếu quyền, lượt nhận vẫn được giữ
để tránh báo chỗ trống sai; lỗi được ghi nhật ký.

Trạng thái lượt nhận được lưu trong tài liệu cấu hình theo người dùng và danh
sách emoji đang được tính. Nếu thành viên đã có role trước khi nhận qua tính
năng, bot ghi nhớ điều đó và không tự gỡ role khi thành viên bỏ biểu tượng. Lượt nhận
được lưu bền vững để duy trì số chỗ qua lần khởi động lại. Nếu cấu hình được
cập nhật với giới hạn thấp hơn số lượt nhận hiện có, các lượt cũ được giữ; bot
không nhận thêm lượt mới cho tới khi số lượt thấp hơn giới hạn.

## Thời hạn và tự động thu hồi role

Quản trị viên có thể thêm `duration_days` khi chạy `/reaction-role set`. Giá trị
là số nguyên từ 1 đến 36.500 ngày. Nếu bỏ trống, role được giữ vô thời hạn và
chỉ bị gỡ khi thành viên bỏ biểu tượng hoặc cấu hình bị xóa theo các quy tắc
phía trên.

Khi cấp role, bot lưu `expireAt` cho lượt nhận trong MongoDB. Scheduler kiểm tra
mỗi phút và thu hồi role khi đã đến thời điểm này; bot cũng kiểm tra ngay lúc
khởi động. Thời hạn tính theo số ngày 24 giờ kể từ lúc nhận role, không chờ đến
nửa đêm. Nếu cùng role còn lượt nhận hợp lệ từ cấu hình khác, bot giữ role; nếu
thành viên đã có role trước khi nhận, bot cũng không tự gỡ role đó. Lỗi thu hồi
được ghi nhật ký và lượt nhận chưa xử lý được giữ lại để thử lại ở lần kiểm tra
tiếp theo.

## Thông báo riêng

Khi bot thực sự cấp role reaction cho thành viên, bot gửi embed qua tin nhắn
riêng, ghi tên máy chủ, role, thời gian sử dụng (ví dụ: 1 ngày hoặc không thời
hạn) và thời điểm hết hạn nếu có. Bot cũng gửi embed khi thu hồi role do thành
viên hủy reaction cuối cùng, hết thời hạn hoặc quản trị viên xóa cấu hình.
Không gửi thông báo thu hồi nếu role vẫn được giữ bởi nguồn nhận khác hoặc đã
có sẵn trước khi đăng ký. Nếu thành viên tắt tin nhắn riêng, bot ghi cảnh báo
vào log; thao tác cấp/gỡ role vẫn được giữ nguyên.

## Trường hợp lỗi và ngoại lệ

- **Thành viên hủy biểu tượng cuối cùng:** Thu hồi role do cấu hình cấp và trả
  lại một chỗ trong giới hạn, trừ khi role còn được giữ bởi lượt nhận khác hoặc
  đã tồn tại trước khi thành viên đăng ký.
- **Thành viên hủy một trong nhiều biểu tượng của `all`:** Chỉ trả lại chỗ và
  thu hồi role sau khi biểu tượng được chấp nhận cuối cùng bị hủy.
- **Biểu tượng trên tin nhắn chưa cấu hình:** Bỏ qua.
- **Emoji không khớp cấu hình:** Không cấp role.
- **Đã đủ giới hạn:** Gỡ biểu tượng vượt giới hạn; nếu bot không gỡ được do thiếu
  quyền, ghi nhật ký lỗi và không cấp role.
- **Role đã bị xóa hoặc bot mất quyền:** Không cấp role, ghi nhật ký lỗi; cấu hình
  cần được quản trị viên cập nhật.
- **Thành viên rời máy chủ:** Bot xóa các lượt nhận của thành viên và giải phóng chỗ.
- **Tin nhắn bị xóa:** Cấu hình vẫn được lưu; quản trị viên có thể xóa cấu hình
  bằng `/reaction-role remove`.
- **Discord API hoặc MongoDB lỗi:** Không trả phản hồi thành công giả; ghi nhật ký
  lỗi và tránh cập nhật một phần trạng thái lượt nhận.
- **Không gỡ được role:** Lượt nhận vẫn giữ chỗ để tránh cấp vượt giới hạn; quản trị
  viên có thể thử xóa cấu hình sau khi sửa quyền bot.

## Checklist kiểm thử hủy biểu tượng

- [ ] Đặt giới hạn là 2; cho hai thành viên nhận role và xác nhận `/reaction-role
      list` hiển thị đã nhận **2**.
- [ ] Một thành viên hủy biểu tượng duy nhất: xác nhận bot thu hồi role, số đã
      nhận giảm còn **1**, và thành viên thứ ba có thể nhận role.
- [ ] Với `emoji = all`, thành viên thêm hai biểu tượng rồi hủy một biểu tượng:
      role vẫn còn và số đã nhận vẫn giữ nguyên.
- [ ] Thành viên đó hủy biểu tượng còn lại: role bị thu hồi và số đã nhận giảm
      đi một.
- [ ] Với cấu hình chỉ định một emoji, thành viên hủy đúng emoji đó: role bị
      thu hồi ngay nếu không có nguồn nhận role khác và role không có sẵn từ trước.
- [ ] Thành viên vốn đã có role trước khi nhận: hủy biểu tượng không làm bot gỡ
      role có sẵn, nhưng lượt nhận được xóa và chỗ được trả lại.
- [ ] Thành viên còn lượt nhận cùng role từ cấu hình khác: hủy lượt này không
      gỡ role, nhưng chỗ của cấu hình vừa hủy được trả lại.
- [ ] Thu hồi role thất bại do thiếu quyền: lỗi được ghi nhật ký và chỗ không bị
      tính là trống.
- [ ] Khi bot cấp hoặc thu hồi role reaction, thành viên nhận embed tin nhắn
      riêng; nếu tin nhắn riêng bị tắt, thao tác role vẫn hoàn tất và bot ghi
      cảnh báo.

## Hành vi khi cấu hình

- Tạo/cập nhật: `/reaction-role set channel message_id role limit emoji`.
- Xóa cấu hình: `/reaction-role remove message_id role`. Chọn role có sẵn trong
  máy chủ; bot dùng ID role đó để tìm cấu hình trong MongoDB. Bot gỡ role do
  tính năng cấp nếu thành viên không còn lượt nhận ở cấu hình khác.
- Xem cấu hình: `/reaction-role list`.
- Cấu hình mới chỉ xử lý biểu tượng được thêm sau khi cấu hình được lưu; biểu
  tượng đã tồn tại trước đó không được đồng bộ hoặc tự động cấp role.
