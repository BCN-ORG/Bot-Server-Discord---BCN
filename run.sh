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

    # Kiểm tra Homebrew đã cài nhưng chưa có trong PATH.
    if ! command -v brew >/dev/null 2>&1; then
        for brew_path in \
            /opt/homebrew/bin/brew \
            /usr/local/bin/brew \
            /home/linuxbrew/.linuxbrew/bin/brew
        do
            if [ -x "$brew_path" ]; then
                eval "$("$brew_path" shellenv)"
                break
            fi
        done
    fi

    # Cài Homebrew nếu chưa có.
    if ! command -v brew >/dev/null 2>&1; then
        echo "⚠️ Chưa cài Homebrew"
        echo "📦 Đang tải trình cài đặt Homebrew..."
        echo "👉 Có thể cần nhập mật khẩu máy và nhấn Enter."

        if ! command -v curl >/dev/null 2>&1; then
            echo "❌ Không tìm thấy curl"
            exit 1
        fi

        BREW_INSTALLER=$(mktemp)

        if ! curl -fsSL \
            https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh \
            -o "$BREW_INSTALLER"
        then
            rm -f "$BREW_INSTALLER"
            echo "❌ Không tải được trình cài Homebrew"
            exit 1
        fi

        if ! /bin/bash "$BREW_INSTALLER"; then
            rm -f "$BREW_INSTALLER"
            echo "❌ Cài Homebrew thất bại"
            exit 1
        fi

        rm -f "$BREW_INSTALLER"

        for brew_path in \
            /opt/homebrew/bin/brew \
            /usr/local/bin/brew \
            /home/linuxbrew/.linuxbrew/bin/brew
        do
            if [ -x "$brew_path" ]; then
                eval "$("$brew_path" shellenv)"
                break
            fi
        done
    fi

    if ! command -v brew >/dev/null 2>&1; then
        echo "❌ Không tìm thấy Homebrew sau khi cài"
        echo "👉 Làm theo phần Next steps của Homebrew rồi chạy lại."
        exit 1
    fi

    echo "📦 Đang cài cloudflared..."
    brew install cloudflared
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
    echo "=========================================="
    echo "👉 Link xác thực sẽ xuất hiện bên dưới."
    echo "👉 Copy toàn bộ link và mở trên trình duyệt."
    echo "👉 Đăng nhập, chọn tên miền và cấp quyền."
    echo "⏳ Script chờ bạn xác thực hoàn tất."
    echo "=========================================="
    echo ""

    # Hiển thị trực tiếp output có chứa link xác thực.
    if ! cloudflared tunnel login; then
        echo ""
        echo "❌ Xác thực Cloudflare thất bại"
        echo "👉 Chạy lại script để lấy link mới."
        exit 1
    fi

    if [ ! -f "$CERT_FILE" ]; then
        echo ""
        echo "❌ Không tìm thấy cert.pem sau khi xác thực"
        echo "👉 Chạy lại script và hoàn tất bước cấp quyền."
        exit 1
    fi

    echo ""
    echo "✅ Xác thực Cloudflare thành công"
else
    echo "✅ Cloudflare đã có chứng chỉ đăng nhập"
fi

# ==========================================
# CHECK EXISTING TUNNEL
# ==========================================

echo ""
echo "🔎 Kiểm tra tunnel: $CF_TUNNEL_NAME"

# Tách bước lấy danh sách để lỗi Cloudflare không bị
# che bởi exit code của awk.
TUNNEL_LIST=$(cloudflared tunnel list)

TUNNEL_ID=$(
    awk -v name="$CF_TUNNEL_NAME" \
        '$2 == name {print $1; exit}' <<< "$TUNNEL_LIST"
)

# ==========================================
# CREATE TUNNEL IF NOT EXISTS
# ==========================================

if [ -z "$TUNNEL_ID" ]; then
    echo "➕ Tunnel chưa tồn tại"
    echo "Đang tạo tunnel..."

    cloudflared tunnel create "$CF_TUNNEL_NAME"

    TUNNEL_LIST=$(cloudflared tunnel list)

    TUNNEL_ID=$(
        awk -v name="$CF_TUNNEL_NAME" \
            '$2 == name {print $1; exit}' <<< "$TUNNEL_LIST"
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
    echo "👉 Nếu tạo tunnel trên máy khác, chép file credentials về máy này."
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

chmod 600 "$CONFIG_FILE"

echo "✅ Config: $CONFIG_FILE"

# ==========================================
# DNS ROUTE
# ==========================================

echo ""
echo "🌐 Cấu hình DNS..."

if ! cloudflared tunnel route dns \
    "$CF_TUNNEL_NAME" \
    "$CF_HOSTNAME"
then
    echo "⚠️ Không tạo được DNS route."
    echo "👉 Kiểm tra bản ghi $CF_HOSTNAME có trỏ đúng tunnel hay chưa."
    echo "👉 Script tiếp tục chạy theo luồng hiện tại."
fi

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
    local exit_code=$?

    trap - EXIT INT TERM

    echo ""
    echo "🛑 Đang dừng hệ thống..."

    if [ -n "${SERVER_PID:-}" ]; then
        kill "$SERVER_PID" 2>/dev/null || true
    fi

    exit "$exit_code"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

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