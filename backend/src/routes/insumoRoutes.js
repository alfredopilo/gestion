import express from 'express';
import {
  getInsumos,
  getInsumoById,
  createInsumo,
  updateInsumo,
  deleteInsumo,
} from '../controllers/insumoController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getInsumos);
router.get('/:id', getInsumoById);
router.post('/', authorize('ADMIN', 'SECRETARIA', 'PROFESOR'), createInsumo);
router.put('/:id', authorize('ADMIN', 'SECRETARIA', 'PROFESOR'), updateInsumo);
router.delete('/:id', authorize('ADMIN'), deleteInsumo);

export default router;

