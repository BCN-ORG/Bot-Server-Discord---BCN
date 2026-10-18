import { checkMemberNickname, handleInvalidNickname, handleValidNickname } from '../services/nameValidationService.js';
import { EmbedBuilder } from 'discord.js';
import { EMOJIS } from '../constants/emojis.js';

/**
 * Xử lý khi member cập nhật thông tin (đổi nickname)
 * @param {GuildMember} oldMember 
 * @param {GuildMember} newMember 
 */
export async function handleGuildMemberUpdate(oldMember, newMember) {
  try {
    // Chỉ xử lý khi nickname thay đổi
    const oldNickname = oldMember.nickname || oldMember.user.username;
    const newNickname = newMember.nickname || newMember.user.username;

    if (oldNickname === newNickname) {
      return; // Không có thay đổi nickname
    }

    console.log(`[INFO] Member ${newMember.user.tag} changed nickname: "${oldNickname}" -> "${newNickname}"`);

    // Kiểm tra nickname mới
    const { valid } = await checkMemberNickname(newMember);

    // Log vào channel
    await logNicknameChange(newMember, oldNickname, newNickname, valid);

    if (valid) {
      // Tên đúng - đóng vi phạm nếu có
      await handleValidNickname(newMember);
      
      // Nếu member đang ở trong voice channel và bị mute/deafen, bỏ chặn
      if (newMember.voice.channel && (newMember.voice.serverMute || newMember.voice.serverDeaf)) {
        try {
          await newMember.voice.setMute(false, 'Tên hiển thị đã hợp lệ');
          await newMember.voice.setDeaf(false, 'Tên hiển thị đã hợp lệ');
          console.log(`[INFO] Unmuted and undeafened ${newMember.user.tag} after valid nickname change`);
        } catch (error) {
          console.error('[ERROR] Could not unmute/undeafen member:', error.message);
        }
      }
    } else {
      // Tên sai - xử lý vi phạm
      await handleInvalidNickname(newMember, newNickname);
      
      // Nếu member đang ở trong voice channel, chặn nói và nghe
      if (newMember.voice.channel) {
        try {
          await newMember.voice.setMute(true, 'Tên hiển thị không hợp lệ');
          await newMember.voice.setDeaf(true, 'Tên hiển thị không hợp lệ');
          console.log(`[INFO] Muted and deafened ${newMember.user.tag} after invalid nickname change`);
        } catch (error) {
          console.error('[ERROR] Could not mute/deafen member:', error.message);
        }
      }
      
      // Gửi DM nhắc nhở member
      await sendNicknameWarningDM(newMember);
    }

  } catch (error) {
    console.error('[ERROR] Failed to handle guild member update:', error);
  }
}

/**
 * Log thay đổi nickname vào channel
 * @param {GuildMember} member 
 * @param {string} oldNickname 
 * @param {string} newNickname 
 * @param {boolean} isValid 
 */
async function logNicknameChange(member, oldNickname, newNickname, isValid) {
  try {
    // Tìm kênh log (có thể config trong .env)
    const logChannel = member.guild.channels.cache.find(
      ch => ch.name === 'nickname-logs' || ch.name === 'mod-logs' || ch.name === 'logs'
    );

    if (!logChannel) {
      console.log('[INFO] Không tìm thấy kênh log để gửi thông báo');
      return;
    }

    // Tạo embed log
    const embed = new EmbedBuilder()
      .setColor(isValid ? '#00ff00' : '#ff0000')
      .setTitle('Thay đổi nickname')
      .setDescription(`${member} đã đổi nickname`)
      .addFields(
        { name: 'Tên cũ', value: `\`${oldNickname}\``, inline: true },
        { name: 'Tên mới', value: `\`${newNickname}\``, inline: true },
        { name: 'Trạng thái', value: isValid ? 'Hợp lệ' : 'Không hợp lệ', inline: true },
        { name: 'Member', value: `${member.user.tag} (${member.id})`, inline: false },
        { name: 'Thời gian', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
      )
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({ text: 'Nickname Monitor' });

    await logChannel.send({ embeds: [embed] });
    console.log(`[INFO] Logged nickname change for ${member.user.tag} to channel`);

  } catch (error) {
    console.error('[ERROR] Failed to log nickname change:', error);
  }
}

/**
 * Gửi DM nhắc nhở member khi đổi nickname không hợp lệ
 * @param {GuildMember} member 
 */
async function sendNicknameWarningDM(member) {
  try {
    const dmEmbed = new EmbedBuilder()
      .setColor('#ff9900')
      .setTitle(`${EMOJIS.WARNING} Tên hiển thị không hợp lệ`)
      .setDescription(
        `Xin chào ${member},\n\n` +
        `Tên hiển thị của bạn **"${member.nickname || member.user.username}"** không đúng định dạng.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${EMOJIS.INFO} **Quy định đặt tên:**\n` +
        `• Họ và tên đầy đủ (2-5 từ)\n` +
        `• Viết hoa chữ cái đầu mỗi từ\n` +
        `• Chỉ dùng chữ cái (có dấu)\n` +
        `• Ví dụ: Nguyễn Văn A\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${EMOJIS.WARNING} **Bạn có 48 giờ để đổi tên.**\n` +
        `Sau thời gian này bạn sẽ bị kick khỏi server.\n\n` +
        `${EMOJIS.INFO} Sử dụng lệnh \`/rename\` để đổi tên nhanh chóng!`
      )
      .setTimestamp()
      .setFooter({ text: `Server: ${member.guild.name}` });

    await member.send({ embeds: [dmEmbed] });
    console.log(`[INFO] Sent nickname warning DM to ${member.user.tag}`);
  } catch (error) {
    console.log(`[INFO] Không thể gửi DM cho ${member.user.tag}:`, error.message);
    
    // Nếu không gửi được DM, thử gửi vào channel
    try {
      const channel = member.guild.channels.cache.find(
        ch => ch.name === 'huong-dan' || ch.name === 'welcome' || ch.name === 'chao-mung'
      );
      
      if (channel) {
        const channelEmbed = new EmbedBuilder()
          .setColor('#ff9900')
          .setTitle('⚠️ Tên hiển thị không hợp lệ')
          .setDescription(`${member}, tên hiển thị của bạn không đúng định dạng!`)
          .addFields(
            { 
              name: '📋 Quy định', 
              value: '**Họ Và Tên** (1-5 từ, viết hoa đầu mỗi từ)\nVí dụ: `Nguyễn Minh Vũ`', 
              inline: false 
            },
            { name: '⏰ Thời hạn', value: 'Bạn có **48 giờ** để thay đổi!', inline: false }
          )
          .setFooter({ text: 'Dùng /rename để đổi tên nhanh' });

        await channel.send({ embeds: [channelEmbed] });
      }
    } catch (channelError) {
      console.error('[ERROR] Failed to send warning to channel:', channelError);
    }
  }
}
