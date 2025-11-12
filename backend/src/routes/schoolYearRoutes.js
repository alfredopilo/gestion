import express from 'express';
import {
  getSchoolYears,
  getSchoolYearById,
  createSchoolYear,
  updateSchoolYear,
  deleteSchoolYear,
  setActiveSchoolYear,
  getActiveSchoolYearController,
} from '../controllers/schoolYearController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// Rutas públicas (cualquier usuario autenticado)
router.get('/', getSchoolYears);
router.get('/active', getActiveSchoolYearController); // Debe ir antes de /:id
router.get('/:id', getSchoolYearById);

// Solo admin puede gestionar años lectivos
router.post('/', authorize('ADMIN', 'SECRETARIA'), createSchoolYear);
router.put('/:id', authorize('ADMIN', 'SECRETARIA'), updateSchoolYear);
router.delete('/:id', authorize('ADMIN'), deleteSchoolYear);
router.post('/:id/activate', authorize('ADMIN', 'SECRETARIA'), setActiveSchoolYear);

export default router;

