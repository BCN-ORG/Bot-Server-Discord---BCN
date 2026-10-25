import { checkMemberNickname } from '../services/nameValidationService.js';
import { ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } from 'discord.js';
import { EMOJIS } from '../constants/emojis.js';
import { getViolationsByUser } from '../database/violations.js';

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

      // Check for unpaid violations (independent of name validation)
      await checkAndNotifyUnpaidViolations(member, newState.channel);
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

    console.log(`[INFO] Sent name validation reminder to ${member.user.tag}`);
  } catch (error) {
    console.log('[INFO] Could not send name validation reminder (DM disabled)');
  }
}

/**
 * Check and notify unpaid violations when joining voice
 * @param {GuildMember} member 
 * @param {VoiceChannel} voiceChannel 
 */
async function checkAndNotifyUnpaidViolations(member, voiceChannel) {
  try {
    // Get unpaid violations for this user
    const unpaidViolations = await getViolationsByUser(member.id, false);

    if (unpaidViolations.length === 0) {
      return; // No unpaid violations
    }

    // Find text channel associated with voice channel
    // Try to find a channel with same name or parent category
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
      console.log(`[Violation] No text channel found for voice channel ${voiceChannel.name}`);
      return;
    }

    // Calculate total amount
    const totalAmount = unpaidViolations.reduce((sum, v) => sum + v.amount, 0);

    // Build embed
    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('⚠️ Nhắc nhở nợ phạt')
      .setDescription(
        `${member} có **${unpaidViolations.length}** biên bản phạt chưa thanh toán!\n\n` +
        `💰 **Tổng số tiền:** ${totalAmount} coins\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n`
      )
      .setTimestamp();

    // Add violations (max 5 to avoid too long message)
    const displayViolations = unpaidViolations.slice(0, 5);
    displayViolations.forEach((v, index) => {
      embed.addFields({
        name: `${index + 1}. ${v.violationId}`,
        value: `• **Lý do:** ${v.reason}\n• **Số tiền:** ${v.amount} coins`,
        inline: false
      });
    });

    if (unpaidViolations.length > 5) {
      embed.setFooter({ text: `... và ${unpaidViolations.length - 5} biên bản khác. Dùng /violation-check để xem chi tiết` });
    } else {
      embed.setFooter({ text: 'Dùng /violation-confirm-payment để thanh toán' });
    }

    // Send to text channel (public notification)
    await textChannel.send({ embeds: [embed] });
    console.log(`[Violation] Sent unpaid violations notification for ${member.user.tag} to ${textChannel.name}`);

  } catch (error) {
    console.error('[Violation] Error checking unpaid violations:', error);
  }
}

