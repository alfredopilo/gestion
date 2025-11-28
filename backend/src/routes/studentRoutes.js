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
import { authenticate, authorize } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// Rutas específicas DEBEN ir ANTES de las rutas con parámetros
// Ruta para obtener foto de carnet (pública - NO requiere autenticación para que funcione en <img>)
router.get('/foto/:filename', getFotoCarnet);

// Aplicar autenticación a todas las demás rutas
router.use(authenticate);

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

