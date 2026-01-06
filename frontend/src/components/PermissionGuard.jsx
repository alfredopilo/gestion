import PropTypes from 'prop-types';
import { usePermissions } from '../hooks/usePermissions';

/**
 * Componente que renderiza children solo si el usuario tiene los permisos necesarios
 * @param {Object} props
 * @param {string} props.modulo - El módulo a verificar (ej: 'estudiantes')
 * @param {string} props.accion - La acción a verificar (ej: 'ver', 'crear', 'editar')
 * @param {Array<{modulo: string, accion: string}>} props.anyPermissions - Lista de permisos (renderiza si tiene alguno)
 * @param {Array<{modulo: string, accion: string}>} props.allPermissions - Lista de permisos (renderiza si tiene todos)
 * @param {React.ReactNode} props.children - Contenido a renderizar si tiene permisos
 * @param {React.ReactNode} props.fallback - Contenido alternativo a renderizar si NO tiene permisos
 */
const PermissionGuard = ({ 
  modulo, 
  accion, 
  anyPermissions, 
  allPermissions, 
  children, 
  fallback = null 
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  let hasAccess = false;

  // Verificar permiso simple
  if (modulo && accion) {
    hasAccess = hasPermission(modulo, accion);
  }
  // Verificar si tiene alguno de los permisos
  else if (anyPermissions && anyPermissions.length > 0) {
    hasAccess = hasAnyPermission(anyPermissions);
  }
  // Verificar si tiene todos los permisos
  else if (allPermissions && allPermissions.length > 0) {
    hasAccess = hasAllPermissions(allPermissions);
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

PermissionGuard.propTypes = {
  modulo: PropTypes.string,
  accion: PropTypes.string,
  anyPermissions: PropTypes.arrayOf(
    PropTypes.shape({
      modulo: PropTypes.string.isRequired,
      accion: PropTypes.string.isRequired,
    })
  ),
  allPermissions: PropTypes.arrayOf(
    PropTypes.shape({
      modulo: PropTypes.string.isRequired,
      accion: PropTypes.string.isRequired,
    })
  ),
  children: PropTypes.node.isRequired,
  fallback: PropTypes.node,
};

export default PermissionGuard;
