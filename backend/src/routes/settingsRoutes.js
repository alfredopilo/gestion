import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { getMaintenanceStatus, setMaintenanceMode } from '../controllers/settingsController.js';

const router = express.Router();

/**
 * @swagger
 * /settings/maintenance:
 *   get:
 *     summary: Obtener estado del modo de mantenimiento
 *     tags: [Settings]
 *     description: Endpoint público que retorna el estado actual del modo de mantenimiento
 *     responses:
 *       200:
 *         description: Estado del modo de mantenimiento
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 maintenanceMode:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router.get('/maintenance', getMaintenanceStatus);

/**
 * @swagger
 * /settings/maintenance:
 *   put:
 *     summary: Activar o desactivar el modo de mantenimiento
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     description: Solo usuarios ADMIN pueden cambiar esta configuración
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - enabled
 *             properties:
 *               enabled:
 *                 type: boolean
 *                 description: true para activar, false para desactivar
 *     responses:
 *       200:
 *         description: Configuración actualizada exitosamente
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos suficientes
 */
router.put('/maintenance', authenticate, authorize('ADMIN'), setMaintenanceMode);

export default router;
