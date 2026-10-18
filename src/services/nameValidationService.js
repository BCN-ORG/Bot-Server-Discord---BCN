import { validateName } from '../features/rename/validate.js';
import { 
  getViolation, 
  createViolation, 
  updateViolationNickname,
  resolveViolation,
  ViolationStatus 
} from '../database/violations.js';
import { ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';

/**
 * Kiểm tra nickname và xử lý vi phạm
 * @param {GuildMember} member 
 * @returns {Promise<Object>} { valid: boolean, violation?: Object }
 */
export async function checkMemberNickname(member) {
  // Kiểm tra xem user có trong exception list không
  const exceptionUids = process.env.VALIDATION_EXCEPTION_UIDS || '';
  const exceptionList = exceptionUids.split(',').map(uid => uid.trim()).filter(uid => uid);
  
  if (exceptionList.includes(member.id)) {
    console.log(`[DEBUG] User ${member.user.tag} (${member.id}) is in exception list - skipping validation`);
    return {
      valid: true,
      nickname: member.displayName,
      validation: { valid: true, normalized: member.displayName },
      member,
      exempted: true
    };
  }
  
  // Lấy tên hiển thị trong server (nickname nếu có, username nếu không)
  const nickname = member.displayName;
  
  // Log để debug
  console.log(`[DEBUG] Checking nickname for ${member.user.tag} (username: ${member.user.username}, displayName: ${nickname})`);
  
  const validation = validateName(nickname);

  return {
    valid: validation.valid,
    nickname,
    validation,
    member
  };
}

/**
 * Xu ly khi phat hien ten sai
 * @param {GuildMember} member 
 * @param {string} invalidNickname 
 * @returns {Promise<void>}
 */
export async function handleInvalidNickname(member, invalidNickname) {
  try {
    const guildId = member.guild.id;
    const memberId = member.id;

    // Kiem tra vi pham da ton tai chua
    const existingViolation = await getViolation(guildId, memberId);

    if (existingViolation && existingViolation.status === ViolationStatus.PENDING) {
      // Vi pham dang cho xu ly - chi cap nhat nickname, GIU NGUYEN deadline
      await updateViolationNickname(guildId, memberId, invalidNickname);
      console.log(`[INFO] Updated existing violation for ${member.user.tag}`);
      
      // Khong gui thong bao lai
      return { 
        action: 'updated',
        violation: existingViolation 
      };
    }

    // Chua co vi pham hoac da xu ly xong - tao moi
    const violation = await createViolation(guildId, memberId, invalidNickname);
    
    // Gui thong bao yeu cau sua ten
    const sent = await sendViolationNotification(member, violation);

    if (!sent) {
      // Khong gui duoc DM, thu gui vao kenh huong dan
      await sendViolationToChannel(member, violation);
    }

    return { 
      action: 'created',
      violation 
    };
  } catch (error) {
    console.error('[ERROR] Failed to handle invalid nickname:', error);
    throw error;
  }
}

/**
 * Xu ly khi member sua ten dung
 * @param {GuildMember} member 
 * @returns {Promise<void>}
 */
export async function handleValidNickname(member) {
  try {
    const guildId = member.guild.id;
    const memberId = member.id;

    // Kiem tra co vi pham dang pending khong
    const violation = await getViolation(guildId, memberId);

    if (violation && violation.status === ViolationStatus.PENDING) {
      // Dong vi pham
      await resolveViolation(guildId, memberId);
      
      // Gui thong bao chuc mung
      await sendResolvedNotification(member);
      
      console.log(`[INFO] Resolved violation for ${member.user.tag}`);
      return { resolved: true };
    }

    return { resolved: false };
  } catch (error) {
    console.error('[ERROR] Failed to handle valid nickname:', error);
    throw error;
  }
}

/**
 * Gui thong bao vi pham qua DM
 * @param {GuildMember} member 
 * @param {Object} violation 
 * @returns {Promise<boolean>} true neu gui thanh cong
 */
async function sendViolationNotification(member, violation) {
  try {
    const deadlineText = formatDeadline(violation.deadlineAt);
    
    // Tao nut bam
    const fixButton = new ButtonBuilder()
      .setCustomId('open_rename_modal')
      .setLabel('Sửa tên ngay')
      .setStyle(ButtonStyle.Primary);

    const laterButton = new ButtonBuilder()
      .setCustomId('violation_later')
      .setLabel('Để sau')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(fixButton, laterButton);

    await member.send({
      content: 
        `⚠️ **CẢNH BÁO: TÊN KHÔNG HỢP LỆ**\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📝 **Tên hiện tại của bạn:**\n` +
        `\`\`\`${violation.invalidNickname}\`\`\`\n` +
        `✅ **Vui lòng đặt tên theo định dạng:**\n` +
        `\`\`\`Nguyễn Minh Vũ\`\`\`\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📋 **YÊU CẦU:**\n` +
        `• Chỉ chứa chữ cái (có hoặc không dấu)\n` +
        `• Có từ 2-5 từ\n` +
        `• Không có số, emoji hoặc ký tự đặc biệt\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `⏰ **HẠN SỬA: ${deadlineText.toUpperCase()}**\n\n` +
        `⚡ Nếu không sửa đúng tên trong thời hạn, bạn sẽ bị **KICK** khỏi server.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `💡 **Lưu ý:** Nút "Để sau" vẫn giữ nguyên hạn 48 giờ từ thời điểm nhận được thông báo này.`,
      components: [row]
    });

    console.log(`[INFO] Sent violation notification to ${member.user.tag}`);
    return true;
  } catch (error) {
    console.error('[ERROR] Failed to send DM:', error);
    return false;
  }
}

/**
 * Gui thong bao vi pham vao kenh huong dan
 * @param {GuildMember} member 
 * @param {Object} violation 
 */
async function sendViolationToChannel(member, violation) {
  try {
    const channel = member.guild.channels.cache.find(
      ch => ch.name === 'huong-dan' || ch.name === 'welcome' || ch.name === 'chao-mung'
    );

    if (!channel) {
      console.error('[ERROR] Khong tim thay kenh huong dan');
      return;
    }

    const deadlineText = formatDeadline(violation.deadlineAt);

    const fixButton = new ButtonBuilder()
      .setCustomId('open_rename_modal')
      .setLabel('Sửa tên ngay')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(fixButton);

    await channel.send({
      content: 
        `${member}\n\n` +
        `⚠️ **TÊN KHÔNG HỢP LỆ!**\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📝 **Tên hiện tại:** \`${violation.invalidNickname}\`\n` +
        `⏰ **Hạn sửa:** \`${deadlineText}\`\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `✅ Vui lòng bấm nút bên dưới để sửa tên theo định dạng:\n` +
        `**Nguyễn Minh Vũ**`,
      components: [row]
    });

    console.log(`[INFO] Sent violation notification to channel for ${member.user.tag}`);
  } catch (error) {
    console.error('[ERROR] Failed to send violation to channel:', error);
  }
}

/**
 * Gui thong bao da sua ten thanh cong
 * @param {GuildMember} member 
 */
async function sendResolvedNotification(member) {
  try {
    await member.send({
      content: 
        `✅ **CẢM ƠN BẠN ĐÃ SỬA TÊN!**\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🎉 Tên của bạn đã hợp lệ.\n\n` +
        `✨ Vi phạm đã được hủy bỏ.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Chúc bạn vui vẻ trong server! 🎊`
    });
  } catch (error) {
    console.log('[INFO] Could not send resolved notification (DM disabled)');
  }
}

/**
 * Format deadline thanh text de doc
 * @param {Date} deadline 
 * @returns {string}
 */
function formatDeadline(deadline) {
  const now = new Date();
  const diffMs = deadline - now;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  
  if (diffHours <= 0) {
    return 'đã quá hạn';
  }
  
  if (diffHours < 24) {
    return `${diffHours} giờ nữa`;
  }
  
  const diffDays = Math.floor(diffHours / 24);
  const remainingHours = diffHours % 24;
  
  if (remainingHours === 0) {
    return `${diffDays} ngày nữa`;
  }
  
  return `${diffDays} ngày ${remainingHours} giờ nữa`;
}
