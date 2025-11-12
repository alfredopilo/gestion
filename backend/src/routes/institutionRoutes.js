import express from 'express';
import {
  getInstitutions,
  getInstitutionById,
  createInstitution,
  updateInstitution,
  deleteInstitution,
  getActiveInstitution,
  setActiveInstitution,
  getUserInstitutions,
} from '../controllers/institutionController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Ruta pública para listar instituciones (necesaria para login con número de identificación)
router.get('/', getInstitutions);

// Todas las demás rutas requieren autenticación
router.use(authenticate);

// Rutas públicas (cualquier usuario autenticado)
router.get('/active', getActiveInstitution);
router.get('/user-institutions', getUserInstitutions);
router.get('/:id', getInstitutionById);
router.post('/:id/activate', setActiveInstitution); // Cualquier usuario autenticado puede cambiar su institución activa

// Solo admin puede gestionar instituciones
router.post('/', authorize('ADMIN'), createInstitution);
router.put('/:id', authorize('ADMIN'), updateInstitution);
router.delete('/:id', authorize('ADMIN'), deleteInstitution);

export default router;

