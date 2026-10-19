/**
 * Routes Index
 * Tong hop tat ca routes cua ung dung
 */

import express from 'express';
import birthdayRoutes from './birthdayRoutes.js';

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Discord Bot API is running',
    timestamp: new Date().toISOString()
  });
});

// Birthday routes
router.use('/birthdays', birthdayRoutes);

export default router;
