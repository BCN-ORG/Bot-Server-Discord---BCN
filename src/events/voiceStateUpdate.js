import { checkMemberNickname } from '../services/nameValidationService.js';
import { getViolation, ViolationStatus } from '../database/violations.js';
import { ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } from 'discord.js';
import { EMOJIS } from '../constants/emojis.js';

/**
 * Xử lý khi member join/leave voice channel
 * @param {VoiceState} oldState 
 * @param {VoiceState} newState 
 */
export async function handleVoiceStateUpdate(oldState, newState) {
  try {
    // Chỉ xử lý khi member JOIN voice channel (không có channel -> có channel)
    if (!oldState.channel && newState.channel) {
      const member = newState.member;

      console.log(`[INFO] Member ${member.user.tag} joined voice channel: ${newState.channel.name}`);

      // Kiểm tra tên có hợp lệ không
      const { valid } = await checkMemberNickname(member);

      if (!valid) {
        // Tên không hợp lệ - CHẶN NÓI VÀ CHẶN NGHE
        try {
          await member.voice.setMute(true, 'Tên hiển thị không hợp lệ');
          await member.voice.setDeaf(true, 'Tên hiển thị không hợp lệ');
          console.log(`[INFO] Muted and deafened ${member.user.tag} (invalid nickname)`);
        } catch (error) {
          console.error('[ERROR] Could not mute/deafen member:', error.message);
        }

        // Kiểm tra có vi phạm đang pending không
        const violation = await getViolation(newState.guild.id, member.id);

        if (violation && violation.status === ViolationStatus.PENDING) {
          // Có vi phạm - gửi thông báo nhắc nhở
          await sendVoiceJoinReminder(member, newState.channel);
        }
      }
    }

    // Xử lý khi member đã đổi tên hợp lệ và đang bị mute/deafen
    if (newState.channel && newState.serverMute && newState.serverDeaf) {
      const member = newState.member;
      const { valid } = await checkMemberNickname(member);

      if (valid) {
        // Tên đã hợp lệ - BỎ CHẶN
        try {
          await member.voice.setMute(false, 'Tên hiển thị đã hợp lệ');
          await member.voice.setDeaf(false, 'Tên hiển thị đã hợp lệ');
          console.log(`[INFO] Unmuted and undeafened ${member.user.tag} (valid nickname)`);
        } catch (error) {
          console.error('[ERROR] Could not unmute/undeafen member:', error.message);
        }
      }
    }
  } catch (error) {
    console.error('[ERROR] Failed to handle voice state update:', error);
  }
}

/**
 * Gửi thông báo nhắc nhở khi join voice
 * @param {GuildMember} member 
 * @param {VoiceChannel} channel 
 */
async function sendVoiceJoinReminder(member, channel) {
  try {
    const button = new ButtonBuilder()
      .setCustomId('open_rename_modal')
      .setLabel('Đổi tên ngay')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle(`${EMOJIS.WARNING} Bạn đã bị chặn nói và nghe`)
      .setDescription(
        `Xin chào ${member},\n\n` +
        `Bạn đã bị chặn nói và nghe trong voice channel vì tên hiển thị không hợp lệ!\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${EMOJIS.INFO} **Quy định đặt tên:**\n` +
        `• Họ và tên đầy đủ (2-5 từ)\n` +
        `• Viết hoa chữ cái đầu mỗi từ\n` +
        `• Chỉ dùng chữ cái (có dấu)\n` +
        `• Ví dụ: Nguyễn Văn A\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${EMOJIS.WARNING} **Bạn có 48 giờ để đổi tên.**\n` +
        `Sau khi đổi tên hợp lệ, bạn sẽ được bỏ chặn tự động.\n\n` +
        `${EMOJIS.INFO} Sử dụng lệnh \`/rename\` hoặc bấm nút bên dưới để đổi tên!`
      )
      .setTimestamp()
      .setFooter({ text: `Server: ${member.guild.name}` });

    // Gửi DM cho member
    await member.send({ embeds: [embed], components: [row] });

    console.log(`[INFO] Sent voice join reminder to ${member.user.tag}`);
  } catch (error) {
    console.log('[INFO] Could not send voice join reminder (DM disabled)');
  }
}

