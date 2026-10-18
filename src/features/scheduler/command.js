import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

/**
 * Command de bat/tat scheduler
 */
export const data = new SlashCommandBuilder()
  .setName('scheduler')
  .setDescription('Quản lý scheduler tự động kiểm tra và kick vi phạm')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(option =>
    option
      .setName('action')
      .setDescription('Bật hoặc tắt scheduler')
      .setRequired(true)
      .addChoices(
        { name: 'Bật (ON)', value: 'on' },
        { name: 'Tắt (OFF)', value: 'off' }
      )
  );

/**
 * Xu ly command
 */
export async function execute(interaction) {
  const action = interaction.options.getString('action');
  
  // Import scheduler controller
  const { enableScheduler, disableScheduler, isSchedulerEnabled } = await import('./controller.js');
  
  try {
    if (action === 'on') {
      await enableScheduler();
      await interaction.reply({
        content: 
          `[OK] **SCHEDULER ĐÃ BẬT**\n\n` +
          `Scheduler sẽ tự động chạy vào **00:00 mỗi ngày** để:\n` +
          `- Kiểm tra vi phạm quá hạn (48 giờ)\n` +
          `- Kick những user chưa sửa tên hợp lệ\n\n` +
          `Dùng \`/scheduler off\` để tắt.`,
        ephemeral: true
      });
    } else {
      await disableScheduler();
      await interaction.reply({
        content: 
          `[X] **SCHEDULER ĐÃ TẮT**\n\n` +
          `Scheduler sẽ KHÔNG tự động kick user vi phạm.\n` +
          `Bot vẫn sẽ:\n` +
          `- Xóa tin nhắn của user tên sai\n` +
          `- Mute/deafen trong voice\n` +
          `- Ghi nhận vi phạm vào database\n\n` +
          `Dùng \`/scheduler on\` để bật lại.`,
        ephemeral: true
      });
    }
  } catch (error) {
    console.error('[ERROR] Failed to toggle scheduler:', error);
    await interaction.reply({
      content: `[ERROR] Không thể thay đổi trạng thái scheduler: ${error.message}`,
      ephemeral: true
    });
  }
}
