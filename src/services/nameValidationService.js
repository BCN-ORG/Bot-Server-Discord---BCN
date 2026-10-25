import { validateName } from '../features/rename/validate.js';
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
