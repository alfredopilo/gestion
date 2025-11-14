import express from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  importTeachers,
  getImportTeachersTemplate,
} from '../controllers/userController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Rutas específicas deben ir ANTES de las rutas con parámetros dinámicos
// Rutas para importación de profesores
router.post('/import-teachers', authorize('ADMIN'), importTeachers);
router.get('/import-teachers/template', authorize('ADMIN'), getImportTeachersTemplate);

// Solo admin puede gestionar usuarios
router.get('/', authorize('ADMIN', 'SECRETARIA'), getUsers);
router.get('/:id', authorize('ADMIN', 'SECRETARIA'), getUserById);
router.post('/', authorize('ADMIN'), createUser);
router.put('/:id', authorize('ADMIN'), updateUser);
router.delete('/:id', authorize('ADMIN'), deleteUser);

export default router;

