# Discord Bot - Name Validation System

Bot Discord tu dong kiem tra va xu ly ten thanh vien khong hop le, su dung Firestore lam database.

## Tinh nang chinh

### 1. Kiem tra ten tu dong
- Khi member moi vao hoac doi nickname
- Validate theo dinh dang: Nguyen Minh Vu (2-5 tu, chi chu cai)
- Luu vi pham vao Firestore
- **Log moi thay doi nickname vao channel** (nickname-logs, mod-logs, hoac logs)

### 2. He thong canh bao 48 gio
- Vi pham dau tien: Gui thong bao, bat dau dem 48 gio
- Doi sang ten sai khac: GIU NGUYEN deadline ban dau
- Sua ten dung: Dong vi pham, huy han kick
- Qua 48 gio van sai: Tu dong kick

### 3. Scheduler quet moi 12 gio
- Tim vi pham qua han
- Kiem tra lai nickname hien tai tu Discord
- Van sai thi kick, da dung thi dong vi pham

### 4. Database Firestore
- Luu tru violations voi status: pending, resolved, kicked
- Ghi nho notifiedAt va deadlineAt
- Theo doi lich su vi pham

## Cau truc du an

```
discord-bot/
├── src/
│   ├── index.js                    # Khoi tao bot
│   ├── discord.js                  # Dang ky lenh, xu ly interaction
│   ├── database/
│   │   ├── firebase.js             # Firebase connection
│   │   └── violations.js           # CRUD cho violations
│   ├── services/
│   │   └── nameValidationService.js # Logic validate va xu ly
│   ├── schedulers/
│   │   └── violationChecker.js     # Quet vi pham moi 12 gio
│   ├── events/
│   │   ├── guildMemberAdd.js       # Xu ly member moi vao
│   │   └── guildMemberUpdate.js    # Xu ly doi nickname
│   ├── features/
│   │   └── rename/
│   │       ├── index.js            # Export
│   │       ├── command.js          # Lenh /rename
│   │       ├── modal.js            # Form nhap ten
│   │       └── validate.js         # Validate ten
│   └── constants/
│       └── emojis.js               # Emoji constants
├── .kiro/
│   └── skills/
│       └── coding-standards.md     # Coding rules
├── .env
├── .gitignore
├── package.json
└── README.md
```

## Cai dat

### 1. Clone va install

```bash
npm install
```

### 2. Tao bot tren Discord Developer Portal

