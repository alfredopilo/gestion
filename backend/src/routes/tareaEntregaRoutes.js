import express from 'express';
import {
  uploadTarea,
  getMisTareas,
  getEntregasPorInsumo,
  calificarEntrega,
  downloadTarea,
} from '../controllers/tareaEntregaController.js';
import { authenticate } from '../middleware/auth.js';
import { uploadTarea as uploadMiddleware } from '../middleware/uploadTarea.js';

const router = express.Router();

/**
 * @route   POST /api/v1/tareas/upload
 * @desc    Subir archivo de tarea
 * @access  Private (Estudiante)
 */
router.post('/upload', authenticate, uploadMiddleware.single('archivo'), uploadTarea);

/**
 * @route   GET /api/v1/tareas/mis-tareas
 * @desc    Obtener tareas del estudiante autenticado
 * @access  Private (Estudiante)
 */
router.get('/mis-tareas', authenticate, getMisTareas);

/**
 * @route   GET /api/v1/tareas/insumo/:insumoId
 * @desc    Obtener entregas por insumo (para profesores)
 * @access  Private (Profesor, Admin)
 */
router.get('/insumo/:insumoId', authenticate, getEntregasPorInsumo);

/**
 * @route   PATCH /api/v1/tareas/:id/calificar
 * @desc    Calificar entrega (para profesores)
 * @access  Private (Profesor, Admin)
 */
router.patch('/:id/calificar', authenticate, calificarEntrega);

/**
 * @route   GET /api/v1/tareas/:id/download
 * @desc    Descargar archivo de tarea
 * @access  Private (Estudiante dueño, Profesor, Admin)
 */
router.get('/:id/download', authenticate, downloadTarea);

export default router;

