import { EmbedBuilder } from 'discord.js';
import { getDatabase } from '../../database/mongodb.js';

const BATTERY_ALERT_COLLECTION = 'battery_alert_configs';

const batteryStatusLabels = {
  CHARGING: 'Đang sạc',
  DISCHARGING: 'Đang dùng pin',
  FULL: 'Đã sạc đầy',
  NOT_CHARGING: 'Không sạc'
};

export async function getBatteryInfo() {
  const port = process.env.PORT || 3000;
  const response = await fetch(`http://127.0.0.1:${port}/api/system`, {
    signal: AbortSignal.timeout(10000)
  });

  if (response.status === 501) {
    return { unsupportedPlatform: true };
  }

  if (!response.ok) {
    throw new Error(`System API returned HTTP ${response.status}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'System API request failed');
  }

  return {
    battery: result.device?.battery,
    temperature: result.device?.temperature
  };
}

export function createBatteryEmbed({ battery, temperature }) {
  const percentage = Number.isFinite(battery.percentage)
    ? `${battery.percentage}%`
    : 'Không xác định';
  const status = batteryStatusLabels[battery.status] || battery.status || 'Không xác định';
  const plugged = battery.plugged
    ? battery.plugged.replaceAll('_', ' ').toLowerCase()
    : 'Không xác định';
  const health = battery.health || 'Không xác định';
  const batteryTemperature = temperature && temperature !== 'Không xác định'
    ? temperature
    : 'Không xác định';

  return new EmbedBuilder()
    .setColor(Number.isFinite(battery.percentage) && battery.percentage <= 30 ? '#ff0000' : '#2ecc71')
    .setTitle('🔋 Tình trạng pin của bot')
    .addFields(
      { name: 'Dung lượng', value: percentage, inline: true },
      { name: 'Trạng thái', value: status, inline: true },
      { name: 'Nguồn điện', value: plugged, inline: true },
      { name: 'Sức khỏe pin', value: health, inline: true },
      { name: 'Nhiệt độ', value: batteryTemperature, inline: true }
    )
    .setFooter({ text: 'Dữ liệu từ Android/Termux' })
    .setTimestamp();
}

export async function getBatteryAlertRoleIds(guildId) {
  const config = await getDatabase()
    .collection(BATTERY_ALERT_COLLECTION)
    .findOne({ _id: guildId }, { projection: { roleIds: 1 } });

  if (!config) return [];
  if (!Array.isArray(config.roleIds)) {
    throw new Error(`Invalid battery alert role configuration for guild ${guildId}`);
  }

  return config.roleIds;
}

export async function addBatteryAlertRole(guildId, roleId) {
  const result = await getDatabase()
    .collection(BATTERY_ALERT_COLLECTION)
    .updateOne(
      { _id: guildId },
      {
        $addToSet: { roleIds: roleId },
        $set: { updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );

  return result.modifiedCount > 0 || result.upsertedCount > 0;
}

export async function removeBatteryAlertRole(guildId, roleId) {
  const result = await getDatabase()
    .collection(BATTERY_ALERT_COLLECTION)
    .updateOne(
      { _id: guildId },
      { $pull: { roleIds: roleId }, $set: { updatedAt: new Date() } }
    );

  return result.modifiedCount > 0;
}
