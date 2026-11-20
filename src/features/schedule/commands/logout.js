import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { deleteScheduleCredentials, getScheduleCredentials } from '../../../database/schedule.js';

export const data = new SlashCommandBuilder()
  .setName('lich-hoc-logout')
  .setDescription('Đăng xuất tài khoản lịch học');

export async function execute(interaction) {
  if (!interaction.inGuild()) {
    await interaction.reply({ 
      content: 'Lệnh này chỉ có thể sử dụng trong máy chủ.', 
      flags: MessageFlags.Ephemeral 
    });
    return;
  }

  const credentials = await getScheduleCredentials(interaction.user.id);
  
  if (!credentials) {
    await interaction.reply({ 
      content: 'Bạn chưa đăng nhập vào hệ thống lịch học.', 
      flags: MessageFlags.Ephemeral 
    });
    return;
  }

  await deleteScheduleCredentials(interaction.user.id);
  
  console.log(`[Schedule] User ${interaction.user.tag} logged out successfully`);
  
  await interaction.reply({ 
    content: '✅ Đã đăng xuất khỏi hệ thống lịch học. Sử dụng `/lich-hoc-login` để đăng nhập lại.', 
    flags: MessageFlags.Ephemeral 
  });
}
