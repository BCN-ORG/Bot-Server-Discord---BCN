/**
 * Member Repository
 * Xu ly truy van database BCN collection members
 */

import { getBCNDatabase } from '../database/bcn.js';

/**
 * Lay danh sach members co sinh nhat theo ngay Viet Nam (DD/MM)
 * @param {string} dateString - Dinh dang DD/MM (vi du: "24/01")
 * @returns {Promise<Array>}
 */
export async function getMembersByBirthday(dateString) {
  try {
    const db = getBCNDatabase();
    const membersCollection = db.collection('members');

    // Query: tim cac document co dob bat dau voi dateString
    // Vi du: dateString = "24/01" → tim dob = "24/01/2006", "24/01/2005", etc.
    const regex = new RegExp(`^${dateString}/`);

    const members = await membersCollection.find({
      dob: { $regex: regex }
    }).toArray();

    console.log(`[MemberRepo] Found ${members.length} members with birthday ${dateString}`);
    return members;

  } catch (error) {
    console.error('[MemberRepo] Error getting members by birthday:', error);
    throw error;
  }
}

/**
 * Lay danh sach members co sinh nhat hom nay (theo timezone Viet Nam)
 * @returns {Promise<Array>}
 */
export async function getMembersWithBirthdayToday() {
  try {
    // Lay ngay hien tai theo timezone Viet Nam
    const now = new Date();
    const vietnamDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    
    const day = String(vietnamDate.getDate()).padStart(2, '0');
    const month = String(vietnamDate.getMonth() + 1).padStart(2, '0');
    const dateString = `${day}/${month}`;

    console.log(`[MemberRepo] Getting members with birthday today: ${dateString}`);
    return await getMembersByBirthday(dateString);

  } catch (error) {
    console.error('[MemberRepo] Error getting members with birthday today:', error);
    throw error;
  }
}

/**
 * Lay tat ca members (optional filter)
 * @param {Object} filter - MongoDB filter
 * @returns {Promise<Array>}
 */
export async function getAllMembers(filter = {}) {
  try {
    const db = getBCNDatabase();
    const membersCollection = db.collection('members');

    const members = await membersCollection.find(filter).toArray();
    
    console.log(`[MemberRepo] Found ${members.length} members`);
    return members;

  } catch (error) {
    console.error('[MemberRepo] Error getting all members:', error);
    throw error;
  }
}
