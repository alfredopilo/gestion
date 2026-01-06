import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  getAccessLogs,
  getLoginStats,
  getAvailableActions,
  getUserLogs,
  exportLogsToCSV,
} from '../controllers/logController.js';

const router = express.Router();

// Todas las rutas requieren autenticación y rol ADMIN
router.use(authenticate);
router.use(authorize('ADMIN'));

// Obtener logs de acceso con filtros y paginación
router.get('/access-logs', getAccessLogs);

// Obtener estadísticas de login
router.get('/login-stats', getLoginStats);

// Obtener acciones disponibles para filtros
router.get('/actions', getAvailableActions);

// Obtener logs de un usuario específico
router.get('/user/:userId', getUserLogs);

// Exportar logs a CSV
router.get('/export/csv', exportLogsToCSV);

export default router;
