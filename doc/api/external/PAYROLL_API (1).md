# Payroll API — Hướng dẫn sử dụng

Payroll API cho phép hệ thống bên ngoài (ví dụ một bot Discord khác) quản lý coin giữa ví của bot **Viện kiểm sát** và thành viên trong server:

- **Trả lương** (`POST /transfer`): chuyển coin từ ví bot cho thành viên có role. API kiểm tra role, giới hạn số tiền và chặn trả trùng trong tuần.
- **Trừ coin** (`POST /deduct`): phạt, trừ coin của thành viên và chuyển vào ví bot.
- **Nạp coin cho bot** (`POST /topup`): chuyển coin từ ví một thành viên vào ví bot.

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

> **Thay đổi:** từ ngày 18/10/2026, kỳ lương chuyển từ **hàng tháng** sang **hàng tuần**. `period` đổi từ dạng `YYYY-MM` sang `YYYY-Www`.

| Quy tắc | Chi tiết |
| --- | --- |
| Số tiền | Số nguyên từ 1 đến 100 coins mỗi lần trả |
| Role | Người nhận phải **đang có** role đó trong server lúc gọi. Không dùng được `@everyone`, không trả cho tài khoản bot |
| Chống trả trùng | Mỗi người chỉ nhận **1 lần cho mỗi role trong mỗi tuần**. Gọi lại trả về kết quả cũ với `duplicate: true`, không trừ tiền thêm |
| Tuần | Tuần ISO, **từ 00:00 thứ Hai đến 23:59 Chủ nhật** theo giờ Việt Nam (Asia/Ho_Chi_Minh). Sang tuần mới thì trả được lại |
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
  -d '{"userId":"966153253400231988","roleId":"1338020421328437278","amount":40,"description":"Lương tuần 42"}'
