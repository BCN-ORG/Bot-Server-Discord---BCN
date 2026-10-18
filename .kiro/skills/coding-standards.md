# Discord Bot Coding Standards

## Code Style Rules

### 1. Không sử dụng icon/emoji trong source code

**Quy tắc:** Không được sử dụng emoji, icon hoặc ký tự đặc biệt Unicode trong source code JavaScript/TypeScript.

**Lý do:**
- Giảm vấn đề encoding giữa các editor
- Tránh lỗi hiển thị trên các hệ điều hành khác nhau
- Dễ dàng search và maintain code
- Tránh conflict khi merge code

**Không được làm:**
```javascript
// SAI - Có emoji trong code
const button = new ButtonBuilder()
  .setLabel('📝 Nhập họ và tên')  // [X] Emoji trong code
  .setStyle(ButtonStyle.Primary);

console.log('✅ Bot đã đăng nhập');  // [X] Emoji trong log
```

**Phải làm:**
```javascript
// ĐÚNG - Dùng text thuần
const button = new ButtonBuilder()
  .setLabel('Nhập họ và tên')  // [OK] Text thuần
  .setStyle(ButtonStyle.Primary);

console.log('[SUCCESS] Bot đã đăng nhập');  // [OK] Text thuần với prefix
```

**Ngoại lệ:**
- Emoji trong string literals dùng để **hiển thị cho user** (Discord messages) là được phép
- Phải tách riêng vào constants file

**Cách đúng để dùng emoji cho Discord messages:**

```javascript
// constants/emojis.js
export const EMOJIS = {
  SUCCESS: '✅',
  ERROR: '❌',
  INFO: '📋',
  PENCIL: '📝',
  WAVE: '👋'
};

// command.js
import { EMOJIS } from '../constants/emojis.js';

await interaction.reply({
  content: `${EMOJIS.WAVE} Chào mừng bạn!`,
  ephemeral: true
});
```

### 2. Code Documentation

- Mỗi function phải có JSDoc comment
- Giải thích rõ params và return type
- Comment bằng tiếng Việt cho dễ hiểu

**Ví dụ:**
```javascript
/**
 * Kiểm tra và chuẩn hóa họ tên
 * @param {string} name - Họ tên cần kiểm tra
 * @returns {Object} { valid: boolean, error?: string, normalized?: string }
 */
export function validateName(name) {
  // ...
}
```

### 3. File Organization

- Mỗi feature nằm trong folder riêng `src/features/`
- Tách logic validation, command, modal ra files riêng
- Export tập trung qua `index.js`

**Cấu trúc:**
```
src/
├── features/
│   └── feature-name/
│       ├── index.js      # Export tập trung
│       ├── command.js    # Command logic
│       ├── handler.js    # Business logic
│       └── validate.js   # Validation
├── events/               # Discord events
├── constants/            # Constants, configs
└── utils/               # Helper functions
```

### 4. Error Handling

- Luôn có try-catch cho async operations
- Log error ra console với context rõ ràng
- Thông báo lỗi cho user phải thân thiện

**Ví dụ:**
```javascript
try {
  await interaction.member.setNickname(newName);
} catch (error) {
  console.error('[ERROR] Không thể đổi nickname:', error);
  
  if (error.code === 50013) {
    await interaction.reply({
      content: 'Bot không có quyền đổi tên cho bạn!',
      ephemeral: true
    });
  }
}
```

### 5. Naming Conventions

- **Files:** kebab-case (`guild-member-add.js`)
- **Functions:** camelCase (`handleModalSubmit`)
- **Constants:** UPPER_SNAKE_CASE (`DISCORD_TOKEN`)
- **Classes:** PascalCase (`ButtonBuilder`)

### 6. Environment Variables

- Không hardcode tokens, IDs
- Sử dụng `.env` file
- Validate biến môi trường khi khởi động

```javascript
const { DISCORD_TOKEN, CLIENT_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('[ERROR] Thiếu biến môi trường!');
  process.exit(1);
}
```

### 7. User Messages

- Messages gửi cho user có thể dùng emoji (qua constants)
- Ephemeral messages cho thông báo cá nhân
- Dùng embed cho thông báo quan trọng

```javascript
// Được phép - emoji trong message gửi cho user
await interaction.reply({
  content: `${EMOJIS.SUCCESS} Đã đặt tên thành công!`,
  ephemeral: true
});
```

### 8. Performance

- Không fetch dữ liệu không cần thiết
- Cache roles, channels khi có thể
- Sử dụng `.find()` thay vì `.filter()[0]`

### 9. Code Quality

- Mỗi function chỉ làm một việc
- Tránh nested callbacks quá sâu
- Sử dụng async/await thay vì .then()
- Extract magic numbers/strings thành constants

### 10. Dependencies

- Chỉ import những gì cần dùng
- Không install packages không cần thiết
- Kiểm tra compatibility với Discord.js version

---

## Checklist trước khi commit

- [ ] Đã xóa tất cả emoji trong source code (trừ message strings)
- [ ] Đã thêm JSDoc cho functions mới
- [ ] Đã test error cases
- [ ] Đã validate environment variables
- [ ] File naming đúng convention
- [ ] Không có console.log debug còn sót lại
- [ ] Code đã được format đúng

---

**Lưu ý:** Skill này sẽ được Kiro IDE tự động áp dụng khi làm việc với code trong dự án này.
