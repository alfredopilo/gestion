import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  getAllPermissions,
  createPermission,
  updatePermission,
  deletePermission,
  getRolePermissions,
  updateRolePermissions,
  getModules,
  getActions,
} from '../controllers/permissionController.js';

const router = express.Router();

/**
 * @swagger
 * /permissions:
 *   get:
 *     summary: Obtener todos los permisos
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 */
router.get('/permissions', authenticate, authorize('ADMIN'), getAllPermissions);

/**
 * @swagger
 * /permissions:
 *   post:
 *     summary: Crear un nuevo permiso
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 */
router.post('/permissions', authenticate, authorize('ADMIN'), createPermission);

/**
 * @swagger
 * /permissions/:id:
 *   put:
 *     summary: Actualizar un permiso
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 */
router.put('/permissions/:id', authenticate, authorize('ADMIN'), updatePermission);

/**
 * @swagger
 * /permissions/:id:
 *   delete:
 *     summary: Eliminar un permiso
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/permissions/:id', authenticate, authorize('ADMIN'), deletePermission);

/**
 * @swagger
 * /permissions/role/:rol:
 *   get:
 *     summary: Obtener permisos de un rol
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 */
router.get('/permissions/role/:rol', authenticate, authorize('ADMIN'), getRolePermissions);

/**
 * @swagger
 * /permissions/role/:rol:
 *   put:
 *     summary: Actualizar permisos de un rol
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 */
router.put('/permissions/role/:rol', authenticate, authorize('ADMIN'), updateRolePermissions);

/**
 * @swagger
 * /permissions/modules:
 *   get:
 *     summary: Obtener módulos disponibles
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 */
router.get('/permissions/modules', authenticate, authorize('ADMIN'), getModules);

/**
 * @swagger
 * /permissions/actions:
 *   get:
 *     summary: Obtener acciones disponibles
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 */
router.get('/permissions/actions', authenticate, authorize('ADMIN'), getActions);

export default router;
