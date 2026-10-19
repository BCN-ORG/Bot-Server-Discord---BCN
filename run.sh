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
    echo "👉 Cloudflare sẽ hiển thị link xác thực bên dưới."
    echo "👉 Copy toàn bộ link đó và mở trên trình duyệt."
    echo "👉 Đăng nhập, chọn tên miền và cấp quyền."
    echo "⏳ Script sẽ chờ bạn xác thực hoàn tất."
    echo "=========================================="
    echo ""

    # Giữ nguyên output để hiển thị link xác thực.
    if ! cloudflared tunnel login; then
        echo ""
        echo "❌ Xác thực Cloudflare thất bại"
        echo "👉 Chạy lại script để lấy link xác thực mới."
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