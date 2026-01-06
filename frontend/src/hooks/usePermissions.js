import { useAuth } from '../contexts/AuthContext';

/**
 * Hook personalizado para verificar permisos del usuario
 * @returns {Object} - Objeto con funciones y datos de permisos
 */
export const usePermissions = () => {
  const { user } = useAuth();

  /**
   * Verifica si el usuario tiene un permiso específico
   * @param {string} modulo - El módulo a verificar (ej: 'estudiantes', 'calificaciones')
   * @param {string} accion - La acción a verificar (ej: 'ver', 'crear', 'editar', 'eliminar')
   * @returns {boolean} - true si el usuario tiene el permiso
   */
  const hasPermission = (modulo, accion) => {
    // Admin siempre tiene todos los permisos
    if (user?.rol === 'ADMIN') {
      return true;
    }

    // Verificar si el usuario tiene el permiso específico
    return user?.permissions?.some(
      p => p.modulo === modulo && p.accion === accion
    ) || false;
  };

  /**
   * Verifica si el usuario tiene alguno de los permisos especificados
   * @param {Array<{modulo: string, accion: string}>} permissionsList - Lista de permisos a verificar
   * @returns {boolean} - true si el usuario tiene al menos uno de los permisos
   */
  const hasAnyPermission = (permissionsList) => {
    if (user?.rol === 'ADMIN') {
      return true;
    }

    return permissionsList.some(({ modulo, accion }) => 
      hasPermission(modulo, accion)
    );
  };

  /**
   * Verifica si el usuario tiene todos los permisos especificados
   * @param {Array<{modulo: string, accion: string}>} permissionsList - Lista de permisos a verificar
   * @returns {boolean} - true si el usuario tiene todos los permisos
   */
  const hasAllPermissions = (permissionsList) => {
    if (user?.rol === 'ADMIN') {
      return true;
    }

    return permissionsList.every(({ modulo, accion }) => 
      hasPermission(modulo, accion)
    );
  };

  /**
   * Obtiene todos los permisos del usuario
   * @returns {Array} - Array de permisos del usuario
   */
  const getPermissions = () => {
    return user?.permissions || [];
  };

  /**
   * Obtiene permisos filtrados por módulo
   * @param {string} modulo - El módulo a filtrar
   * @returns {Array} - Array de permisos del módulo
   */
  const getPermissionsByModule = (modulo) => {
    return user?.permissions?.filter(p => p.modulo === modulo) || [];
  };

  /**
   * Verifica si el usuario puede realizar alguna acción en un módulo
   * @param {string} modulo - El módulo a verificar
   * @returns {boolean} - true si el usuario tiene al menos un permiso en el módulo
   */
  const canAccessModule = (modulo) => {
    if (user?.rol === 'ADMIN') {
      return true;
    }

    return user?.permissions?.some(p => p.modulo === modulo) || false;
  };

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    getPermissions,
    getPermissionsByModule,
    canAccessModule,
    permissions: user?.permissions || [],
    isAdmin: user?.rol === 'ADMIN',
  };
};
