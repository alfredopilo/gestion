import prisma from '../config/database.js';

/**
 * Middleware para registrar accesos con una acción específica
 * @param {string} action - La acción a registrar
 * @returns {Function} Middleware function
 */
export const logAccess = (action) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id || null;
      const email = req.user?.email || req.body?.email || null;
      const ipAddress = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress;
      const userAgent = req.get('user-agent');
      
      await prisma.accessLog.create({
        data: {
          userId,
          email,
          action,
          ipAddress,
          userAgent,
          details: {
            path: req.path,
            method: req.method,
            body: sanitizeBody(req.body),
          },
        },
      });
    } catch (error) {
      console.error('Error al registrar log de acceso:', error);
      // No interrumpir el flujo si falla el logging
    }
    next();
  };
};

/**
 * Función para registrar acciones directamente
 * @param {string} userId - ID del usuario
 * @param {string} action - Acción realizada
 * @param {object} details - Detalles adicionales
 * @param {object} req - Request object (opcional, para obtener IP y userAgent)
 */
export const logAction = async (userId, action, details = {}, req = null) => {
  try {
    const logData = {
      userId,
      action,
      details,
      timestamp: new Date(),
    };
    
    // Si se proporciona el request, agregar IP y userAgent
    if (req) {
      logData.ipAddress = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress;
      logData.userAgent = req.get('user-agent');
      if (details.email) {
        logData.email = details.email;
      }
    }
    
    await prisma.accessLog.create({
      data: logData,
    });
  } catch (error) {
    console.error('Error al registrar acción:', error);
  }
};

/**
 * Función para registrar intentos fallidos de login
 * @param {string} email - Email del usuario que intentó iniciar sesión
 * @param {string} error - Mensaje de error
 * @param {object} req - Request object
 */
export const logLoginFailed = async (email, error, req) => {
  try {
    await prisma.accessLog.create({
      data: {
        userId: null,
        email,
        action: 'LOGIN_FAILED',
        ipAddress: req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress,
        userAgent: req.get('user-agent'),
        details: {
          error: error,
          path: req.path,
          method: req.method,
        },
      },
    });
  } catch (err) {
    console.error('Error al registrar login fallido:', err);
  }
};

/**
 * Sanitizar el body del request para no guardar información sensible
 * @param {object} body - Body del request
 * @returns {object} Body sanitizado
 */
function sanitizeBody(body) {
  if (!body) return null;
  
  const sanitized = { ...body };
  
  // Lista de campos sensibles a eliminar
  const sensitiveFields = ['password', 'passwordHash', 'token', 'accessToken', 'refreshToken'];
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

/**
 * Middleware global para registrar todas las peticiones importantes
 */
export const globalLogger = async (req, res, next) => {
  // Solo registrar peticiones POST, PUT, DELETE (modificaciones)
  const methodsToLog = ['POST', 'PUT', 'DELETE'];
  
  if (methodsToLog.includes(req.method) && req.user) {
    const action = `${req.method}_${req.path.replace(/\//g, '_').toUpperCase()}`;
    
    try {
      await prisma.accessLog.create({
        data: {
          userId: req.user.id,
          email: req.user.email,
          action,
          ipAddress: req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress,
          userAgent: req.get('user-agent'),
          details: {
            path: req.path,
            method: req.method,
            body: sanitizeBody(req.body),
          },
        },
      });
    } catch (error) {
      console.error('Error en global logger:', error);
    }
  }
  
  next();
};

export default {
  logAccess,
  logAction,
  logLoginFailed,
  globalLogger,
};
