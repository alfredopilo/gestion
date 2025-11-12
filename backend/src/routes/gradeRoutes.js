import express from 'express';
import {
  getGrades,
  getStudentGrades,
  upsertGrade,
  updateGrade,
  deleteGrade,
  bulkCreateGrades,
} from '../controllers/gradeController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getGrades);
router.get('/student/:estudianteId', getStudentGrades);
router.post('/', authorize('PROFESOR', 'ADMIN', 'SECRETARIA'), upsertGrade);
router.put('/:id', authorize('PROFESOR', 'ADMIN', 'SECRETARIA'), updateGrade);
router.delete('/:id', authorize('PROFESOR', 'ADMIN', 'SECRETARIA'), deleteGrade);
router.post('/bulk', authorize('PROFESOR', 'ADMIN', 'SECRETARIA'), bulkCreateGrades);

export default router;

