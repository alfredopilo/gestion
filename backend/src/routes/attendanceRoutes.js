import express from 'express';
import {
  getAttendance,
  createAttendance,
  bulkCreateAttendance,
  getAttendanceSummary,
  getCourseClassesForDate,
} from '../controllers/attendanceController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getAttendance);
router.get('/summary', getAttendanceSummary);
router.get('/course-classes', getCourseClassesForDate);
router.post('/', authorize('PROFESOR', 'ADMIN', 'SECRETARIA'), createAttendance);
router.post('/bulk', authorize('PROFESOR', 'ADMIN', 'SECRETARIA'), bulkCreateAttendance);

export default router;

