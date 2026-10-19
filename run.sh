#!/usr/bin/env bash

set -e
set -o pipefail

# ==========================================
# KIỂM TRA / CÀI CLOUDFLARED
# ==========================================

echo ""
echo "🔎 Kiểm tra cloudflared..."

if ! command -v cloudflared >/dev/null 2>&1; then
    echo "⚠️ Chưa cài cloudflared"

    if ! command -v brew >/dev/null 2>&1; then
        echo "❌ Không tìm thấy Homebrew"
        echo "👉 Cài Homebrew tại https://brew.sh rồi chạy lại script."
        exit 1
    fi

    echo "📦 Đang cài cloudflared..."
    brew install cloudflared
fi

echo "✅ $(cloudflared --version)"

# ==========================================
# KIỂM TRA NODE / NPM / NC
# ==========================================

for dependency in node npm nc; do
    if ! command -v "$dependency" >/dev/null 2>&1; then
        echo "❌ Không tìm thấy $dependency"
        exit 1
    fi
done

# ==========================================
# LOAD .ENV
# ==========================================

if [ ! -f ".env" ]; then
    echo "❌ Không tìm thấy file .env"
    exit 1
fi

set -a
source .env
set +a

if [ -z "${PORT:-}" ]; then
    echo "❌ Thiếu PORT trong .env"
    exit 1
fi

if ! [[ "$PORT" =~ ^[0-9]{1,5}$ ]]; then
    echo "❌ PORT phải là số nguyên từ 1 đến 65535"
    exit 1
fi

