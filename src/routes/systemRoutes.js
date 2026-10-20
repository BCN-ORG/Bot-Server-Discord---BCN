import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir, readFile } from 'node:fs/promises';
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

const runCommand = async (command, args) => {
  try {
    const { stdout } = await execFileAsync(command, args, {
      timeout: 5000,
      maxBuffer: 1024 * 1024
    });
    return { output: stdout.trim(), error: null };
  } catch (error) {
    return {
      output: null,
      error: error.code === 'ENOENT' ? 'command_not_installed' : 'command_failed'
    };
  }
};

const readTextFile = async (path) => {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
};

const getTemperatures = async () => {
  try {
    const zones = await readdir('/sys/class/thermal');
    const readings = await Promise.all(
      zones
        .filter(zone => /^thermal_zone\d+$/.test(zone))
        .map(async (zone) => {
          const raw = await readTextFile(`/sys/class/thermal/${zone}/temp`);
          const value = Number.parseFloat(raw);
          if (!Number.isFinite(value)) return null;
          return value > 1000 ? value / 1000 : value;
        })
    );
    return readings.filter(value => value !== null);
  } catch {
    return [];
  }
};

const parseBattery = (raw) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

router.get('/system', async (req, res) => {
  if (!isAndroidOrTermux()) {
    return res.status(501).json({
      status: 'unsupported',
      message: 'System statistics are available only on Android or Termux.'
    });
  }

  try {
    const [batteryResult, memoryResult, cpuResult, procStat, temperatures] = await Promise.all([
      runCommand('termux-battery-status', []),
      runCommand('free', ['-m']),
      runCommand('top', ['-n', '1', '-b']),
      readTextFile('/proc/stat'),
      getTemperatures()
    ]);

    let ramInfo = memoryResult.output;
    if (!ramInfo) {
      ramInfo = await readTextFile('/proc/meminfo');
    }

    const unavailable = [];
    if (batteryResult.error) unavailable.push(`battery:${batteryResult.error}`);
    if (!memoryResult.output && !ramInfo) unavailable.push('ram:unavailable');
    if (!cpuResult.output && !procStat) unavailable.push('cpu_load:unavailable');

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      hardware: {
        battery: parseBattery(batteryResult.output),
        ram: ramInfo,
        cpu_load: cpuResult.output || procStat?.split('\n')[0] || null,
        temperatures_celsius: temperatures
      },
      unavailable
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Unable to collect system statistics.'
    });
  }
});

export default router;
