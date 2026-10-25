import { checkMemberNickname } from '../services/nameValidationService.js';
import { ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } from 'discord.js';
import { EMOJIS } from '../constants/emojis.js';

// Cache để tránh spam (chỉ nhắc 1 lần mỗi 30 phút)
const reminderCache = new Map();
const REMINDER_COOLDOWN = 30 * 60 * 1000; // 30 phút

/**
 * Xử lý khi member gửi message
 * @param {Message} message 
 */
export async function handleMessageCreate(message) {
  try {
    // Bỏ qua message từ bot
    if (message.author.bot) return;
    
    // Chỉ xử lý message trong guild (không xử lý DM)
    if (!message.guild) return;

    const member = message.member;
    if (!member) return;

    // Kiểm tra tên có hợp lệ không
    const { valid } = await checkMemberNickname(member);
    
    if (!valid) {
      // Tên không hợp lệ - XÓA TIN NHẮN
      try {
        await message.delete();
        console.log(`[INFO] Deleted message from ${member.user.tag} (invalid nickname)`);
      } catch (error) {
        console.error('[ERROR] Could not delete message:', error.message);
      }

      // Kiểm tra cooldown (tránh spam)
      const lastReminder = reminderCache.get(member.id);
      const now = Date.now();
      
      if (!lastReminder || (now - lastReminder) > REMINDER_COOLDOWN) {
        // Gửi thông báo nhắc nhở
        await sendMessageWarning(member, message.channel);
        
        // Cập nhật cache
        reminderCache.set(member.id, now);
        console.log(`[INFO] Sent message warning to ${member.user.tag}`);
      }
    }
  } catch (error) {
    console.error('[ERROR] Failed to handle message create:', error);
  }
}

/**
 * Gửi thông báo cảnh báo qua DM khi chat
 * @param {GuildMember} member 
 * @param {TextChannel} channel 
 */
async function sendMessageWarning(member, channel) {
  try {
    const button = new ButtonBuilder()
      .setCustomId('open_rename_modal')
      .setLabel('Đổi tên ngay')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    const embed = new EmbedBuilder()
      .setColor('#ff9900')
      .setTitle(`${EMOJIS.WARNING} Tên hiển thị không hợp lệ`)
      .setDescription(
        `Tin nhắn của bạn trong **#${channel.name}** đã bị xóa vì tên hiển thị không hợp lệ!\n\n` +
        `${EMOJIS.INFO} **Vui lòng đổi tên theo quy định:**\n` +
        `• Họ và tên đầy đủ (2-5 từ)\n` +
        `• Viết hoa chữ cái đầu mỗi từ\n` +
        `• Chỉ dùng chữ cái (có dấu)\n` +
        `• Ví dụ: Nguyễn Văn A\n\n` +
        `💡 Sau khi đổi tên hợp lệ, bạn có thể gửi tin nhắn bình thường.`
      )
      .setTimestamp()
      .setFooter({ text: `Server: ${member.guild.name}` });

    // Gửi DM riêng cho member
    try {
      await member.send({ 
        embeds: [embed],
        components: [row] 
      });
      console.log(`[INFO] Sent message warning DM to ${member.user.tag}`);
    } catch (dmError) {
      console.log(`[INFO] Could not send DM to ${member.user.tag}, DM might be disabled`);
      
      // Nếu không gửi được DM, gửi vào channel và tự xóa sau 10 giây
      const warningMsg = await channel.send({ 
        content: `${member}`,
        embeds: [embed],
        components: [row] 
      });

      setTimeout(async () => {
        try {
          await warningMsg.delete();
        } catch (error) {
          // Ignore if already deleted
        }
      }, 10000);
    }

  } catch (error) {
    console.error('[ERROR] Could not send message warning:', error);
  }
}
