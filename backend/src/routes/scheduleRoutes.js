import express from 'express';
import { getSchedules } from '../controllers/scheduleController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getSchedules);

export default router;

