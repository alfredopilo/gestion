import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  enviarMensaje,
  getMensajesRecibidos,
  countMensajesNoLeidos,
  marcarComoLeido,
  getEstudiantesPorCurso,
  getEstudiantesPorMateria,
  getHistorialEnvios,
  getEstadisticasEnvios,
  getDetalleMensajeEnviado
} from '../controllers/mensajeController.js';

const router = express.Router();

router.use(authenticate);

// Enviar mensaje (PROFESOR, ADMIN, SECRETARIA)
router.post(
  '/enviar',
  authorize(['PROFESOR', 'ADMIN', 'SECRETARIA']),
  enviarMensaje
);

// Obtener estudiantes para envío
router.get(
  '/estudiantes/curso/:cursoId',
  authorize(['PROFESOR', 'ADMIN', 'SECRETARIA']),
  getEstudiantesPorCurso
);

router.get(
  '/estudiantes/materia',
  authorize(['PROFESOR', 'ADMIN', 'SECRETARIA']),
  getEstudiantesPorMateria
);

// Recibir y leer mensajes (todos los roles)
router.get('/recibidos', getMensajesRecibidos);
router.get('/count', countMensajesNoLeidos);
router.patch('/:id/leer', marcarComoLeido);

// NUEVO: Historial de envíos (PROFESOR, ADMIN, SECRETARIA)
router.get(
  '/enviados',
  authorize(['PROFESOR', 'ADMIN', 'SECRETARIA']),
  getHistorialEnvios
);

router.get(
  '/estadisticas',
  authorize(['PROFESOR', 'ADMIN', 'SECRETARIA']),
  getEstadisticasEnvios
);

router.get(
  '/enviados/:id',
  authorize(['PROFESOR', 'ADMIN', 'SECRETARIA']),
  getDetalleMensajeEnviado
);

export default router;
