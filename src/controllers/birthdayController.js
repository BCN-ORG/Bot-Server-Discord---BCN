/**
 * Birthday Controller
 * Xu ly HTTP requests cho birthday endpoints
 */

import * as birthdayService from '../services/birthdayService.js';

/**
 * GET /api/birthdays/today
 * Lay danh sach members co sinh nhat hom nay
 */
export async function getTodayBirthdays(req, res) {
  try {
    const members = await birthdayService.getTodayBirthdays();

    res.status(200).json({
      success: true,
      date: new Date().toLocaleDateString('vi-VN', { 
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }),
      count: members.length,
      data: members
    });

  } catch (error) {
    console.error('[BirthdayController] Error in getTodayBirthdays:', error);
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}

/**
 * POST /api/birthdays/by-date
 * Lay danh sach members co sinh nhat theo ngay cu the
 * 
 * Body: { "date": "24/01" }
 */
export async function getBirthdaysByDate(req, res) {
  try {
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Bad request',
        message: 'Field "date" is required in request body (format: DD/MM)'
      });
    }

    const members = await birthdayService.getBirthdaysByDate(date);

    res.status(200).json({
      success: true,
      date: date,
      count: members.length,
      data: members
    });

  } catch (error) {
    console.error('[BirthdayController] Error in getBirthdaysByDate:', error);
    
    // Check if it's validation error
    if (error.message.includes('Invalid date format')) {
      return res.status(400).json({
        success: false,
        error: 'Bad request',
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}
