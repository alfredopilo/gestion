import express from 'express';
import {
  getSubPeriods,
  getSubPeriodById,
  createSubPeriod,
  updateSubPeriod,
  deleteSubPeriod,
} from '../controllers/subPeriodController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getSubPeriods);
router.get('/:id', getSubPeriodById);
router.post('/', authorize('ADMIN', 'SECRETARIA'), createSubPeriod);
router.put('/:id', authorize('ADMIN', 'SECRETARIA'), updateSubPeriod);
router.delete('/:id', authorize('ADMIN'), deleteSubPeriod);

export default router;

