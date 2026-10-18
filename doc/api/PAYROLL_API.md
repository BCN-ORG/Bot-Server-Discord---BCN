# Payroll API — Hướng dẫn sử dụng

Payroll API cho phép hệ thống bên ngoài (ví dụ một bot Discord khác) trả coin từ ví của bot **Viện kiểm sát** cho thành viên có role trong server. Bên gọi tự quyết định trả cho ai, role nào và bao nhiêu; API kiểm tra role, giới hạn số tiền và chặn trả trùng.

## Tổng quan

| Mục | Giá trị |
| --- | --- |
| Base URL | `http://<host>:3000/api/payroll` (host do quản trị bot cung cấp) |
| Định dạng | JSON, header `Content-Type: application/json` cho request có body |
| Xác thực | Header `x-api-key: <API key>` trên **mọi** request |
| ID người dùng / role | Discord snowflake dạng chuỗi số, ví dụ `"966153253400231988"` |

API key do quản trị bot cấp qua kênh riêng. Thiếu hoặc sai key → `401`.

Lấy ID: bật **Developer Mode** (User Settings → Advanced), chuột phải vào người dùng → *Copy User ID*; hoặc Server Settings → Roles, chuột phải vào role → *Copy Role ID*.

## Quy tắc trả lương

| Quy tắc | Chi tiết |
| --- | --- |
| Số tiền | Số nguyên từ 1 đến 100 coins mỗi lần trả |
| Role | Người nhận phải **đang có** role đó trong server lúc gọi. Không dùng được `@everyone`, không trả cho tài khoản bot |
| Chống trả trùng | Mỗi người chỉ nhận **1 lần cho mỗi role trong mỗi tháng**. Gọi lại trả về kết quả cũ với `duplicate: true`, không trừ tiền thêm |
| Tháng | Tính theo giờ Việt Nam (Asia/Ho_Chi_Minh). Sang tháng mới thì trả được lại |
| Nhiều role | Mỗi role tính riêng: người có 2 role nhận 2 khoản nếu bên gọi gọi 2 lần với 2 `roleId` |
| Nguồn tiền | Trừ từ ví bot. Ví không đủ tiền → `FAILED`, không trừ gì |

Nhờ chống trả trùng, bên gọi có thể **retry an toàn** khi timeout hoặc mất kết nối.

## `POST /transfer` — trả lương cho một người

**Body**

| Trường | Kiểu | Bắt buộc | Mô tả |
| --- | --- | --- | --- |
| `userId` | string | có | Discord user ID người nhận |
| `roleId` | string | có | Role được trả lương; người nhận phải đang có role này |
| `amount` | number | có | Số coin, nguyên, 1–100 |
| `description` | string | không | Nội dung hiển thị cho người nhận, tối đa 200 ký tự |

**Ví dụ**

```bash
curl -X POST http://<host>:3000/api/payroll/transfer \
  -H "x-api-key: $PAYROLL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userId":"966153253400231988","roleId":"1338020421328437278","amount":40,"description":"Lương tháng 10"}'
```

**Response `200`**

```json
{
  "reference": "2026-10:1338020421328437278:966153253400231988",
  "period": "2026-10",
  "roleId": "1338020421328437278",
  "roleName": "Sao đỏ",
  "userId": "966153253400231988",
  "amount": 40,
  "status": "SUCCESS",
  "duplicate": false
}
```

| Trường | Ý nghĩa |
| --- | --- |
| `status` | `SUCCESS` đã chuyển; `FAILED` không chuyển được (xem `error`) |
| `duplicate` | `true` = người này đã được trả cho role này trong tháng; **không có tiền mới bị chuyển** và `amount` là số của lần trả trước |
| `error` | Chỉ có khi `status = FAILED` |
| `reference` | Mã khoản chi, dạng `tháng:roleId:userId` |

> Luôn kiểm tra cả `status` lẫn `duplicate`. HTTP `200` không có nghĩa là vừa chuyển tiền.

## `GET /balance` — số dư ví bot

```bash
curl -H "x-api-key: $PAYROLL_API_KEY" http://<host>:3000/api/payroll/balance
```

```json
{ "walletId": "1338054147995340931", "balance": 2798, "maxAmount": 100 }
```

Nên gọi trước mỗi đợt trả lương để chắc ví đủ tiền.

