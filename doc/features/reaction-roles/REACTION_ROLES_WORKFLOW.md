# Reaction Roles Workflow

## Tổng quan

Reaction Roles cho phép thành viên nhận role bằng cách react vào một tin nhắn
được cấu hình. Tính năng thay thế cách dùng reaction chỉ để biểu thị cảm xúc
bằng việc dùng reaction làm thao tác đăng ký nhận role.

Một tin nhắn có thể cấp nhiều role. Mỗi role trên cùng tin nhắn có cấu hình và
giới hạn riêng.

**Trạng thái:** Đã triển khai.

## Cấu hình

Quản trị viên tạo hoặc cập nhật cấu hình bằng slash command, ví dụ:

```text
/reaction-role set channel message_id role limit emoji
```

Tham số:

| Tham số | Ý nghĩa |
| --- | --- |
| `channel` | Kênh chứa tin nhắn (cần thiết vì Discord API tìm message qua channel ID). |
| `message_id` | ID tin nhắn được dùng để nhận role. |
| `role` | Role sẽ được cấp khi react hợp lệ. |
| `limit` | Số thành viên tối đa được nhận role qua cấu hình này. Phải là số nguyên dương. |
| `emoji` | Emoji được chấp nhận; mặc định là `all`. Dùng `all` để chấp nhận mọi emoji. |

Các lệnh quản trị khác:

```text
/reaction-role remove message_id role
/reaction-role list
```

`set` yêu cầu quyền **Manage Roles**. Bot cần quyền **Manage Roles** và role
phải thấp hơn role cao nhất của bot. Trong kênh cấu hình, bot cần **View
Channel**, **Read Message History** và **Manage Messages** để đọc message và gỡ
reaction vượt limit.

Khi cấu hình emoji cụ thể, chỉ reaction bằng emoji đó mới được xử lý. Với `all`,
mọi emoji trên tin nhắn đều có thể kích hoạt cùng cấu hình role; một thành viên
chỉ được tính một lần cho cùng cấu hình, dù họ react nhiều emoji.

Bot kiểm tra người gọi có quyền quản lý cấu hình, tin nhắn tồn tại, role hợp lệ,
và bot có quyền cấp role (bao gồm thứ tự role trong hierarchy).

## Lưu cấu hình

Dùng collection cấu hình Reaction Roles trong MongoDB. Mỗi document đại diện cho
một cặp tin nhắn và role:

```js
{
  guildId: "guild-id",
  channelId: "channel-id",
  messageId: "message-id",
  roleId: "role-id",
  emojiKey: "all", // hoặc định danh emoji cụ thể
  limit: 10,
  claimants: [
    {
      userId: "user-id",
      emojiKeys: ["emoji-id-or-name"],
      roleWasPreexisting: false
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

Khóa nhận diện cấu hình là `messageId + roleId` (nên lưu kèm `guildId` để bảo
đảm dữ liệu đúng server). Khi quản trị viên tạo lại cấu hình với cùng
`messageId + roleId`, bot cập nhật/ghi đè document đó. Vì vậy, cùng một message
có thể có nhiều document với các `roleId` khác nhau và mỗi role có `limit`,
`emoji` riêng. Mảng `claimants` lưu thành viên đang chiếm slot và các emoji họ
đang react; dữ liệu này cũng giúp bot chỉ gỡ role do feature cấp.

MongoDB tạo unique index cho `guildId + messageId + roleId` để tránh cấu hình
trùng.

## Quy tắc tính limit

- Limit áp dụng riêng cho từng document `messageId + roleId`.
- Đếm số thành viên có reaction hợp lệ cho cấu hình đó, không đếm reaction của
  bot.
- Thành viên đã có role từ nguồn khác không làm giảm slot; limit chỉ xét lượt
  nhận role qua cấu hình này.
- Một thành viên chỉ chiếm tối đa một slot trong cùng cấu hình.
- Khi `emoji` là emoji cụ thể, chỉ đếm người react bằng emoji đó.
- Khi `emoji` là `all`, đếm thành viên duy nhất trên các reaction của message,
  không cộng trùng một người react nhiều emoji.

Ví dụ: `limit = 10`, ban đầu có 0 reaction hợp lệ. 10 thành viên đầu tiên được
cấp role. Thành viên thứ 11 bị từ chối; bot gỡ reaction vừa thêm và không cấp
role. Việc này không phụ thuộc số thành viên vốn đã có role đó.

Việc kiểm tra slot và cấp role cần bảo vệ trước các reaction đến đồng thời để
không vượt limit do hai sự kiện cùng thấy còn slot.

## Luồng quản trị viên

1. Quản trị viên chạy `/reaction-role set` với message ID, role ID, limit và
   emoji cụ thể hoặc `all`.
2. Bot xác thực quyền, dữ liệu đầu vào, message, role và quyền cấp role.
3. Bot tìm cấu hình theo `guildId + messageId + roleId`.
4. Nếu đã có document, bot ghi đè các giá trị được cấu hình và cập nhật
   `updatedAt`; nếu chưa có, bot tạo document mới.
5. Bot phản hồi xác nhận cấu hình đã lưu. Cấu hình chỉ áp dụng cho đúng role
   trên đúng message; các role khác của message không bị thay đổi.

## Luồng thành viên thêm reaction

```text
Thành viên react vào message
        |
        v