PORT=$((10#$PORT))

if (( PORT < 1 || PORT > 65535 )); then
    echo "❌ PORT phải nằm trong khoảng 1–65535"
    exit 1
fi

export PORT

if [ -z "${CF_TUNNEL_NAME:-}" ]; then
    echo "❌ Thiếu CF_TUNNEL_NAME trong .env"
    exit 1
fi

if ! [[ "$CF_TUNNEL_NAME" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    echo "❌ CF_TUNNEL_NAME chỉ được chứa chữ, số, dấu - và _"
    exit 1
fi

if [ -z "${CF_HOSTNAME:-}" ]; then
    echo "❌ Thiếu CF_HOSTNAME trong .env"
    exit 1
fi

if ! [[ "$CF_HOSTNAME" =~ ^[a-zA-Z0-9.-]+$ ]]; then
    echo "❌ CF_HOSTNAME phải là hostname, không kèm https:// hoặc đường dẫn"
    exit 1
fi

if [ ! -f "src/index.js" ]; then
    echo "❌ Không tìm thấy src/index.js"
    echo "👉 Hãy chạy script tại thư mục gốc của dự án."
    exit 1
fi

echo ""
echo "=========================================="
echo " Discord Bot + Cloudflare Tunnel"
echo "=========================================="
echo "Port     : $PORT"
echo "Tunnel   : $CF_TUNNEL_NAME"
echo "Hostname : $CF_HOSTNAME"
echo "=========================================="
echo ""

# ==========================================
# CLOUDFLARE LOGIN
# ==========================================

CF_DIR="$HOME/.cloudflared"
CERT_FILE="$CF_DIR/cert.pem"

mkdir -p "$CF_DIR"

if [ ! -f "$CERT_FILE" ]; then
    echo "🔐 Chưa đăng nhập Cloudflare"
    echo "🌐 Hãy mở liên kết được hiển thị để đăng nhập..."

    cloudflared tunnel login

    if [ ! -f "$CERT_FILE" ]; then
        echo "❌ Đăng nhập chưa hoàn tất: không tìm thấy cert.pem"
        exit 1
    fi
else
    echo "✅ Đã có chứng chỉ đăng nhập Cloudflare"
fi

# ==========================================
# TÌM TUNNEL
# ==========================================

find_tunnel_id() {
    local tunnel_list

    tunnel_list=$(cloudflared tunnel list)

    awk -v name="$CF_TUNNEL_NAME" \
        '$2 == name {print $1; exit}' <<< "$tunnel_list"
}

echo ""
echo "🔎 Kiểm tra tunnel: $CF_TUNNEL_NAME"

TUNNEL_ID=$(find_tunnel_id)

# ==========================================
# TẠO TUNNEL NẾU CHƯA CÓ
# ==========================================

if [ -z "$TUNNEL_ID" ]; then
    echo "➕ Tunnel chưa tồn tại"
    echo "Đang tạo tunnel..."

    cloudflared tunnel create "$CF_TUNNEL_NAME"

    TUNNEL_ID=$(find_tunnel_id)
else
    echo "✅ Tunnel đã tồn tại"
fi

if [ -z "$TUNNEL_ID" ]; then
    echo "❌ Không lấy được Tunnel ID"
    exit 1
fi

echo "🆔 Tunnel ID: $TUNNEL_ID"

# ==========================================
# KIỂM TRA CREDENTIALS
# ==========================================

CREDENTIALS_FILE="$CF_DIR/$TUNNEL_ID.json"

if [ ! -f "$CREDENTIALS_FILE" ]; then
    echo "❌ Không tìm thấy credentials:"
    echo "$CREDENTIALS_FILE"
    echo "👉 Nếu tunnel được tạo trên máy khác, hãy chép file credentials về máy này."
    exit 1
fi

# ==========================================
# TẠO CONFIG
# ==========================================

CONFIG_FILE="$CF_DIR/$CF_TUNNEL_NAME.yml"

echo ""
echo "📝 Tạo/update tunnel config..."

cat > "$CONFIG_FILE" <<CONFIGEOF
tunnel: "$TUNNEL_ID"
credentials-file: "$CREDENTIALS_FILE"

ingress:
  - hostname: "$CF_HOSTNAME"
    service: "http://127.0.0.1:$PORT"

  - service: http_status:404
CONFIGEOF

chmod 600 "$CONFIG_FILE"

echo "✅ Config: $CONFIG_FILE"

# ==========================================
# DNS ROUTE
# ==========================================

echo ""
echo "🌐 Cấu hình DNS..."

cloudflared tunnel route dns \
    "$TUNNEL_ID" \
    "$CF_HOSTNAME"

# ==========================================
# CÀI DEPENDENCIES
# ==========================================

echo ""
echo "📦 npm install..."

npm install

# ==========================================
# KIỂM TRA PORT
# ==========================================

if nc -z 127.0.0.1 "$PORT" >/dev/null 2>&1; then
    echo "❌ Port $PORT đang được sử dụng"
    echo "👉 Dừng tiến trình đang dùng port hoặc đổi PORT trong .env."
    exit 1
fi

# ==========================================
# CLEANUP
# ==========================================

SERVER_PID=""
TUNNEL_PID=""

cleanup() {
    local exit_code=$?

    trap - EXIT INT TERM

    echo ""
    echo "🛑 Đang dừng hệ thống..."

    if [ -n "$TUNNEL_PID" ]; then
        kill "$TUNNEL_PID" 2>/dev/null || true
        wait "$TUNNEL_PID" 2>/dev/null || true
    fi

    if [ -n "$SERVER_PID" ]; then
        kill "$SERVER_PID" 2>/dev/null || true
        wait "$SERVER_PID" 2>/dev/null || true
    fi

    exit "$exit_code"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# ==========================================
# KHỞI ĐỘNG NODE
# ==========================================

echo ""
echo "🚀 Khởi động Node.js..."

node ./src/index.js &
SERVER_PID=$!

echo "Node PID: $SERVER_PID"

# ==========================================
# CHỜ SERVER — TỐI ĐA 60 GIÂY
# ==========================================

echo ""
echo "⏳ Chờ localhost:$PORT..."

WAIT_SECONDS=0
MAX_WAIT_SECONDS=60

while ! nc -z 127.0.0.1 "$PORT" >/dev/null 2>&1; do
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
        echo "❌ Node.js server đã dừng"
        exit 1
    fi

    if [ "$WAIT_SECONDS" -ge "$MAX_WAIT_SECONDS" ]; then
        echo "❌ Server chưa mở port $PORT sau $MAX_WAIT_SECONDS giây"
        exit 1
    fi

    sleep 1
    WAIT_SECONDS=$((WAIT_SECONDS + 1))
done

echo ""
echo "✅ Node.js server ready"
echo "🏠 http://localhost:$PORT"

# ==========================================
# KHỞI ĐỘNG CLOUDFLARE TUNNEL
# ==========================================

echo ""
echo "☁️ Khởi động Cloudflare Tunnel"
echo "🌍 https://$CF_HOSTNAME"
echo "🆔 $TUNNEL_ID"
echo ""

cloudflared tunnel \
    --config "$CONFIG_FILE" \
    run "$TUNNEL_ID" &

TUNNEL_PID=$!

# ==========================================
# GIÁM SÁT NODE VÀ TUNNEL
# ==========================================

while true; do
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
        echo "❌ Node.js server đã dừng"
        exit 1
    fi

    if ! kill -0 "$TUNNEL_PID" 2>/dev/null; then
        echo "❌ Cloudflare Tunnel đã dừng"
        exit 1
    fi

    sleep 1
done