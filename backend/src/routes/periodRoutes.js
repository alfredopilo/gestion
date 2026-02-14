import express from 'express';
import {
  getPeriods,
  getPeriodById,
  createPeriod,
  updatePeriod,
  deletePeriod,
  getActivePeriod,
  setActivePeriod,
  exportPeriod,
  exportAllPeriodsConfiguration,
  importPeriod,
} from '../controllers/periodController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// Rutas específicas primero (antes de las dinámicas)
router.get('/active', getActivePeriod);
router.get('/export-config', exportAllPeriodsConfiguration);
router.get('/', getPeriods);
router.post('/import', authorize('ADMIN', 'SECRETARIA'), importPeriod);

// Rutas dinámicas después
router.get('/:id/export', exportPeriod);
router.get('/:id', getPeriodById);
router.post('/', authorize('ADMIN', 'SECRETARIA'), createPeriod);
router.put('/:id/activate', authorize('ADMIN', 'SECRETARIA'), setActivePeriod);
router.put('/:id', authorize('ADMIN', 'SECRETARIA'), updatePeriod);
router.delete('/:id', authorize('ADMIN'), deletePeriod);

export default router;

