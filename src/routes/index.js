/**
 * Routes Index
 * Tong hop tat ca routes cua ung dung
 */

import express from 'express';
import birthdayRoutes from './birthdayRoutes.js';
import systemRoutes from './systemRoutes.js';

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
router.use('/', systemRoutes);

export default router;
