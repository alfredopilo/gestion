import express from 'express';
import {
  getAttendance,
  createAttendance,
  bulkCreateAttendance,
  getAttendanceSummary,
} from '../controllers/attendanceController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getAttendance);
router.get('/summary', getAttendanceSummary);
router.post('/', authorize('PROFESOR', 'ADMIN', 'SECRETARIA'), createAttendance);
router.post('/bulk', authorize('PROFESOR', 'ADMIN', 'SECRETARIA'), bulkCreateAttendance);

export default router;

