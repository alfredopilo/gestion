import express from 'express';
import {
  getSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject,
} from '../controllers/subjectController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getSubjects);
router.get('/:id', getSubjectById);

router.post('/', authorize('ADMIN', 'SECRETARIA'), createSubject);
router.put('/:id', authorize('ADMIN', 'SECRETARIA'), updateSubject);
router.delete('/:id', authorize('ADMIN'), deleteSubject);

export default router;

