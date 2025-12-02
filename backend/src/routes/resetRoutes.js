import express from 'express';
import { resetDatabaseEndpoint } from '../controllers/resetController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Restablecer base de datos (solo ADMIN)
router.post(
  '/database',
  authorize('ADMIN'),
  resetDatabaseEndpoint
);

export default router;

