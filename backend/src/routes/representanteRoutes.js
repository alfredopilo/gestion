import express from 'express';
import {
  getMyStudents,
  getStudentInsumos,
  getStudentGrades,
  getStudentSummary,
  getStudentReportCard,
  getStudentGradeReport,
  searchStudents,
  searchRepresentantes,
  associateStudent,
  disassociateStudent,
} from '../controllers/representanteController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Rutas para representantes
router.get('/my-students', authorize('REPRESENTANTE'), getMyStudents);
router.get('/students/:studentId/summary', authorize('REPRESENTANTE'), getStudentSummary);
router.get('/students/:studentId/insumos', authorize('REPRESENTANTE'), getStudentInsumos);
router.get('/students/:studentId/grades', authorize('REPRESENTANTE'), getStudentGrades);
router.get('/students/:studentId/report-card', authorize('REPRESENTANTE'), getStudentReportCard);
router.get('/students/:studentId/grade-report', authorize('REPRESENTANTE'), getStudentGradeReport);

// Rutas para asociación de estudiantes (solo admin/secretaría)
router.get('/search-students', authorize(['ADMIN', 'SECRETARIA']), searchStudents);
router.get('/search-representantes', authorize(['ADMIN', 'SECRETARIA']), searchRepresentantes);
router.post('/students/:studentId/associate', authorize(['ADMIN', 'SECRETARIA']), associateStudent);
router.delete('/students/:studentId/associate', authorize(['ADMIN', 'SECRETARIA']), disassociateStudent);

export default router;
