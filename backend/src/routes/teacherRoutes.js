import express from 'express';
import { getTeachers, getMyAssignments } from '../controllers/teacherController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getTeachers);
router.get('/my-assignments', getMyAssignments);

export default router;

