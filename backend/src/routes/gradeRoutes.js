import express from 'express';
import {
  getGrades,
  getStudentGrades,
  getGradesSummary,
  upsertGrade,
  updateGrade,
  deleteGrade,
  bulkCreateGrades,
  resetGrades,
} from '../controllers/gradeController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/summary', authorize('ADMIN', 'PROFESOR', 'SECRETARIA'), getGradesSummary);
router.get('/', getGrades);
router.get('/student/:estudianteId', getStudentGrades);
router.post('/', authorize('PROFESOR', 'ADMIN', 'SECRETARIA'), upsertGrade);
router.put('/:id', authorize('PROFESOR', 'ADMIN', 'SECRETARIA'), updateGrade);
router.delete('/:id', authorize('PROFESOR', 'ADMIN', 'SECRETARIA'), deleteGrade);
router.post('/bulk', authorize('PROFESOR', 'ADMIN', 'SECRETARIA'), bulkCreateGrades);
router.post('/reset', authorize('PROFESOR', 'ADMIN', 'SECRETARIA'), resetGrades);

export default router;

