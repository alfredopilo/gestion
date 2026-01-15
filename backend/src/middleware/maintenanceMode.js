import prisma from '../config/database.js';

const MAINTENANCE_MODE_KEY = 'MAINTENANCE_MODE';

// Cache para evitar consultas excesivas a la base de datos
let maintenanceCache = {
  value: null,
  lastCheck: null,
  ttl: 5000, // 5 segundos de cache
};

/**
 * Verificar si el modo de mantenimiento está activo
 * Utiliza cache para evitar consultas excesivas
 */
const isMaintenanceModeActive = async () => {
  const now = Date.now();
  
  // Si hay cache válido, usarlo
  if (
    maintenanceCache.value !== null &&
    maintenanceCache.lastCheck &&
    now - maintenanceCache.lastCheck < maintenanceCache.ttl
  ) {
    return maintenanceCache.value;
  }

  try {
    const setting = await prisma.setting.findUnique({
      where: { clave: MAINTENANCE_MODE_KEY },
    });

    const isActive = setting?.valor === 'true';
    
    // Actualizar cache
    maintenanceCache = {
      value: isActive,
      lastCheck: now,
      ttl: 5000,
    };

    return isActive;
  } catch (error) {
    console.error('Error al verificar modo de mantenimiento:', error);
    // En caso de error, asumir que no está en mantenimiento
    return false;
  }
};

/**
 * Middleware para verificar el modo de mantenimiento
 * Se aplica después de la autenticación
 * 
 * - Si el sistema está en mantenimiento y el usuario NO es ADMIN: retorna 503
 * - Si el sistema está en mantenimiento y el usuario ES ADMIN: continúa
 * - Si el sistema NO está en mantenimiento: continúa normalmente
 */
export const checkMaintenanceModeMiddleware = async (req, res, next) => {
  try {
    const isMaintenanceActive = await isMaintenanceModeActive();

    if (isMaintenanceActive) {
      // Si el usuario está autenticado y es ADMIN, permitir acceso
      if (req.user && req.user.rol === 'ADMIN') {
        return next();
      }

      // Para cualquier otro caso, denegar acceso
      return res.status(503).json({
        error: 'Sistema en mantenimiento',
        message: 'El sistema se encuentra en modo de mantenimiento. Solo los administradores pueden acceder en este momento.',
        maintenanceMode: true,
      });
    }

    // Si no está en mantenimiento, continuar normalmente
    next();
  } catch (error) {
    console.error('Error en middleware de mantenimiento:', error);
    // En caso de error, permitir continuar para no bloquear el sistema
    next();
  }
};

/**
 * Limpiar la cache del modo de mantenimiento
 * Útil cuando se cambia el estado del modo de mantenimiento
 */
export const clearMaintenanceCache = () => {
  maintenanceCache = {
    value: null,
    lastCheck: null,
    ttl: 5000,
  };
};

export default checkMaintenanceModeMiddleware;
