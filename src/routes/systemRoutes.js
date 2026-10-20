import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import express from 'express';

const router = express.Router();
const execFileAsync = promisify(execFile);

const isAndroidOrTermux = () => (
  process.platform === 'android'
  || Boolean(
    process.env.ANDROID_ROOT
    || process.env.ANDROID_DATA
    || process.env.TERMUX_VERSION
    || process.env.PREFIX?.includes('/com.termux/')
  )
  || existsSync('/system/build.prop')
  || existsSync('/system/bin')
);

const getRAMInfo = async () => {
  try {
    const { stdout } = await execFileAsync('free', ['-m'], {
      timeout: 5000,
      maxBuffer: 1024 * 1024
    });
    const lines = stdout.trim().split('\n');
    const memoryLine = lines.find(line => /^\s*Mem:/i.test(line)) || lines[1];
    if (!memoryLine) return null;

    const values = memoryLine.trim().split(/\s+/);
    const [total, used, free] = (values[0].toLowerCase() === 'mem:' ? values.slice(1, 4) : values.slice(0, 3))
      .map(Number);
    if (![total, used, free].every(Number.isFinite) || total <= 0) return null;

    return {
      total,
      used,
      free,
      usagePercentage: `${((used / total) * 100).toFixed(1)}%`
    };
  } catch {
    return null;
  }
};

const getBatteryInfo = async () => {
  try {
    const { stdout } = await execFileAsync('termux-battery-status', [], {
      timeout: 5000,
      maxBuffer: 1024 * 1024
    });
    return JSON.parse(stdout);
  } catch {
    return null;
  }
};

router.get('/system', async (req, res) => {
  if (!isAndroidOrTermux()) {
    return res.status(501).json({
      success: false,
      error: 'System statistics are available only on Android or Termux.'
    });
  }

  try {
    const [ram, batteryInfo] = await Promise.all([getRAMInfo(), getBatteryInfo()]);
    const battery = batteryInfo ? {
      percentage: batteryInfo.percentage,
      status: batteryInfo.status,
      plugged: batteryInfo.plugged,
      health: batteryInfo.health
    } : null;

    res.json({
      success: true,
      device: {
        temperature: batteryInfo?.temperature != null
          ? `${batteryInfo.temperature}°C (Battery)`
          : 'Không xác định',
        ram,
        battery
      }
    });
  } catch {
    res.status(500).json({
      success: false,
      error: 'Lỗi đọc phần cứng'
    });
  }
});

export default router;
