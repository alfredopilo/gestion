import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';

/**
 * Middleware para verificar el token JWT
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'No autorizado. Token no proporcionado.' 
      });
    }

    const token = authHeader.substring(7); // Remover "Bearer "

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Verificar que el usuario existe y está activo
      const userRecord = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          nombre: true,
          apellido: true,
          email: true,
          rol: true,
          estado: true,
          institucionId: true,
          institucion: {
            select: {
              id: true,
              nombre: true,
              activa: true,
            },
          },
          userInstitutions: {
            select: {
              institucionId: true,
              institucion: {
                select: {
                  id: true,
                  nombre: true,
                  activa: true,
                },
              },
            },
          },
        },
      });

      if (!userRecord || userRecord.estado !== 'ACTIVO') {
        return res.status(401).json({ 
          error: 'Usuario inactivo o no encontrado.' 
        });
      }

      const instituciones = [];
      if (userRecord.institucion) {
        instituciones.push({
          id: userRecord.institucion.id,
          nombre: userRecord.institucion.nombre,
          activa: userRecord.institucion.activa,
        });
      }

      if (userRecord.userInstitutions?.length) {
        for (const ui of userRecord.userInstitutions) {
          const inst = ui.institucion ?? null;
          const instId = inst?.id || ui.institucionId;
          if (!instId) continue;
          if (!instituciones.some(existing => existing.id === instId)) {
            instituciones.push({
              id: instId,
              nombre: inst?.nombre ?? null,
              activa: inst?.activa ?? null,
            });
          }
        }
      }

      const accessibleInstitutionIds = new Set(
        instituciones
          .map(inst => inst?.id)
          .filter(Boolean)
      );
      if (userRecord.institucionId) {
        accessibleInstitutionIds.add(userRecord.institucionId);
      }

      // Cargar permisos del rol del usuario
      const rolePermissions = await prisma.rolePermission.findMany({
        where: { rol: userRecord.rol },
        include: {
          permission: true,
        },
      });

      const permissions = rolePermissions.map(rp => rp.permission);

      req.user = {
        id: userRecord.id,
        nombre: userRecord.nombre,
        apellido: userRecord.apellido,
        email: userRecord.email,
        rol: userRecord.rol,
        estado: userRecord.estado,
        institucionId: userRecord.institucionId,
        institucion: userRecord.institucion ?? null,
        instituciones,
        accessibleInstitutionIds: Array.from(accessibleInstitutionIds),
        permissions,
      };

      // Obtener institución activa del sistema
      const activeInstitution = await prisma.institution.findFirst({
        where: { activa: true },
        select: {
          id: true,
          nombre: true,
        },
      });

      // Verificar si hay una institución seleccionada en el header
      const selectedInstitutionId = req.headers['x-institution-id'];
      
      // Prioridad: institución del header > institución del usuario > institución activa
      if (selectedInstitutionId) {
        // Verificar que el usuario tiene acceso a esta institución
        if (
          req.user.rol === 'ADMIN' ||
          accessibleInstitutionIds.has(selectedInstitutionId) ||
          selectedInstitutionId === activeInstitution?.id
        ) {
          req.institutionId = selectedInstitutionId;
        } else {
          // Si no tiene acceso, usar la del usuario o activa
          req.institutionId =
            req.user.institucionId ||
            req.user.accessibleInstitutionIds?.[0] ||
            activeInstitution?.id ||
            null;
        }
      } else {
        // Si no hay header, usar SOLO la del usuario (NO usar activa como fallback)
        // Esto evita que se mezclen datos entre instituciones
        req.institutionId =
          req.user.institucionId ||
          req.user.accessibleInstitutionIds?.[0] ||
          null;
      }
      
      req.activeInstitution = activeInstitution;

      next();
    } catch (error) {
      return res.status(401).json({ 
        error: 'Token inválido o expirado.' 
      });
    }
  } catch (error) {
    console.error('Error en autenticación:', error);
    return res.status(500).json({ 
      error: 'Error en el servidor de autenticación.' 
    });
  }
};

/**
 * Middleware para verificar roles
 * Acepta múltiples argumentos o un array de roles
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Usuario no autenticado.' 
      });
    }

    // Aplanar roles en caso de que se pase un array
    const rolesArray = roles.length === 1 && Array.isArray(roles[0]) 
      ? roles[0] 
      : roles;

    if (!rolesArray.includes(req.user.rol)) {
      return res.status(403).json({ 
        error: 'No tienes permisos para realizar esta acción.' 
      });
    }

    next();
  };
};

/**
 * Middleware para verificar permisos específicos
 * @param {string} modulo - El módulo a verificar (ej: 'estudiantes', 'calificaciones')
 * @param {string} accion - La acción a verificar (ej: 'ver', 'crear', 'editar', 'eliminar')
 */
export const checkPermission = (modulo, accion) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Usuario no autenticado.' 
      });
    }

    // Admin siempre tiene todos los permisos
    if (req.user.rol === 'ADMIN') {
      return next();
    }

    // Verificar si el usuario tiene el permiso específico
    const hasPermission = req.user.permissions?.some(
      p => p.modulo === modulo && p.accion === accion
    );

    if (!hasPermission) {
      return res.status(403).json({ 
        error: `No tienes permiso para ${accion} en el módulo ${modulo}.` 
      });
    }

    next();
  };
};
