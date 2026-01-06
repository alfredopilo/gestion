import { useState, useEffect } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';

const PermissionManagement = () => {
  const [activeTab, setActiveTab] = useState('permissions'); // 'permissions' o 'roles'
  const [permissions, setPermissions] = useState([]);
  const [filteredPermissions, setFilteredPermissions] = useState([]);
  const [modules, setModules] = useState([]);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedModule, setSelectedModule] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  
  // Estado para crear/editar permisos
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [currentPermission, setCurrentPermission] = useState(null);
  const [permissionForm, setPermissionForm] = useState({
    nombre: '',
    descripcion: '',
    modulo: '',
    accion: '',
  });

  // Estado para gestión de permisos por rol
  const [selectedRole, setSelectedRole] = useState('ADMIN');
  const [rolePermissions, setRolePermissions] = useState([]);
  const [selectedPermissions, setSelectedPermissions] = useState(new Set());

  const roles = [
    { value: 'ADMIN', label: 'Administrador' },
    { value: 'PROFESOR', label: 'Profesor' },
    { value: 'ESTUDIANTE', label: 'Estudiante' },
    { value: 'REPRESENTANTE', label: 'Representante' },
    { value: 'SECRETARIA', label: 'Secretaria' },
  ];

  useEffect(() => {
    fetchPermissions();
    fetchModules();
    fetchActions();
  }, []);

  useEffect(() => {
    filterPermissions();
  }, [permissions, selectedModule, selectedAction]);

  useEffect(() => {
    if (activeTab === 'roles') {
      fetchRolePermissions();
    }
  }, [selectedRole, activeTab]);

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const response = await api.get('/permissions?limit=1000');
      setPermissions(response.data.permissions);
    } catch (error) {
      console.error('Error al cargar permisos:', error);
      toast.error('Error al cargar permisos');
    } finally {
      setLoading(false);
    }
  };

  const fetchModules = async () => {
    try {
      const response = await api.get('/permissions/modules');
      setModules(response.data);
    } catch (error) {
      console.error('Error al cargar módulos:', error);
    }
  };

  const fetchActions = async () => {
    try {
      const response = await api.get('/permissions/actions');
      setActions(response.data);
    } catch (error) {
      console.error('Error al cargar acciones:', error);
    }
  };

  const fetchRolePermissions = async () => {
    try {
      const response = await api.get(`/permissions/role/${selectedRole}`);
      setRolePermissions(response.data.permissions);
      setSelectedPermissions(new Set(response.data.permissions.map(p => p.id)));
    } catch (error) {
      console.error('Error al cargar permisos del rol:', error);
      toast.error('Error al cargar permisos del rol');
    }
  };

  const filterPermissions = () => {
    let filtered = [...permissions];
    
    if (selectedModule) {
      filtered = filtered.filter(p => p.modulo === selectedModule);
    }
    
    if (selectedAction) {
      filtered = filtered.filter(p => p.accion === selectedAction);
    }
    
    setFilteredPermissions(filtered);
  };

  const handleCreatePermission = () => {
    setCurrentPermission(null);
    setPermissionForm({
      nombre: '',
      descripcion: '',
      modulo: '',
      accion: '',
    });
    setShowPermissionModal(true);
  };

  const handleEditPermission = (permission) => {
    setCurrentPermission(permission);
    setPermissionForm({
      nombre: permission.nombre,
      descripcion: permission.descripcion || '',
      modulo: permission.modulo,
      accion: permission.accion,
    });
    setShowPermissionModal(true);
  };

  const handleSavePermission = async (e) => {
    e.preventDefault();
    
    try {
      if (currentPermission) {
        await api.put(`/permissions/${currentPermission.id}`, permissionForm);
        toast.success('Permiso actualizado correctamente');
      } else {
        await api.post('/permissions', permissionForm);
        toast.success('Permiso creado correctamente');
      }
      
      setShowPermissionModal(false);
      fetchPermissions();
      fetchModules();
      fetchActions();
    } catch (error) {
      console.error('Error al guardar permiso:', error);
      toast.error(error.response?.data?.error || 'Error al guardar permiso');
    }
  };

  const handleDeletePermission = async (permissionId) => {
    if (!confirm('¿Está seguro de eliminar este permiso?')) return;
    
    try {
      await api.delete(`/permissions/${permissionId}`);
      toast.success('Permiso eliminado correctamente');
      fetchPermissions();
    } catch (error) {
      console.error('Error al eliminar permiso:', error);
      toast.error('Error al eliminar permiso');
    }
  };

  const handleTogglePermission = (permissionId) => {
    const newSelected = new Set(selectedPermissions);
    if (newSelected.has(permissionId)) {
      newSelected.delete(permissionId);
    } else {
      newSelected.add(permissionId);
    }
    setSelectedPermissions(newSelected);
  };

  const handleSaveRolePermissions = async () => {
    try {
      await api.put(`/permissions/role/${selectedRole}`, {
        permissions: Array.from(selectedPermissions),
      });
      toast.success('Permisos del rol actualizados correctamente');
      fetchRolePermissions();
    } catch (error) {
      console.error('Error al actualizar permisos del rol:', error);
      toast.error('Error al actualizar permisos del rol');
    }
  };

  // Agrupar permisos por módulo
  const permissionsByModule = filteredPermissions.reduce((acc, permission) => {
    if (!acc[permission.modulo]) {
      acc[permission.modulo] = [];
    }
    acc[permission.modulo].push(permission);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Permisos</h1>
          <p className="mt-2 text-gray-600">Administre los permisos del sistema y asígnelos a roles</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('permissions')}
            className={`${
              activeTab === 'permissions'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Permisos
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`${
              activeTab === 'roles'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Permisos por Rol
          </button>
        </nav>
      </div>

      {/* Contenido de la pestaña Permisos */}
      {activeTab === 'permissions' && (
        <div className="space-y-4">
          {/* Filtros y botón crear */}
          <div className="bg-white p-4 rounded-lg shadow-soft flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filtrar por Módulo
              </label>
              <select
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
                className="input-field"
              >
                <option value="">Todos los módulos</option>
                {modules.map((module) => (
                  <option key={module} value={module}>
                    {module}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filtrar por Acción
              </label>
              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
                className="input-field"
              >
                <option value="">Todas las acciones</option>
                {actions.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleCreatePermission}
              className="btn-primary"
            >
              + Nuevo Permiso
            </button>
          </div>

          {/* Lista de permisos agrupados por módulo */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.keys(permissionsByModule).map((module) => (
                <div key={module} className="bg-white rounded-lg shadow-soft overflow-hidden">
                  <div className="px-6 py-4 bg-gradient-to-r from-primary-600 to-primary-700">
                    <h3 className="text-lg font-semibold text-white capitalize">
                      {module}
                    </h3>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {permissionsByModule[module].map((permission) => (
                        <div
                          key={permission.id}
                          className="border border-gray-200 rounded-lg p-4 hover:border-primary-300 hover:shadow-md transition-all"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                              {permission.accion}
                            </span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditPermission(permission)}
                                className="text-primary-600 hover:text-primary-800 transition-colors"
                                title="Editar"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeletePermission(permission.id)}
                                className="text-danger-600 hover:text-danger-800 transition-colors"
                                title="Eliminar"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          <h4 className="font-medium text-gray-900 mb-1">{permission.nombre}</h4>
                          {permission.descripcion && (
                            <p className="text-sm text-gray-600">{permission.descripcion}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Contenido de la pestaña Permisos por Rol */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          {/* Selector de rol */}
          <div className="bg-white p-4 rounded-lg shadow-soft flex justify-between items-center">
            <div className="flex-1 max-w-md">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Seleccione un Rol
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="input-field"
              >
                {roles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleSaveRolePermissions}
              className="btn-primary"
            >
              Guardar Cambios
            </button>
          </div>

          {/* Lista de permisos con checkboxes */}
          <div className="bg-white rounded-lg shadow-soft p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Permisos para {roles.find(r => r.value === selectedRole)?.label}
            </h3>
            
            <div className="space-y-6">
              {modules.map((module) => {
                const modulePermissions = permissions.filter(p => p.modulo === module);
                return (
                  <div key={module} className="border-b border-gray-200 pb-4">
                    <h4 className="font-medium text-gray-900 mb-3 capitalize">{module}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {modulePermissions.map((permission) => (
                        <label
                          key={permission.id}
                          className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedPermissions.has(permission.id)}
                            onChange={() => handleTogglePermission(permission.id)}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                          />
                          <span className="flex-1">
                            <span className="text-sm font-medium text-gray-900">{permission.nombre}</span>
                            {permission.descripcion && (
                              <span className="block text-xs text-gray-500">{permission.descripcion}</span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal para crear/editar permiso */}
      {showPermissionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {currentPermission ? 'Editar Permiso' : 'Nuevo Permiso'}
              </h3>
            </div>

            <form onSubmit={handleSavePermission} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={permissionForm.nombre}
                  onChange={(e) => setPermissionForm({ ...permissionForm, nombre: e.target.value })}
                  className="input-field"
                  required
                  placeholder="ej: ver_estudiantes"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <textarea
                  value={permissionForm.descripcion}
                  onChange={(e) => setPermissionForm({ ...permissionForm, descripcion: e.target.value })}
                  className="input-field"
                  rows="2"
                  placeholder="Descripción del permiso"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Módulo *
                </label>
                <input
                  type="text"
                  value={permissionForm.modulo}
                  onChange={(e) => setPermissionForm({ ...permissionForm, modulo: e.target.value })}
                  className="input-field"
                  required
                  placeholder="ej: estudiantes, calificaciones"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Acción *
                </label>
                <input
                  type="text"
                  value={permissionForm.accion}
                  onChange={(e) => setPermissionForm({ ...permissionForm, accion: e.target.value })}
                  className="input-field"
                  required
                  placeholder="ej: ver, crear, editar, eliminar"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPermissionModal(false)}
                  className="btn-outline"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  {currentPermission ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PermissionManagement;
