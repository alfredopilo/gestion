import prisma from '../config/database.js';
import { logAction } from '../middleware/logging.js';

const MAINTENANCE_MODE_KEY = 'MAINTENANCE_MODE';

/**
 * Obtener el estado del modo de mantenimiento
 * Este endpoint es público (no requiere autenticación)
 */
export const getMaintenanceStatus = async (req, res, next) => {
  try {
    const setting = await prisma.setting.findUnique({
      where: { clave: MAINTENANCE_MODE_KEY },
    });

    const isMaintenanceMode = setting?.valor === 'true';

    res.json({
      maintenanceMode: isMaintenanceMode,
      message: isMaintenanceMode 
        ? 'El sistema se encuentra en modo de mantenimiento. Solo los administradores pueden acceder.'
        : null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Activar o desactivar el modo de mantenimiento
 * Solo usuarios ADMIN pueden realizar esta acción
 */
export const setMaintenanceMode = async (req, res, next) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        error: 'El campo "enabled" es requerido y debe ser un booleano.',
      });
    }

    // Upsert: crear si no existe, actualizar si existe
    const setting = await prisma.setting.upsert({
      where: { clave: MAINTENANCE_MODE_KEY },
      update: {
        valor: enabled.toString(),
        updatedAt: new Date(),
      },
      create: {
        id: crypto.randomUUID(),
        clave: MAINTENANCE_MODE_KEY,
        valor: enabled.toString(),
        descripcion: 'Modo de mantenimiento del sistema. Cuando está activo, solo los administradores pueden acceder.',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Registrar la acción en el log
    await logAction(req.user.id, enabled ? 'MAINTENANCE_MODE_ON' : 'MAINTENANCE_MODE_OFF', {
      userId: req.user.id,
      email: req.user.email,
      enabled,
    }, req);

    res.json({
      success: true,
      maintenanceMode: setting.valor === 'true',
      message: enabled 
        ? 'Modo de mantenimiento activado. Solo los administradores podrán acceder al sistema.'
        : 'Modo de mantenimiento desactivado. Todos los usuarios pueden acceder al sistema.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Función auxiliar para verificar el estado del modo de mantenimiento
 * Usada por otros middlewares
 */
export const checkMaintenanceMode = async () => {
  try {
    const setting = await prisma.setting.findUnique({
      where: { clave: MAINTENANCE_MODE_KEY },
    });
    return setting?.valor === 'true';
  } catch (error) {
    console.error('Error al verificar modo de mantenimiento:', error);
    return false;
  }
};
