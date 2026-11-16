import { SlashCommandBuilder } from 'discord.js';
import { createBatteryEmbed, getBatteryInfo } from './batteryService.js';

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

    await interaction.editReply({ embeds: [createBatteryEmbed(info)] });
  } catch (error) {
    console.error('[Battery Command] Không thể lấy thông tin pin:', error);
    await interaction.editReply(
      'Không thể lấy thông tin pin lúc này. Hãy kiểm tra API hệ thống và thử lại.'
    );
  }
}
