import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getDashboardStats, getDashboardDetailedStats } from '../controllers/dashboardController.js';

const router = express.Router();

/**
 * Ruta optimizada para obtener estadísticas básicas del dashboard
 * GET /api/v1/dashboard/stats
 * Retorna conteos rápidos sin cargar registros completos
 */
router.get('/stats', authMiddleware, getDashboardStats);

/**
 * Ruta para obtener estadísticas detalladas (opcional)
 * GET /api/v1/dashboard/detailed-stats
 * Retorna estadísticas más completas con detalles adicionales
 */
router.get('/detailed-stats', authMiddleware, getDashboardDetailedStats);

export default router;