Bot nhận sự kiện reaction add
        |
        v
Bỏ qua bot / reaction của bot; kiểm tra message và emoji
        |
        v
Tìm cấu hình theo message ID, rồi lọc theo role và emoji
        |
   Không tìm thấy --------------------> Không làm gì
        |
   Có cấu hình
        v
Thành viên đã được tính trong cấu hình này?
   Có -------------------------------> Không tính thêm slot;
                                        bảo đảm role vẫn được cấp
   Không
        |
        v
Còn slot dưới limit?
   Có -------------------------------> Cấp role, ghi nhận lượt nhận
   Không ----------------------------> Gỡ reaction mới, không cấp role
```

Khi tìm cấu hình, bot lấy các document cùng `messageId`, sau đó xét riêng từng
`roleId` và điều kiện emoji. Nhiều cấu hình trên cùng message được đánh giá độc
lập.

## Luồng thành viên bỏ reaction

Khi bỏ reaction:

1. Bot nhận sự kiện reaction remove và tìm cấu hình khớp message, role, emoji.
2. Nếu reaction đó là căn cứ duy nhất để thành viên nhận role theo cấu hình,
   bot gỡ role và giải phóng slot.
3. Nếu emoji là `all` và thành viên vẫn còn reaction khác được cấu hình chấp
   nhận trên cùng message, không gỡ role và không giải phóng slot.
4. Nếu thành viên vẫn đủ điều kiện nhận cùng role từ một cấu hình khác, bot giữ
   role.
5. Không gỡ role nếu bot không cấp role đó qua feature này.

Trạng thái claim được lưu trong document cấu hình, theo user và danh sách emoji
đang được tính. Nếu thành viên đã có role trước khi nhận qua feature, bot ghi
nhớ điều đó và không tự gỡ role khi reaction bị bỏ. Claim được lưu bền vững để
duy trì số slot qua lần khởi động lại. Nếu cấu hình được cập nhật với limit
thấp hơn số claim đang có, các claim cũ được giữ; bot không nhận thêm claim mới
cho tới khi số claim thấp hơn limit.

## Trường hợp lỗi và ngoại lệ

- **Reaction trên message chưa cấu hình:** Bỏ qua.
- **Emoji không khớp cấu hình:** Không cấp role.
- **Đã đủ limit:** Gỡ reaction vượt giới hạn; nếu bot không gỡ được do thiếu
  quyền, ghi log lỗi và không cấp role.
- **Role đã bị xóa hoặc bot mất quyền:** Không cấp role, ghi log lỗi; cấu hình
  cần được quản trị viên cập nhật.
- **Member rời server:** Bot xóa các claim của thành viên và giải phóng slot.
- **Message bị xóa:** Cấu hình vẫn được lưu; quản trị viên có thể xóa cấu hình
  bằng `/reaction-role remove`.
- **Discord API hoặc MongoDB lỗi:** Không trả phản hồi thành công giả; ghi log
  lỗi và tránh thay đổi trạng thái claim một phần.
- **Không gỡ được role:** Claim vẫn giữ chỗ để tránh cấp vượt limit; quản trị
  viên có thể thử gỡ cấu hình sau khi sửa quyền bot.

## Hành vi khi cấu hình

- Tạo/cập nhật: `/reaction-role set channel message_id role limit emoji`.
- Xóa cấu hình: `/reaction-role remove message_id role`. Chọn role có sẵn trong
  server; bot dùng ID của role đã chọn để tìm cấu hình lưu trong MongoDB. Bot
  gỡ role do feature cấp nếu thành viên không còn claim ở cấu hình khác.
- Xem cấu hình: `/reaction-role list`.
- Cấu hình mới chỉ xử lý reaction được thêm sau khi cấu hình được lưu; reaction
  đã tồn tại trước đó không được đồng bộ hoặc tự cấp role.