```

**Response `200`**

```json
{
  "reference": "2026-W42:1338020421328437278:966153253400231988",
  "period": "2026-W42",
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
| `duplicate` | `true` = người này đã được trả cho role này trong tuần; **không có tiền mới bị chuyển** và `amount` là số của lần trả trước |
| `error` | Chỉ có khi `status = FAILED` |
| `reference` | Mã khoản chi, dạng `tuần:roleId:userId` |
| `period` | Tuần ISO của khoản chi, dạng `YYYY-Www`, ví dụ `2026-W42` |

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
| `period` | tuần hiện tại | Dạng `YYYY-Www`, ví dụ `2026-W42`. Các khoản trả trước khi chuyển sang tuần dùng dạng tháng `YYYY-MM` (ví dụ `2026-10`) |
| `roleId` | tất cả | Lọc theo role |

```bash
curl -H "x-api-key: $PAYROLL_API_KEY" \
  "http://<host>:3000/api/payroll/payouts?period=2026-W42&roleId=1338020421328437278"
```

```json
[
  {
    "reference": "2026-W42:1338020421328437278:966153253400231988",
    "period": "2026-W42",
    "roleId": "1338020421328437278",
    "roleName": "Sao đỏ",
    "userId": "966153253400231988",
    "amount": 40,
    "description": "Lương tuần 42",
    "status": "SUCCESS",
    "createdAt": "2026-10-17T10:55:35.000Z",
    "updatedAt": "2026-10-17T10:55:35.300Z"
  }
]
```

## `POST /deduct` — trừ coin của một người

Trừ coin trong ví người dùng (ví dụ phạt). Số coin bị trừ được **chuyển vào ví bot**, không mất đi.

## `POST /topup` — nạp coin cho bot

Chuyển coin **từ ví một người dùng vào ví bot**, dùng để bổ sung tiền cho ví bot trước khi trả lương. Người đó phải có đủ coin.

Hai API này giống nhau về body, response và cách xử lý lỗi. Khác nhau ở mục đích, nội dung giao dịch trong lịch sử coin và DM gửi cho người dùng.

**Body**

| Trường | Kiểu | Bắt buộc | Mô tả |
| --- | --- | --- | --- |
| `reference` | string | có | Mã do bên gọi tự đặt, **duy nhất cho mỗi lần trừ/nạp**. 1–100 ký tự gồm chữ, số và `: _ . -`. Ví dụ `phat-2026-10-24-966153253400231988` |
| `userId` | string | có | Discord user ID của người bị trừ / người nạp. Phải đang ở trong server, không phải bot |
| `amount` | number | có | Số coin, số nguyên dương. **Không giới hạn** |
| `reason` | string | không | Lý do, hiển thị cho người dùng và trong lịch sử coin, tối đa 200 ký tự |

**Quy tắc**

| Quy tắc | Chi tiết |
| --- | --- |
| Chống trừ trùng | Mỗi `reference` chỉ được xử lý **1 lần** (tính riêng cho `deduct` và `topup`). Gọi lại cùng `reference` trả về kết quả cũ với `duplicate: true`, không trừ thêm. Nhờ vậy có thể **retry an toàn** khi timeout |
| Dùng lại `reference` | Gọi lại cùng `reference` nhưng khác `userId` hoặc `amount` → `409`. Mỗi lần trừ/nạp mới phải dùng `reference` mới |
| Không đủ tiền | Ví người dùng không đủ coin → `200` với `status: FAILED`, không trừ gì. Gọi lại cùng `reference` sau khi người đó có đủ coin sẽ được xử lý lại |
| Không trả lại | Không có API hoàn tiền. Trừ nhầm thì dùng `POST /transfer` hoặc lệnh admin để trả lại |

**Ví dụ**

```bash
curl -X POST http://<host>:3000/api/payroll/deduct \
  -H "x-api-key: $PAYROLL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"reference":"phat-2026-10-24-966153253400231988","userId":"966153253400231988","amount":20,"reason":"Vắng họp không báo"}'

curl -X POST http://<host>:3000/api/payroll/topup \
  -H "x-api-key: $PAYROLL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"reference":"nap-2026-10-24-01","userId":"966153253400231988","amount":500,"reason":"Nạp quỹ lương tuần 43"}'
```

**Response `200`**

```json
{
  "type": "DEDUCT",
  "reference": "phat-2026-10-24-966153253400231988",
  "userId": "966153253400231988",
  "amount": 20,
  "reason": "Vắng họp không báo",
  "status": "SUCCESS",
  "duplicate": false
}
```

| Trường | Ý nghĩa |
| --- | --- |
| `type` | `DEDUCT` (trừ coin) hoặc `TOPUP` (nạp coin cho bot) |
| `status` | `SUCCESS` đã chuyển; `FAILED` không chuyển được (xem `error`) |
| `duplicate` | `true` = `reference` này đã được xử lý trước đó; **không có coin mới bị chuyển** |
| `error` | Chỉ có khi `status = FAILED` |

> Cũng như `/transfer`: luôn kiểm tra cả `status` lẫn `duplicate`.

## `GET /adjustments` — lịch sử trừ / nạp

Trả về tối đa 200 bản ghi mới nhất.

| Query | Mặc định | Mô tả |
| --- | --- | --- |
| `type` | tất cả | `DEDUCT` hoặc `TOPUP` |
| `userId` | tất cả | Lọc theo người dùng |

```bash
curl -H "x-api-key: $PAYROLL_API_KEY" \
  "http://<host>:3000/api/payroll/adjustments?type=DEDUCT&userId=966153253400231988"
```

```json
[
  {
    "type": "DEDUCT",
    "reference": "phat-2026-10-24-966153253400231988",
    "userId": "966153253400231988",
    "amount": 20,
    "reason": "Vắng họp không báo",
    "status": "SUCCESS",
    "createdAt": "2026-10-24T08:12:03.000Z",
    "updatedAt": "2026-10-24T08:12:03.250Z"
  }
]
```

## Mã lỗi

Lỗi có dạng `{ "statusCode": 400, "message": "...", "error": "Bad Request" }`.

| HTTP | Khi nào | Nên làm |
| --- | --- | --- |
| `400` | `amount` sai (trả lương: không phải số nguyên 1–100; trừ/nạp: không phải số nguyên dương), ID hoặc `reference` sai định dạng, dùng `@everyone` | Sửa request, không retry |
| `401` | Thiếu hoặc sai `x-api-key` | Kiểm tra key |
| `403` | Người nhận không có role đó (trả lương), hoặc `userId` là tài khoản bot | Bỏ qua người này |
| `404` | Người dùng không ở trong server | Bỏ qua người này |
| `409` | Một request khác đang xử lý cùng người/role hoặc cùng `reference` | Đợi vài giây rồi retry |
| `409` | `reference` đã dùng cho `userId`/`amount` khác (trừ/nạp) | Dùng `reference` mới, không retry |
| `503` | Bot chưa sẵn sàng (đang khởi động) hoặc cấu hình server thiếu | Retry sau |
| `200` + `FAILED` | Trả lương: ví bot không đủ tiền. Trừ/nạp: ví người dùng không đủ tiền. Hoặc lỗi DB | Bổ sung tiền rồi gọi lại y hệt |

## Ví dụ: job trả lương hàng tuần (Node.js 18+)

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
  { userId: '966153253400231988', roleId: '1338020421328437278', amount: 40, description: 'Lương tuần 42' },
]);
```

Gọi tuần tự từng người (không gọi song song cùng một người/role) để tránh `409`. Nên chạy job một lần mỗi tuần (ví dụ tối Chủ nhật hoặc sáng thứ Hai); chạy lại trong cùng tuần chỉ trả cho người còn thiếu.

## Thông báo cho người nhận

Mỗi khoản `SUCCESS` mới (không phải `duplicate`), bot gửi DM cho người dùng:

| API | Embed | Nội dung |
| --- | --- | --- |
| `/transfer` | **"Thông Báo Trả Lương"** | Tên role, kỳ lương (ví dụ *tuần 42/2026 (12/10 – 18/10)*), số tiền, `description` nếu có |
| `/deduct` | **"Thông Báo Trừ Coin"** | Số tiền, `reason` nếu có |
| `/topup` | **"Thông Báo Nạp Coin"** | Số tiền, `reason` nếu có |

Người dùng tắt DM thì không nhận được thông báo nhưng giao dịch vẫn thực hiện. Giao dịch cũng hiện trong lịch sử coin của người dùng.

## Bảo mật

- API key có quyền **trừ coin của bất kỳ thành viên nào**, không giới hạn số tiền. Chỉ cấp cho hệ thống tin cậy.
- Giữ API key ở server/biến môi trường, **không** commit vào code, không gửi trong kênh công khai.
- Key bị lộ: báo quản trị bot đổi key; key cũ hết hiệu lực ngay khi bot restart.
- Chỉ gọi API qua HTTPS nếu đi qua Internet.
