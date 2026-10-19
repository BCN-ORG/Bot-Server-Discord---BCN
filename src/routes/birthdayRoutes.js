/**
 * Birthday Routes
 * Dinh nghia cac API endpoints cho birthday feature
 */

import express from 'express';
import * as birthdayController from '../controllers/birthdayController.js';

const router = express.Router();

/**
 * GET /api/birthdays/today
 * Lay danh sach members co sinh nhat hom nay (theo timezone VN)
 * 
 * Response:
 * {
 *   "success": true,
 *   "date": "19/10/2026",
 *   "count": 2,
 *   "data": [
 *     {
 *       "id": "6ad5c2770235488236a5b18d",
 *       "studentId": "24668051",
 *       "fullName": "Nguyễn Ngọc Thùy Dương",
 *       "dob": "24/01/2006",
 *       ...
 *     }
 *   ]
 * }
 */
router.get('/today', birthdayController.getTodayBirthdays);

/**
 * POST /api/birthdays/by-date
 * Lay danh sach members co sinh nhat theo ngay cu the
 * 
 * Body:
 * {
 *   "date": "24/01"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "date": "24/01",
 *   "count": 3,
 *   "data": [...]
 * }
 */
router.post('/by-date', birthdayController.getBirthdaysByDate);

export default router;
