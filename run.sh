#!/usr/bin/env bash

set -e

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

if [ -z "$PORT" ]; then
    echo "❌ Thiếu PORT trong .env"
    exit 1
fi

if [ -z "$CF_TUNNEL_NAME" ]; then
    echo "❌ Thiếu CF_TUNNEL_NAME trong .env"
    exit 1
fi

if [ -z "$CF_HOSTNAME" ]; then
    echo "❌ Thiếu CF_HOSTNAME trong .env"
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
# CHECK CLOUDFLARED
# ==========================================

if ! command -v cloudflared >/dev/null 2>&1; then
    echo "⚠️ Chưa cài cloudflared"

    if command -v brew >/dev/null 2>&1; then
        echo "📦 Đang cài cloudflared..."
        brew install cloudflared
    else
        echo "❌ Không tìm thấy Homebrew"
        exit 1
    fi
fi

echo "✅ cloudflared OK"

# ==========================================
# CLOUDFLARE LOGIN
# ==========================================

CF_DIR="$HOME/.cloudflared"
CERT_FILE="$CF_DIR/cert.pem"

mkdir -p "$CF_DIR"

if [ ! -f "$CERT_FILE" ]; then
    echo ""
    echo "🔐 Chưa đăng nhập Cloudflare"
    echo "🌐 Đang mở trình duyệt..."
    cloudflared tunnel login
else
    echo "✅ Cloudflare đã đăng nhập"
fi

# ==========================================
# CHECK EXISTING TUNNEL
# ==========================================

echo ""
echo "🔎 Kiểm tra tunnel: $CF_TUNNEL_NAME"

TUNNEL_ID=$(
    cloudflared tunnel list \
    | awk -v name="$CF_TUNNEL_NAME" '$2 == name {print $1; exit}'
)

# ==========================================
# CREATE TUNNEL IF NOT EXISTS
# ==========================================

if [ -z "$TUNNEL_ID" ]; then

    echo "➕ Tunnel chưa tồn tại"
    echo "Đang tạo tunnel..."

    cloudflared tunnel create "$CF_TUNNEL_NAME"

    TUNNEL_ID=$(
        cloudflared tunnel list \
        | awk -v name="$CF_TUNNEL_NAME" '$2 == name {print $1; exit}'
    )

else
    echo "✅ Tunnel đã tồn tại"
fi

if [ -z "$TUNNEL_ID" ]; then
    echo "❌ Không lấy được Tunnel ID"
    exit 1
fi

echo "🆔 Tunnel ID: $TUNNEL_ID"

# ==========================================
# CREDENTIALS
# ==========================================

CREDENTIALS_FILE="$CF_DIR/$TUNNEL_ID.json"

if [ ! -f "$CREDENTIALS_FILE" ]; then
    echo "❌ Không tìm thấy credentials:"
    echo "$CREDENTIALS_FILE"
    exit 1
fi

# ==========================================
# CREATE CONFIG
# ==========================================

CONFIG_FILE="$CF_DIR/$CF_TUNNEL_NAME.yml"

echo ""
echo "📝 Tạo/update tunnel config..."

cat > "$CONFIG_FILE" <<CONFIGEOF
tunnel: $TUNNEL_ID
credentials-file: $CREDENTIALS_FILE

ingress:
  - hostname: $CF_HOSTNAME
    service: http://localhost:$PORT

  - service: http_status:404
CONFIGEOF

echo "✅ Config: $CONFIG_FILE"

# ==========================================
# DNS ROUTE
# ==========================================

echo ""
echo "🌐 Cấu hình DNS..."

cloudflared tunnel route dns \
    "$CF_TUNNEL_NAME" \
    "$CF_HOSTNAME" || true

# ==========================================
# NPM INSTALL
# ==========================================

echo ""
echo "📦 npm install..."
npm install

# ==========================================
# START NODE
# ==========================================

echo ""
echo "🚀 Khởi động Node.js..."

node ./src/index.js &
SERVER_PID=$!

echo "Node PID: $SERVER_PID"

# ==========================================
# CLEANUP
# ==========================================

cleanup() {
    echo ""
    echo "🛑 Đang dừng hệ thống..."

    if [ -n "$SERVER_PID" ]; then
        kill "$SERVER_PID" 2>/dev/null || true
    fi
}

trap cleanup EXIT INT TERM

# ==========================================
# WAIT SERVER
# ==========================================

echo ""
echo "⏳ Chờ localhost:$PORT..."

while ! nc -z 127.0.0.1 "$PORT"; do

    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
        echo "❌ Node.js server đã crash"
        exit 1
    fi

    sleep 1
done

echo ""
echo "✅ Node.js server ready"
echo "🏠 http://localhost:$PORT"

# ==========================================
# RUN CLOUDFLARE TUNNEL
# ==========================================

echo ""
echo "☁️ Khởi động Cloudflare Tunnel"
echo "🌍 https://$CF_HOSTNAME"
echo "🆔 $TUNNEL_ID"
echo ""

cloudflared tunnel \
    --config "$CONFIG_FILE" \
    run "$CF_TUNNEL_NAME"