1. Truy cap [Discord Developer Portal](https://discord.com/developers/applications)
2. Tao "New Application"
3. Tab **Bot**:
   - Bat **Privileged Gateway Intents**:
     - `PRESENCE INTENT`
     - `SERVER MEMBERS INTENT`
     - `MESSAGE CONTENT INTENT`
4. Tab **OAuth2** > **URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions:
     - `Manage Nicknames`
     - `Send Messages`
     - `Kick Members`
     - `Use Slash Commands`
5. Copy URL va moi bot vao server

### 3. Cau hinh Firebase

Du an da duoc config san voi Firebase project: **ban-cong-nghe**

Neu muon dung Firebase project rieng:
1. Tao project tai [Firebase Console](https://console.firebase.google.com/)
2. Tao Firestore Database
3. Cap nhat thong tin trong `.env`

### 4. Cau hinh .env

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_id
GUILD_ID=your_server_id

# Firebase (da config san, co the giu nguyen)
FIREBASE_API_KEY=...
FIREBASE_PROJECT_ID=ban-cong-nghe
...
```

**Lay thong tin Discord:**
- `DISCORD_TOKEN`: Bot tab > Copy Token
- `CLIENT_ID`: General Information > Application ID
- `GUILD_ID`: Bat Developer Mode > Right click server > Copy Server ID

### 5. Tao kenh trong Discord

Tao cac kenh text:
- `huong-dan` hoac `welcome` - Bot gui thong bao chao mung
- `nickname-logs` hoac `mod-logs` hoac `logs` - Bot gui log khi member doi nickname
- Bot tu dong tim kenh theo thu tu uu tien: nickname-logs > mod-logs > logs

### 6. Firestore Collections

Bot tu dong tao collection `violations` voi schema:

```javascript
{
  guildId: string,
  memberId: string,
  invalidNickname: string,
  notifiedAt: Timestamp,
  deadlineAt: Timestamp,      // notifiedAt + 48 gio
  status: 'pending' | 'resolved' | 'kicked',
  createdAt: Timestamp,
  updatedAt: Timestamp,
  resolvedAt?: Timestamp,     // Khi sua dung
  kickedAt?: Timestamp        // Khi bi kick
}
```

## Chay bot

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

## Workflow hoat dong

### Luong 1: Member moi vao
1. Member join server
2. Bot kiem tra nickname
3. Neu sai:
   - Tao violation trong Firestore
   - Gui DM canh bao (neu khong duoc thi gui vao kenh)
   - Bat dau dem 48 gio
4. Neu dung: Khong lam gi

### Luong 2: Member doi nickname
1. Bot bat su kien `guildMemberUpdate`
2. Kiem tra nickname moi
3. Neu dung:
   - Kiem tra co violation pending khong
   - Neu co: Dong vi pham, gui thong bao chuc mung
4. Neu sai:
   - Kiem tra co violation pending khong
   - Neu chua co: Tao moi, gui canh bao
   - Neu co roi: Chi cap nhat invalidNickname, GIU NGUYEN deadline

### Luong 3: Scheduler (moi 12 gio)
1. Query violations: `status = 'pending' AND deadlineAt <= now`
2. Voi moi violation:
   - Fetch member tu Discord
   - Kiem tra lai nickname hien tai
   - Neu da dung: Dong vi pham
   - Neu van sai: Kick member, danh dau kicked

### Luong 4: Member tu sua ten
1. Member dung `/rename` hoac bam nut "Nhap ho va ten"
2. Nhap ten vao modal
3. Bot validate
4. Neu hop le:
   - Doi nickname
   - Dong vi pham neu co
   - Thong bao thanh cong
5. Neu khong hop le:
   - Thong bao loi chi tiet
   - Member thu lai

## Validation Rules

**Hop le:**
- Nguyen Minh Vu (2-5 tu, co dau)
- Tran Thi Lan Anh (4 tu)
- Le Van A (khong dau)
- Do Xuan Long

**Khong hop le:**
- Vu (chi 1 tu)
- Nguyen123 (co so)
- Vu 😊 (co emoji)
- Nguyen_Minh_Vu (ky tu dac biet)
- Nguyen Thi Minh Thu Trang Ha (qua 5 tu)

## Diem can luu y

### 1. Deadline khong reset
- Khi member doi sang ten sai khac, deadline GIU NGUYEN
- Chi reset khi sua dung ten (dong vi pham) roi vi pham lai

### 2. Kiem tra thuc te truoc khi kick
- Scheduler lay nickname hien tai tu Discord
- Neu da sua dung thi khong kick (dong vi pham)
- Chi kick khi xac nhan van sai

### 3. Quet moi 12 gio
- Kick thuc te sau khoang 48-60 gio
- Khong chinh xac den giay

### 4. Khong gui duoc DM
- Thu gui vao kenh huong dan
- Bao quan tri vien neu can

### 5. Permissions
- Bot can role cao hon member de kick
- Bot khong kick duoc chu server
- Bot khong doi duoc ten chu server

## Commands

### /rename
Bat modal nhap ten bat cu luc nao

### Button "Nhap ho va ten"
Mo modal tu thong bao welcome hoac canh bao

### Button "De sau"
Giu nguyen deadline, chi dong thong bao

## Logging

Bot log ra console:
- `[SUCCESS]` - Thanh cong
- `[ERROR]` - Loi
- `[WARN]` - Canh bao
- `[INFO]` - Thong tin
- `[SCHEDULER]` - Tu scheduler

### Nickname Change Logs (trong Discord channel)

Bot tu dong gui log embed vao channel khi phat hien member doi nickname:

**Kenh log (thu tu uu tien):**
1. `nickname-logs` (uu tien)
2. `mod-logs`
3. `logs`

**Thong tin trong log:**
- Ten cu va ten moi
- Trang thai: Hop le (mau xanh) hoac Khong hop le (mau do)
- Thong tin member (username, ID)
- Thoi gian thay doi
- Avatar member

**Mau embed:**
- Xanh (#00ff00): Ten hop le
- Do (#ff0000): Ten khong hop le (se bi canh bao)

## Troubleshooting

### Bot khong gui duoc DM
- User tat DM
- Bot se thu gui vao kenh huong dan

### Bot khong kick duoc
- Kiem tra permissions: `Kick Members`
- Kiem tra role bot cao hon member

### Firebase loi connection
- Kiem tra `.env` co dung config
- Kiem tra Firestore da bat chua

### Scheduler khong chay
- Kiem tra bot van online
- Log se hien `[SCHEDULER] Running violation checker...`

## License

ISC
# Bot-Server-Discord---BCN
