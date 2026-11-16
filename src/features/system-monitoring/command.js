import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';

const batteryStatusLabels = {
  CHARGING: 'Đang sạc',
  DISCHARGING: 'Đang dùng pin',
  FULL: 'Đã sạc đầy',
  NOT_CHARGING: 'Không sạc'
};

const getBatteryInfo = async () => {
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

  return { battery: result.device?.battery, temperature: result.device?.temperature };
};

export const data = new SlashCommandBuilder()
  .setName('battery')
  .setDescription('Kiểm tra tình trạng pin của thiết bị đang chạy bot (Android/Termux)');

export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const info = await getBatteryInfo();

    if (info.unsupportedPlatform) {
      await interaction.editReply(
        'Lệnh `/battery` chỉ hoạt động khi bot chạy trên Android/Termux.'
      );
      return;
    }

    if (!info.battery) {
      await interaction.editReply(
        'Không đọc được thông tin pin. Hãy kiểm tra ứng dụng Termux:API và gói `termux-api` đã được cài đặt.'
      );
      return;
    }

    const battery = info.battery;
    const percentage = Number.isFinite(battery.percentage)
      ? `${battery.percentage}%`
      : 'Không xác định';
    const status = batteryStatusLabels[battery.status] || battery.status || 'Không xác định';
    const plugged = battery.plugged
      ? battery.plugged.replaceAll('_', ' ').toLowerCase()
      : 'Không xác định';
    const health = battery.health || 'Không xác định';
    const temperature = info.temperature && info.temperature !== 'Không xác định'
      ? info.temperature
      : 'Không xác định';

    const embed = new EmbedBuilder()
      .setColor(Number.isFinite(battery.percentage) && battery.percentage <= 20 ? '#ff0000' : '#2ecc71')
      .setTitle('🔋 Tình trạng pin của bot')
      .addFields(
        { name: 'Dung lượng', value: percentage, inline: true },
        { name: 'Trạng thái', value: status, inline: true },
        { name: 'Nguồn điện', value: plugged, inline: true },
        { name: 'Sức khỏe pin', value: health, inline: true },
        { name: 'Nhiệt độ', value: temperature, inline: true }
      )
      .setFooter({ text: 'Dữ liệu từ Android/Termux' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('[Battery Command] Không thể lấy thông tin pin:', error);
    await interaction.editReply(
      'Không thể lấy thông tin pin lúc này. Hãy kiểm tra API hệ thống và thử lại.'
    );
  }
}
