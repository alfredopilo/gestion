import express from 'express';
import multer from 'multer';
import {
  getSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject,
  importSubjects,
  getImportSubjectsTemplate,
} from '../controllers/subjectController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getSubjects);
router.get('/import-template', authorize('ADMIN', 'SECRETARIA'), getImportSubjectsTemplate);
router.get('/:id', getSubjectById);

router.post('/', authorize('ADMIN', 'SECRETARIA'), createSubject);
router.post('/import', authorize('ADMIN', 'SECRETARIA'), multer({ storage: multer.memoryStorage() }).single('file'), importSubjects);
router.put('/:id', authorize('ADMIN', 'SECRETARIA'), updateSubject);
router.delete('/:id', authorize('ADMIN'), deleteSubject);

export default router;

