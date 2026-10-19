/**
 * Birthday Service
 * Business logic cho chuc nang sinh nhat
 */

import * as memberRepository from '../repositories/memberRepository.js';

/**
 * Lay danh sach members co sinh nhat hom nay
 * @returns {Promise<Array>}
 */
export async function getTodayBirthdays() {
  try {
    const members = await memberRepository.getMembersWithBirthdayToday();
    
    // Transform data neu can (them field, format, etc.)
    return members.map(member => ({
      // id: member._id.toString(),
      studentId: member.studentId,
      fullName: member.fullName,
      dob: member.dob,
      // cohort: member.cohort,
      // email: member.email,
      phone: member.phone,
      major: member.major || '',
      // role: member.role,
      status: member.status
    }));

  } catch (error) {
    console.error('[BirthdayService] Error getting today birthdays:', error);
    throw error;
  }
}

/**
 * Lay danh sach members co sinh nhat theo ngay cu the
 * @param {string} date - Dinh dang DD/MM (vi du: "24/01")
 * @returns {Promise<Array>}
 */
export async function getBirthdaysByDate(date) {
  try {
    // Validate format DD/MM
    const dateRegex = /^\d{2}\/\d{2}$/;
    if (!dateRegex.test(date)) {
      throw new Error('Invalid date format. Expected DD/MM (e.g., "24/01")');
    }

    const members = await memberRepository.getMembersByBirthday(date);
    
    return members.map(member => ({
      id: member._id.toString(),
      studentId: member.studentId,
      fullName: member.fullName,
      dob: member.dob,
      cohort: member.cohort,
      email: member.email,
      phone: member.phone,
      major: member.major || '',
      role: member.role,
      status: member.status
    }));

  } catch (error) {
    console.error('[BirthdayService] Error getting birthdays by date:', error);
    throw error;
  }
}
