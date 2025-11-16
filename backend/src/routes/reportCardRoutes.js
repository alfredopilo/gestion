import express from 'express';
import { getReportCards } from '../controllers/reportCardController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getReportCards);

export default router;

