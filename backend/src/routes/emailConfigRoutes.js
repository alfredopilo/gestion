import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  getEmailConfig,
  createOrUpdateEmailConfig,
  testEmailConfig
} from '../controllers/emailConfigController.js';

const router = express.Router();

router.use(authenticate);
router.use(authorize(['ADMIN']));

router.get('/', getEmailConfig);
router.post('/', createOrUpdateEmailConfig);
router.post('/test', testEmailConfig);

export default router;
