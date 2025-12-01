import express from 'express';
import {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  uploadFotoCarnet,
  getFotoCarnet,
} from '../controllers/studentController.js';
import {
  withdrawStudent,
  getStudentWithdrawals,
  getStudentEnrollments,
  reactivateWithSecondEnrollment,
  transferStudent,
} from '../controllers/withdrawalController.js';
import { getStudentSchoolYears } from '../controllers/historicalReportCardController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// Rutas específicas DEBEN ir ANTES de las rutas con parámetros
// Ruta para obtener foto de carnet (pública - NO requiere autenticación para que funcione en <img>)
router.get('/foto/:filename', getFotoCarnet);

// Aplicar autenticación a todas las demás rutas
router.use(authenticate);

// Rutas de retiros y matrículas (deben ir antes de /:id para evitar conflictos)
router.post('/:id/withdraw', authorize('ADMIN', 'SECRETARIA'), withdrawStudent);
router.get('/:id/withdrawals', authorize('ADMIN', 'SECRETARIA'), getStudentWithdrawals);
router.get('/:id/enrollments', authorize('ADMIN', 'SECRETARIA'), getStudentEnrollments);
router.get('/:id/school-years', getStudentSchoolYears);
router.post('/:id/reactivate', authorize('ADMIN', 'SECRETARIA'), reactivateWithSecondEnrollment);
router.post('/:id/transfer', authorize('ADMIN', 'SECRETARIA'), transferStudent);

// Subir foto de carnet (admin, secretaria y profesores pueden hacerlo)
router.post('/:id/foto', authorize('ADMIN', 'SECRETARIA', 'PROFESOR'), upload.single('foto'), uploadFotoCarnet);

// Todos los roles pueden ver estudiantes (con diferentes niveles de detalle)
router.get('/', getStudents);
router.get('/:id', getStudentById);

// Solo admin y secretaria pueden crear/editar/eliminar
router.post('/', authorize('ADMIN', 'SECRETARIA'), createStudent);
router.put('/:id', authorize('ADMIN', 'SECRETARIA'), updateStudent);
router.delete('/:id', authorize('ADMIN'), deleteStudent);

export default router;

