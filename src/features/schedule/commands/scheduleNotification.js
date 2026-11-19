import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { setScheduleNotificationTime } from '../../../database/schedule.js';

export const data = new SlashCommandBuilder()
  .setName('lich-hoc-notification')
  .setDescription('Cài đặt thông báo lịch học hàng ngày')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('set')
      .setDescription('Đặt thời gian thông báo lịch học hàng ngày')
      .addStringOption(option =>
        option
          .setName('time')
          .setDescription('Thời gian thông báo (định dạng HH:mm, ví dụ: 08:00)')
          .setRequired(true)
      )
  );

function validateTime(timeStr) {
  const timeRegex = /^([0-1]?\d|2[0-3]):([0-5]\d)$/;
  const match = timeStr.trim().match(timeRegex);
  if (!match) {
    return { valid: false, error: 'Định dạng thời gian không hợp lệ. Vui lòng sử dụng định dạng HH:mm (ví dụ: 08:00)' };
  }
  
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return { valid: false, error: 'Thời gian phải trong khoảng 00:00 đến 23:59' };
  }
  
  const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  return { valid: true, time: formattedTime };
}

export async function execute(interaction) {
  if (!interaction.inGuild()) {
    await interaction.reply({ 
      content: 'Lệnh này chỉ có thể sử dụng trong máy chủ.', 
      flags: MessageFlags.Ephemeral 
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'set') {
    const timeInput = interaction.options.getString('time', true);
    const validation = validateTime(timeInput);
    
    if (!validation.valid) {
      await interaction.reply({ 
        content: validation.error, 
        flags: MessageFlags.Ephemeral 
      });
      return;
    }

    await setScheduleNotificationTime(interaction.guildId, validation.time);
    
    console.log(`[Schedule Notification] Admin ${interaction.user.tag} set notification time to ${validation.time} for guild ${interaction.guild.name} (${interaction.guildId})`);
    
    await interaction.reply({ 
      content: `Đã đặt thời gian thông báo lịch học hàng ngày lúc ${validation.time}`, 
      flags: MessageFlags.Ephemeral 
    });
  }
}
