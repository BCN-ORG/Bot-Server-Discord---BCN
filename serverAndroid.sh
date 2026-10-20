#!/bin/bash

# Dừng lại ngay nếu có lệnh nào bị lỗi
set -e

echo "=== [1/6] Cập nhật hệ thống và cài đặt Termux API ==="
pkg update && pkg upgrade -y
pkg install termux-api nodejs -y

echo "=== [2/6] Tạo thư mục dự án 'termux-monitor' và 'AndroidServer' ==="
mkdir -p termux-monitor/AndroidServer
cd termux-monitor/AndroidServer

echo "=== [3/6] Khởi tạo package.json ==="
npm init -y

echo "=== [4/6] Cài đặt thư viện Express ==="
npm install express

echo "=== [5/6] Tạo file server.js tự động ==="
cat << 'EOF' > server.js
const express = require('express');
const { exec } = require('child_process');
const app = express();
const PORT = 3000;

// Hàm hỗ trợ chạy lệnh shell và trả về Promise
const runCommand = (command) => {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                resolve(null); // Trả về null nếu lệnh lỗi thay vì crash app
            } else {
                resolve(stdout.trim());
            }
        });
    });
};

app.get('/stats', async (req, res) => {
    try {
        // 1. Đọc thông tin Pin (Yêu cầu cài termux-api và app Termux:API)
        let batteryInfo = null;
        const batteryRaw = await runCommand('termux-battery-status');
        if (batteryRaw) {
            try {
                batteryInfo = JSON.parse(batteryRaw);
            } catch (e) {
                batteryInfo = batteryRaw;
            }
        }

        // 2. Đọc thông tin RAM sử dụng (dùng lệnh free của Linux)
        const memRaw = await runCommand('free -m');
        let ramInfo = memRaw;

        // 3. Đọc thông tin CPU (dùng lệnh top hoặc uptime/cat proc)
        const cpuRaw = await runCommand("top -n 1 -b | grep 'CPU:'");
        const cpuInfo = cpuRaw || await runCommand("cat /proc/stat | head -n 1");

        // 4. Đọc nhiệt độ thiết bị (Thường nằm trong /sys/class/thermal/)
        // Lưu ý: Đường dẫn nhiệt độ có thể khác nhau tùy dòng điện thoại Android
        const tempRaw = await runCommand('cat /sys/class/thermal/thermal_zone*/temp 2>/dev/null');
        let temperatures = [];
        if (tempRaw) {
            temperatures = tempRaw.split('\n').map(t => {
                let val = parseFloat(t);
                return !isNaN(val) ? (val > 1000 ? val / 1000 : val) : null; // Chuyển đổi sang độ C nếu cần
            }).filter(t => t !== null);
        }

        // Tổng hợp kết quả trả về dưới dạng JSON
        res.json({
            status: 'success',
            timestamp: new Date(),
            hardware: {
                battery: batteryInfo,
                ram: ramInfo,
                cpu_load: cpuInfo,
                temperatures_celsius: temperatures
            }
        });

    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
    console.log(`Hoặc truy cập qua IP mạng nội bộ của điện thoại.`);
});
EOF

echo "=== [6/6] Hoàn tất! ==="
echo "Bạn có thể khởi động server ngay bằng lệnh:"
echo "  node server.js"