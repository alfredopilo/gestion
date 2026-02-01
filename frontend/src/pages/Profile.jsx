import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const Profile = () => {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    email: '',
    numeroIdentificacion: '',
    telefono: '',
    direccion: '',
    password: '',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/auth/profile');
      setProfile(response.data);
      
      // Manejar valores null/undefined correctamente
      const data = response.data || {};
      setFormData({
        nombre: data.nombre ?? '',
        apellido: data.apellido ?? '',
        email: data.email ?? '',
        numeroIdentificacion: data.numeroIdentificacion ?? '',
        telefono: data.telefono ?? '',
        direccion: data.direccion ?? '',
        password: '',
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Error al cargar perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      // Preparar datos para enviar (solo enviar campos que hayan cambiado y password solo si no está vacío)
      const updateData = { ...formData };
      if (!updateData.password) {
        delete updateData.password;
      }
      
      const response = await api.put('/auth/profile', updateData);
      
      toast.success('Perfil actualizado exitosamente');
      
      // Refrescar el perfil completo para obtener todos los datos actualizados
      await fetchProfile();
      setEditing(false);
      
      // Actualizar el contexto de autenticación si es necesario
      if (updateData.email && updateData.email !== profile?.email) {
        // El email cambió, podrías querer actualizar el contexto
        window.location.reload(); // O manejar de otra manera
      }
    } catch (error) {
      console.error('Error al actualizar perfil:', error);
      toast.error(error.response?.data?.error || 'Error al actualizar perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setFormData({
      nombre: profile?.nombre ?? '',
      apellido: profile?.apellido ?? '',
      email: profile?.email ?? '',
      numeroIdentificacion: profile?.numeroIdentificacion ?? '',
      telefono: profile?.telefono ?? '',
      direccion: profile?.direccion ?? '',
      password: '',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Mi Perfil</h1>
        {!editing && (
          <button
            onClick={() => {
              // Asegurar que los datos estén actualizados antes de editar
              if (profile) {
                setFormData({
                  nombre: profile.nombre ?? '',
                  apellido: profile.apellido ?? '',
                  email: profile.email ?? '',
                  numeroIdentificacion: profile.numeroIdentificacion ?? '',
                  telefono: profile.telefono ?? '',
                  direccion: profile.direccion ?? '',
                  password: '',
                });
              }
              setEditing(true);
            }}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            Editar Perfil
          </button>
        )}
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        {editing ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="nombre" className="block text-sm font-medium text-gray-700">
                  Nombre *
                </label>
                <input
                  type="text"
                  id="nombre"
                  name="nombre"
                  required
                  value={formData.nombre ?? ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                />
              </div>

              <div>
                <label htmlFor="apellido" className="block text-sm font-medium text-gray-700">
                  Apellido *
                </label>
                <input
                  type="text"
                  id="apellido"
                  name="apellido"
                  required
                  value={formData.apellido ?? ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={formData.email ?? ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                />
              </div>

              <div>
                <label htmlFor="numeroIdentificacion" className="block text-sm font-medium text-gray-700">
                  Número de Identificación *
                </label>
                <input
                  type="text"
                  id="numeroIdentificacion"
                  name="numeroIdentificacion"
                  required
                  value={formData.numeroIdentificacion ?? ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                />
              </div>

              <div>
                <label htmlFor="telefono" className="block text-sm font-medium text-gray-700">
                  Teléfono
                </label>
                <input
                  type="tel"
                  id="telefono"
                  name="telefono"
                  value={formData.telefono ?? ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                />
              </div>

              <div>
                <label htmlFor="direccion" className="block text-sm font-medium text-gray-700">
                  Dirección
                </label>
                <input
                  type="text"
                  id="direccion"
                  name="direccion"
                  value={formData.direccion ?? ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Nueva Contraseña (dejar vacío para no cambiar)
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Mínimo 6 caracteres"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-2 border"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nombre</label>
                <p className="mt-1 text-gray-900">{profile?.nombre} {profile?.apellido}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-gray-900">{profile?.email}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Número de Identificación</label>
                <p className="mt-1 text-gray-900">{profile?.numeroIdentificacion || 'No disponible'}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Rol</label>
                <p className="mt-1 text-gray-900">{profile?.rol}</p>
              </div>
              
              {profile?.telefono && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                  <p className="mt-1 text-gray-900">{profile.telefono}</p>
                </div>
              )}
              
              {profile?.direccion && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Dirección</label>
                  <p className="mt-1 text-gray-900">{profile.direccion}</p>
                </div>
              )}

              {/* Mostrar grupo solo lectura si es estudiante */}
              {profile?.student?.grupo && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Grupo (No editable)</label>
                  <p className="mt-1 text-gray-900">
                    {profile.student.grupo.nombre} - {profile.student.grupo.periodo?.nombre || 'Sin período'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
