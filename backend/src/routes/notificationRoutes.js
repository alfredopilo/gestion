import express from 'express';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '../controllers/notificationController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   GET /api/v1/notifications
 * @desc    Obtener todas las notificaciones del estudiante
 * @access  Private (Estudiante)
 */
router.get('/', authenticate, getNotifications);

/**
 * @route   GET /api/v1/notifications/count
 * @desc    Obtener conteo de notificaciones no leídas
 * @access  Private (Estudiante)
 */
router.get('/count', authenticate, getUnreadCount);

/**
 * @route   PATCH /api/v1/notifications/:id/read
 * @desc    Marcar una notificación como leída
 * @access  Private (Estudiante)
 */
router.patch('/:id/read', authenticate, markAsRead);

/**
 * @route   PATCH /api/v1/notifications/read-all
 * @desc    Marcar todas las notificaciones como leídas
 * @access  Private (Estudiante)
 */
router.patch('/read-all', authenticate, markAllAsRead);

export default router;

