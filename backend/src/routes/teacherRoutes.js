import express from 'express';
import { getTeachers } from '../controllers/teacherController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getTeachers);

export default router;

