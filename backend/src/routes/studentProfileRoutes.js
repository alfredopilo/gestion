import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  getSections,
  createSection,
  updateSection,
  deleteSection,
  createField,
  updateField,
  deleteField,
  getStudentProfile,
  updateStudentProfile,
  uploadImage,
} from '../controllers/studentProfileController.js';
import { upload, serveStudentProfileImages } from '../middleware/upload.js';

const router = express.Router();

router.use(authenticate);

router.get('/sections', getSections);
router.post('/sections', authorize(['ADMIN', 'SECRETARIA']), createSection);
router.put('/sections/:id', authorize(['ADMIN', 'SECRETARIA']), updateSection);
router.delete('/sections/:id', authorize(['ADMIN', 'SECRETARIA']), deleteSection);

router.post('/sections/:sectionId/fields', authorize(['ADMIN', 'SECRETARIA']), createField);
router.put('/fields/:id', authorize(['ADMIN', 'SECRETARIA']), updateField);
router.delete('/fields/:id', authorize(['ADMIN', 'SECRETARIA']), deleteField);

router.get(
  '/students/:studentId',
  authorize(['ADMIN', 'SECRETARIA', 'PROFESOR', 'REPRESENTANTE']),
  getStudentProfile
);
router.put(
  '/students/:studentId',
  authorize(['ADMIN', 'SECRETARIA', 'PROFESOR']),
  updateStudentProfile
);

// Endpoint para subir imágenes
router.post(
  '/upload-image',
  authorize(['ADMIN', 'SECRETARIA', 'PROFESOR']),
  upload.single('image'),
  uploadImage
);

// Endpoint para servir imágenes
router.get('/images/:filename', serveStudentProfileImages);

export default router;