## `GET /payouts` — danh sách đã trả

| Query | Mặc định | Mô tả |
| --- | --- | --- |
| `period` | tháng hiện tại | Dạng `YYYY-MM`, ví dụ `2026-10` |
| `roleId` | tất cả | Lọc theo role |

```bash
curl -H "x-api-key: $PAYROLL_API_KEY" \
  "http://<host>:3000/api/payroll/payouts?period=2026-10&roleId=1338020421328437278"
```

```json
[
  {
    "reference": "2026-10:1338020421328437278:966153253400231988",
    "period": "2026-10",
    "roleId": "1338020421328437278",
    "roleName": "Sao đỏ",
    "userId": "966153253400231988",
    "amount": 40,
    "description": "Lương tháng 10",
    "status": "SUCCESS",
    "createdAt": "2026-10-17T10:55:35.000Z",
    "updatedAt": "2026-10-17T10:55:35.300Z"
  }
]
```

## Mã lỗi

Lỗi có dạng `{ "statusCode": 400, "message": "...", "error": "Bad Request" }`.

| HTTP | Khi nào | Nên làm |
| --- | --- | --- |
| `400` | `amount` không phải số nguyên 1–100, ID sai định dạng, dùng `@everyone` | Sửa request, không retry |
| `401` | Thiếu hoặc sai `x-api-key` | Kiểm tra key |
| `403` | Người nhận không có role đó | Bỏ qua người này |
| `404` | Người nhận không ở trong server | Bỏ qua người này |
| `409` | Một request khác đang xử lý cùng người/role | Đợi vài giây rồi retry |
| `503` | Bot chưa sẵn sàng (đang khởi động) hoặc cấu hình server thiếu | Retry sau |
| `200` + `FAILED` | Ví bot không đủ tiền hoặc lỗi DB | Báo quản trị nạp tiền, rồi gọi lại y hệt |

## Ví dụ: job trả lương hàng tháng (Node.js 18+)

```js
const BASE = 'http://<host>:3000/api/payroll';
const headers = {
  'x-api-key': process.env.PAYROLL_API_KEY,
  'Content-Type': 'application/json',
};

async function pay(userId, roleId, amount, description) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${BASE}/transfer`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId, roleId, amount, description }),
      });
      const body = await res.json();
      // 409/503 là lỗi tạm thời; retry an toàn vì API chống trả trùng.
      if (res.status === 409 || res.status >= 500) throw new Error(body.message);
      return { httpStatus: res.status, ...body };
    } catch (err) {
      if (attempt === 3) return { userId, status: 'ERROR', error: err.message };
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

async function runPayroll(recipients) {
  const { balance } = await (await fetch(`${BASE}/balance`, { headers })).json();
  const total = recipients.reduce((sum, r) => sum + r.amount, 0);
  if (balance < total) throw new Error(`Ví bot thiếu tiền: cần ${total}, có ${balance}`);

  for (const r of recipients) {
    const result = await pay(r.userId, r.roleId, r.amount, r.description);
    if (result.status === 'SUCCESS' && !result.duplicate) console.log('Đã trả', r.userId);
    else if (result.duplicate) console.log('Đã trả trước đó', r.userId);
    else console.warn('Lỗi', r.userId, result.error ?? result.message);
  }
}

runPayroll([
  { userId: '966153253400231988', roleId: '1338020421328437278', amount: 40, description: 'Lương tháng 10' },
]);
```

Gọi tuần tự từng người (không gọi song song cùng một người/role) để tránh `409`.

## Thông báo cho người nhận

Mỗi khoản `SUCCESS` mới (không phải `duplicate`), bot gửi DM cho người nhận một embed **"Thông Báo Trả Lương"** gồm tên role, kỳ lương (ví dụ *tháng 10/2026*), số tiền và `description` nếu có. Người nhận tắt DM thì không nhận được thông báo nhưng tiền vẫn vào ví. Giao dịch cũng hiện trong lịch sử coin của người nhận.

## Bảo mật

- Giữ API key ở server/biến môi trường, **không** commit vào code, không gửi trong kênh công khai.
- Key bị lộ: báo quản trị bot đổi key; key cũ hết hiệu lực ngay khi bot restart.
- Chỉ gọi API qua HTTPS nếu đi qua Internet.
