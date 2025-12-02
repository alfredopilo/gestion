import express from 'express';
import {
  preparePromotionPreview,
  executePromotion,
} from '../controllers/promotionController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Generar vista previa de la promoción
router.get(
  '/preview/:institucionId',
  authorize('ADMIN'),
  preparePromotionPreview
);

// Ejecutar la promoción escolar
router.post(
  '/execute',
  authorize('ADMIN'),
  executePromotion
);

export default router;

