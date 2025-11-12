import express from 'express';
import {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
} from '../controllers/studentController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// Todos los roles pueden ver estudiantes (con diferentes niveles de detalle)
router.get('/', getStudents);
router.get('/:id', getStudentById);

// Solo admin y secretaria pueden crear/editar/eliminar
router.post('/', authorize('ADMIN', 'SECRETARIA'), createStudent);
router.put('/:id', authorize('ADMIN', 'SECRETARIA'), updateStudent);
router.delete('/:id', authorize('ADMIN'), deleteStudent);

export default router;

