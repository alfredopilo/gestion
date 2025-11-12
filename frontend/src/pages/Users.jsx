import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const Users = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [filters, setFilters] = useState({
    rol: '',
    estado: '',
  });
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    email: '',
    numeroIdentificacion: '',
    password: '',
    rol: 'ESTUDIANTE',
    telefono: '',
    direccion: '',
    estado: 'ACTIVO',
    instituciones: [], // Array de IDs de instituciones (al menos 1 requerida)
  });
  const [institutions, setInstitutions] = useState([]);

  useEffect(() => {
    fetchUsers();
    fetchInstitutions();
  }, [filters]);

  const fetchInstitutions = async () => {
    try {
      const response = await api.get('/institutions?limit=100');
      setInstitutions(response.data.data || []);
    } catch (error) {
      console.error('Error al cargar instituciones:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.rol) params.append('rol', filters.rol);
      if (filters.estado) params.append('estado', filters.estado);
      params.append('limit', '100');

      const response = await api.get(`/users?${params.toString()}`);
      setUsers(response.data.data || []);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        // Actualizar usuario (sin contraseña si no se proporciona)
        const updateData = { ...formData };
        if (!updateData.password) {
          delete updateData.password;
        }
        delete updateData.password; // No se puede actualizar la contraseña desde aquí
        await api.put(`/users/${editingUser.id}`, updateData);
        toast.success('Usuario actualizado exitosamente');
      } else {
        // Crear usuario - validar que al menos 1 institución esté seleccionada
        if (!formData.instituciones || formData.instituciones.length === 0) {
          toast.error('Debes seleccionar al menos una institución');
          return;
        }
        // Preparar datos sin institucionId (se usará el primero del array instituciones)
        const { institucionId, ...userData } = formData;
        await api.post('/users', userData);
        toast.success('Usuario creado exitosamente');
      }

      setShowModal(false);
      resetForm();
      fetchUsers();
    } catch (error) {
      console.error('Error al guardar usuario:', error);
      toast.error(error.response?.data?.error || 'Error al guardar usuario');
    }
  };

  const handleEdit = async (user) => {
    setEditingUser(user);
    
    // Obtener los datos completos del usuario incluyendo instituciones
    try {
      const userResponse = await api.get(`/users/${user.id}`);
      const userData = userResponse.data;
      const userInstitutions = userData.instituciones?.map(inst => inst.id) || [];
      
      setFormData({
        nombre: userData.nombre || '',
        apellido: userData.apellido || '',
        email: userData.email || '',
        numeroIdentificacion: userData.numeroIdentificacion || '',
        password: '', // No mostrar contraseña
        rol: userData.rol || 'ESTUDIANTE',
        telefono: userData.telefono || '',
        direccion: userData.direccion || '',
        estado: userData.estado || 'ACTIVO',
        instituciones: userInstitutions,
      });
      setShowModal(true);
    } catch (error) {
      console.error('Error al cargar datos del usuario:', error);
      toast.error('Error al cargar los datos del usuario');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este usuario? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await api.delete(`/users/${id}`);
      toast.success('Usuario eliminado exitosamente');
      fetchUsers();
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      toast.error(error.response?.data?.error || 'Error al eliminar usuario');
    }
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      apellido: '',
      email: '',
      numeroIdentificacion: '',
      password: '',
      rol: 'ESTUDIANTE',
      telefono: '',
      direccion: '',
      estado: 'ACTIVO',
      instituciones: [],
    });
    setEditingUser(null);
  };

  const handleInstitutionToggle = (institutionId) => {
    setFormData(prev => {
      const current = prev.instituciones || [];
      const updated = current.includes(institutionId)
        ? current.filter(id => id !== institutionId)
        : [...current, institutionId];
      return { ...prev, instituciones: updated };
    });
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  const getRolBadgeColor = (rol) => {
    const colors = {
      ADMIN: 'bg-red-100 text-red-800',
      PROFESOR: 'bg-blue-100 text-blue-800',
      ESTUDIANTE: 'bg-green-100 text-green-800',
      REPRESENTANTE: 'bg-yellow-100 text-yellow-800',
      SECRETARIA: 'bg-purple-100 text-purple-800',
    };
    return colors[rol] || 'bg-gray-100 text-gray-800';
  };

  const getEstadoBadgeColor = (estado) => {
    const colors = {
      ACTIVO: 'bg-green-100 text-green-800',
      INACTIVO: 'bg-gray-100 text-gray-800',
      SUSPENDIDO: 'bg-red-100 text-red-800',
    };
    return colors[estado] || 'bg-gray-100 text-gray-800';
  };

  const getRolLabel = (rol) => {
    const labels = {
      ADMIN: 'Administrador',
      PROFESOR: 'Profesor',
      ESTUDIANTE: 'Estudiante',
      REPRESENTANTE: 'Representante',
      SECRETARIA: 'Secretaria',
    };
    return labels[rol] || rol;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        <span className="ml-4 text-gray-600">Cargando usuarios...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Gestión de Usuarios</h1>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
        >
          Nuevo Usuario
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filtrar por Rol</label>
            <select
              value={filters.rol}
              onChange={(e) => setFilters({ ...filters, rol: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Todos los roles</option>
              <option value="ADMIN">Administrador</option>
              <option value="PROFESOR">Profesor</option>
              <option value="ESTUDIANTE">Estudiante</option>
              <option value="REPRESENTANTE">Representante</option>
              <option value="SECRETARIA">Secretaria</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filtrar por Estado</label>
            <select
              value={filters.estado}
              onChange={(e) => setFilters({ ...filters, estado: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Todos los estados</option>
              <option value="ACTIVO">Activo</option>
              <option value="INACTIVO">Inactivo</option>
              <option value="SUSPENDIDO">Suspendido</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ rol: '', estado: '' })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm"
            >
              Limpiar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de usuarios */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre Completo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teléfono</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Creación</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                    No hay usuarios registrados
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">
                        {user.nombre} {user.apellido}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.telefono || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getRolBadgeColor(user.rol)}`}>
                        {getRolLabel(user.rol)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getEstadoBadgeColor(user.estado)}`}>
                        {user.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString('es-ES') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEdit(user)}
                        className="text-primary-600 hover:text-primary-900 mr-4"
                      >
                        Editar
                      </button>
                      {user.id !== currentUser?.id && (
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Eliminar
                        </button>
                      )}
                      {user.id === currentUser?.id && (
                        <span className="text-gray-400 text-xs">(Tú)</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para crear/editar usuario */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Nombre"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Apellido <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.apellido}
                    onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Apellido"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="correo@ejemplo.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Número de Identificación <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.numeroIdentificacion}
                    onChange={(e) => setFormData({ ...formData, numeroIdentificacion: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Ej: 1234567890"
                  />
                  <p className="mt-1 text-xs text-gray-500">Único por institución</p>
                </div>
              </div>


              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Ej: 0987654321"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Rol <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.rol}
                    onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    disabled={!!editingUser} // No permitir cambiar rol al editar
                  >
                    <option value="ADMIN">Administrador</option>
                    <option value="PROFESOR">Profesor</option>
                    <option value="ESTUDIANTE">Estudiante</option>
                    <option value="REPRESENTANTE">Representante</option>
                    <option value="SECRETARIA">Secretaria</option>
                  </select>
                </div>
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Contraseña <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    required={!editingUser}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                  />
                  <p className="mt-1 text-xs text-gray-500">Mínimo 6 caracteres</p>
                </div>
              )}

              {editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Estado
                  </label>
                  <select
                    value={formData.estado}
                    onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="ACTIVO">Activo</option>
                    <option value="INACTIVO">Inactivo</option>
                    <option value="SUSPENDIDO">Suspendido</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Dirección
                </label>
                <textarea
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  rows="2"
                  placeholder="Dirección completa"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Instituciones <span className="text-red-500">*</span>
                </label>
                <div className="border border-gray-300 rounded-md p-3 max-h-48 overflow-y-auto">
                  {institutions.length === 0 ? (
                    <p className="text-sm text-gray-500">No hay instituciones disponibles</p>
                  ) : (
                    <div className="space-y-2">
                      {institutions.map((inst) => (
                        <label
                          key={inst.id}
                          className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={formData.instituciones?.includes(inst.id) || false}
                            onChange={() => handleInstitutionToggle(inst.id)}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-sm text-gray-700">
                            {inst.nombre} {inst.activa && '(Activa)'}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Selecciona al menos una institución a la que este usuario tendrá acceso
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                >
                  {editingUser ? 'Actualizar' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;

