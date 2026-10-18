/**
 * Kiem tra va chuan hoa ho ten theo dinh dang: Nguyen Minh Vu
 */

/**
 * Chuan hoa ten: viet hoa chu cai dau moi tu
 * @param {string} name
 * @returns {string}
 */
function capitalizeWords(name) {
  return name
    .split(' ')
    .map(word => {
      if (word.length === 0) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Kiểm tra tên có hợp lệ không
 * @param {string} name - Họ tên cần kiểm tra
 * @returns {Object} { valid: boolean, error?: string, normalized?: string }
 */
export function validateName(name) {
  // Kiểm tra tên không được rỗng
  if (!name || name.trim().length === 0) {
    return {
      valid: false,
      error: '[ERROR] Họ tên không được để trống!'
    };
  }

  // Xóa khoảng trắng thừa (đầu, cuối và giữa các từ)
  const trimmed = name.trim().replace(/\s+/g, ' ');

  // Normalize Unicode về dạng NFC (Canonical Composition)
  // Chuyển các combining characters thành precomposed characters
  const normalized = trimmed.normalize('NFC');
  
  // Log để debug
  console.log(`[DEBUG] Validating name: "${normalized}" (length: ${normalized.length})`);
  if (normalized !== trimmed) {
    console.log(`[DEBUG] Normalized from: "${trimmed}"`);
  }

  // Kiểm tra độ dài tên (Discord giới hạn 32 ký tự)
  if (normalized.length > 32) {
    return {
      valid: false,
      error: '[ERROR] Họ tên quá dài! Tối đa 32 ký tự.'
    };
  }

  // Kiểm tra chỉ chứa chữ cái và khoảng trắng (hỗ trợ tiếng Việt có dấu)
  // Sử dụng Unicode property escapes để match tất cả chữ cái tiếng Việt
  const validNamePattern = /^[\p{L}\s]+$/u;
  
  if (!validNamePattern.test(normalized)) {
    console.log(`[DEBUG] Name failed regex test: "${normalized}"`);
    // Log từng ký tự để debug
    console.log(`[DEBUG] Characters:`, Array.from(normalized).map(c => `${c} (U+${c.charCodeAt(0).toString(16).toUpperCase()})`));
    return {
      valid: false,
      error: '[ERROR] Họ tên chỉ được chứa chữ cái! Không được có số, emoji hoặc ký tự đặc biệt.'
    };
  }

  // Tách thành các từ
  const words = normalized.split(' ').filter(word => word.length > 0);
  console.log(`[DEBUG] Name has ${words.length} words:`, words);

  // Kiểm tra số lượng từ (1-5 từ)
  if (words.length < 1) {
    return {
      valid: false,
      error: '[ERROR] Họ tên phải có ít nhất 1 từ!'
    };
  }

  if (words.length > 5) {
    return {
      valid: false,
      error: '[ERROR] Họ tên không được quá 5 từ!'
    };
  }

  // Kiểm tra mỗi từ phải có ít nhất 1 ký tự
  for (const word of words) {
    if (word.length < 1) {
      return {
        valid: false,
        error: '[ERROR] Mỗi từ trong họ tên phải có ít nhất 1 ký tự!'
      };
    }
  }

  // Chuẩn hóa: viết hoa chữ cái đầu mỗi từ
  const finalNormalized = capitalizeWords(normalized);

  console.log(`[DEBUG] Name is VALID: "${finalNormalized}"`);
  return {
    valid: true,
    normalized: finalNormalized
  };
}
