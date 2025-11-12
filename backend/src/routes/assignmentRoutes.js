import express from 'express';
import {
  getAssignments,
  getAssignmentById,
  createAssignment,
  updateAssignment,
  deleteAssignment,
} from '../controllers/courseSubjectAssignmentController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getAssignments);
router.get('/:id', getAssignmentById);

router.post('/', authorize('ADMIN', 'SECRETARIA'), createAssignment);
router.put('/:id', authorize('ADMIN', 'SECRETARIA'), updateAssignment);
router.delete('/:id', authorize('ADMIN'), deleteAssignment);

export default router;

