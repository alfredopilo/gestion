import express from 'express';
import multer from 'multer';
import {
  getCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  assignStudentToCourse,
  removeStudentFromCourse,
  getAvailableStudents,
  promoteStudents,
  importStudents,
  getImportStudentsTemplate,
  getImportCoursesTemplate,
  importCourses,
} from '../controllers/courseController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getCourses);
router.get('/available-students', authorize('ADMIN', 'SECRETARIA'), getAvailableStudents);
router.get('/import-template', authorize('ADMIN', 'SECRETARIA'), getImportStudentsTemplate);
router.get('/import-template-courses', authorize('ADMIN', 'SECRETARIA'), getImportCoursesTemplate);
router.get('/:id', getCourseById);

// Solo admin puede gestionar cursos
router.post('/', authorize('ADMIN', 'SECRETARIA'), createCourse);
router.post('/import', authorize('ADMIN', 'SECRETARIA'), multer({ storage: multer.memoryStorage() }).single('file'), importCourses);
router.put('/:id', authorize('ADMIN', 'SECRETARIA'), updateCourse);
router.delete('/:id', authorize('ADMIN'), deleteCourse);

// Gestión de estudiantes en cursos
router.post('/:id/students', authorize('ADMIN', 'SECRETARIA'), assignStudentToCourse);
router.delete('/:id/students/:estudianteId', authorize('ADMIN', 'SECRETARIA'), removeStudentFromCourse);
router.post('/:id/import-students', authorize('ADMIN', 'SECRETARIA'), importStudents);

// Promoción de estudiantes
router.post('/:id/promote', authorize('ADMIN', 'SECRETARIA'), promoteStudents);

export default router;

