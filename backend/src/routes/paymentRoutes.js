import express from 'express';
import {
  getPayments,
  getPaymentById,
  createPayment,
  updatePayment,
  getStudentAccount,
} from '../controllers/paymentController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getPayments);
router.get('/student/:estudianteId', getStudentAccount);
router.get('/:id', getPaymentById);
router.post('/', authorize('ADMIN', 'SECRETARIA'), createPayment);
router.put('/:id', authorize('ADMIN', 'SECRETARIA'), updatePayment);

export default router;

