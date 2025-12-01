import express from 'express';
import { getReportCards } from '../controllers/reportCardController.js';
import { getHistoricalReportCards, getStudentSchoolYears } from '../controllers/historicalReportCardController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getReportCards);
router.get('/historical', getHistoricalReportCards);

export default router;

