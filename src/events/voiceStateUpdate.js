import { checkMemberNickname } from '../services/nameValidationService.js';
import { ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } from 'discord.js';
import { EMOJIS } from '../constants/emojis.js';
import { checkAndNotifyVoiceJoin } from '../features/fine/index.js';

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

        // Send name validation reminder
        await sendNameValidationReminder(member, newState.channel);
      }

      // Check for unpaid fines (independent of name validation)
      await checkAndNotifyUnpaidFines(member, newState.channel);
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
 * Gửi thông báo nhắc nhở về tên không hợp lệ khi join voice
 * @param {GuildMember} member 
 * @param {VoiceChannel} channel 
 */
async function sendNameValidationReminder(member, channel) {
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
        `Xin chào ${member},\n` +
        `Bạn đã bị chặn nói và nghe trong voice channel vì tên hiển thị không hợp lệ!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${EMOJIS.INFO} **Quy định đặt tên:**\n` +
        `• Họ và tên đầy đủ (2-5 từ)\n` +
        `• Viết hoa chữ cái đầu mỗi từ\n` +
        `• Chỉ dùng chữ cái (có dấu)\n` +
        `• Ví dụ: Nguyễn Văn A\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${EMOJIS.WARNING} **Bạn có 48 giờ để đổi tên.**\n` +
        `Sau khi đổi tên hợp lệ, bạn sẽ được bỏ chặn tự động.\n` +
        `${EMOJIS.INFO} Sử dụng lệnh \`/rename\` hoặc bấm nút bên dưới để đổi tên!`
      )
      .setTimestamp()
      .setFooter({ text: `Server: ${member.guild.name}` });

    // Gửi DM cho member
    await member.send({ embeds: [embed], components: [row] });

    console.log(`[INFO] Sent name validation reminder to ${member.user.tag}`);
  } catch (error) {
    console.log('[INFO] Could not send name validation reminder (DM disabled)');
  }
}

/**
 * Check and notify unpaid fines when joining voice
 */
async function checkAndNotifyUnpaidFines(member, voiceChannel) {
  try {
    // Find text channel associated with voice channel
    let textChannel = null;
    
    // Try same name
    textChannel = member.guild.channels.cache.find(
      ch => ch.isTextBased() && 
           ch.name.toLowerCase().includes(voiceChannel.name.toLowerCase())
    );

    // If not found, try parent category's channels
    if (!textChannel && voiceChannel.parent) {
      textChannel = voiceChannel.parent.children.cache.find(
        ch => ch.isTextBased() && ch.type === 0 // GuildText
      );
    }

    // If still not found, skip notification
    if (!textChannel) {
      console.log(`[Fine] No text channel found for voice channel ${voiceChannel.name}`);
      return;
    }

    // Call fine service to check and notify
    await checkAndNotifyVoiceJoin(member.guild.id, member, textChannel);
  } catch (error) {
    console.error('[Fine] Error checking unpaid fines:', error);
  }
}
