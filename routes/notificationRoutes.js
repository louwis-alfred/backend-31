import express from 'express';
import { authUser } from '../middleware/authRoles.js';
import {
  createNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount
} from '../controllers/notificationController.js';

const router = express.Router();

router.post('/', authUser, createNotification);
router.get('/my', authUser, getUserNotifications);
router.patch('/:id/read', authUser, markAsRead);
router.patch('/read-all', authUser, markAllAsRead);
router.get('/unread-count', authUser, getUnreadCount);

export default router;