import express from 'express';
import {
  getGradesReport,
  getAveragesReport,
  getAttendanceReport,
  getPerformanceReport,
  exportToPDF,
} from '../controllers/reportController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Rutas de reportes
router.get('/grades', authorize(['ADMIN', 'PROFESOR', 'SECRETARIA']), getGradesReport);
router.get('/averages', authorize(['ADMIN', 'PROFESOR', 'SECRETARIA']), getAveragesReport);
router.get('/attendance', authorize(['ADMIN', 'PROFESOR', 'SECRETARIA']), getAttendanceReport);
router.get('/performance', authorize(['ADMIN', 'PROFESOR', 'SECRETARIA']), getPerformanceReport);
router.get('/export/pdf', authorize(['ADMIN', 'PROFESOR', 'SECRETARIA']), exportToPDF);

export default router;

