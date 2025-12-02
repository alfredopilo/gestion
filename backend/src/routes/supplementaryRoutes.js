import express from 'express';
import {
  getStudentsEligibleForSupplementary,
  getStudentSupplementaryStatus,
} from '../controllers/supplementaryController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Obtener estudiantes elegibles para supletorio
router.get(
  '/eligible-students',
  authorize('ADMIN', 'SECRETARIA', 'PROFESOR'),
  getStudentsEligibleForSupplementary
);

// Obtener estado de elegibilidad de un estudiante
router.get(
  '/student-status/:studentId/:materiaId/:anioLectivoId',
  authorize('ADMIN', 'SECRETARIA', 'PROFESOR'),
  getStudentSupplementaryStatus
);

export default router;

