import express from 'express';
import {
  getGradeScales,
  getGradeScaleById,
  createGradeScale,
  updateGradeScale,
  deleteGradeScale,
} from '../controllers/gradeScaleController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getGradeScales);
router.get('/:id', getGradeScaleById);
router.post('/', authorize('ADMIN', 'SECRETARIA'), createGradeScale);
router.put('/:id', authorize('ADMIN', 'SECRETARIA'), updateGradeScale);
router.delete('/:id', authorize('ADMIN', 'SECRETARIA'), deleteGradeScale);

export default router;

