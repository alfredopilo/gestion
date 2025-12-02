import express from 'express';
import {
  downloadBackup,
  uploadBackup,
} from '../controllers/backupController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import uploadBackupMiddleware from '../middleware/uploadBackup.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Descargar backup de la base de datos (solo ADMIN)
router.get(
  '/download',
  authorize('ADMIN'),
  downloadBackup
);

// Subir y restaurar backup de la base de datos (solo ADMIN)
// Nota: multer debe estar después de authorize para validar permisos primero
router.post(
  '/upload',
  authorize('ADMIN'),
  uploadBackupMiddleware.single('backup'),
  uploadBackup
);

export default router;

