import { useState, useEffect } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { compressImageToDataUrl, formatFileSize } from '../utils/imageCompression';

const normalizeLogoValue = (logo) => {
  if (!logo) return '';
  const value = String(logo).trim();
  if (!value) return '';
  if (value.startsWith('data:')) return value;
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/')) return value;

  // Si parece base64 sin prefijo, inferir mime por cabecera típica
  const cleaned = value.replace(/\s/g, '');
  const isBase64Like = /^[A-Za-z0-9+/]+={0,2}$/.test(cleaned);
  if (!isBase64Like) return value;

  let mime = 'image/png';
  if (cleaned.startsWith('/9j/')) mime = 'image/jpeg';
  else if (cleaned.startsWith('iVBORw0KGgo')) mime = 'image/png';
  else if (cleaned.startsWith('R0lGOD')) mime = 'image/gif';
  else if (cleaned.startsWith('UklGR')) mime = 'image/webp';

  return `data:${mime};base64,${cleaned}`;
};

const InstitutionSettings = () => {
  const [institutions, setInstitutions] = useState([]);
  const [activeInstitution, setActiveInstitution] = useState(null);
  const [activeSchoolYear, setActiveSchoolYear] = useState(null);
  const [schoolYears, setSchoolYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingInstitution, setEditingInstitution] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    codigo: '',
    logo: '',
    direccion: '',
    telefono: '',
    email: '',
    rector: '',
    activa: true,
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [compressing, setCompressing] = useState(false);
  const [originalSize, setOriginalSize] = useState(0);
  const [compressedSize, setCompressedSize] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [institutionsRes, activeRes, schoolYearsRes, activeSchoolYearRes] = await Promise.all([
        api.get('/institutions'),
        api.get('/institutions/active').catch(() => null),
        api.get('/school-years?limit=100').catch(() => ({ data: { data: [] } })),
        api.get('/school-years/active').catch(() => null),
      ]);

      setInstitutions(institutionsRes.data.data || []);
      if (activeRes && activeRes.data) {
        setActiveInstitution(activeRes.data);
      }
      setSchoolYears(schoolYearsRes.data.data || []);
      if (activeSchoolYearRes && activeSchoolYearRes.data) {
        setActiveSchoolYear(activeSchoolYearRes.data);
      }
    } catch (error) {
      console.error('Error al cargar datos:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleSetActiveSchoolYear = async (schoolYearId) => {
    try {
      await api.post(`/school-years/${schoolYearId}/activate`);
      toast.success('Año escolar activo actualizado exitosamente');
      fetchData();
    } catch (error) {
      console.error('Error al establecer año escolar activo:', error);
      toast.error(error.response?.data?.error || 'Error al establecer año escolar activo');
    }
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona un archivo de imagen válido');
      return;
    }

    setLogoFile(file);
    setOriginalSize(file.size);
    setCompressing(true);

    try {
      // Comprimir imagen a dataURL (base64) con parámetros más agresivos
      const { dataUrl, bytes } = await compressImageToDataUrl(file, {
        maxWidth: 600,
        maxHeight: 600,
        quality: 0.7,
        maxSizeKB: 300, // 300KB máximo para asegurar que pase el límite
      });

      // Mostrar preview
      setLogoPreview(dataUrl);
      setFormData({ ...formData, logo: dataUrl });
      setCompressedSize(bytes);

      toast.success(
        `Imagen comprimida: ${formatFileSize(file.size)} → ${formatFileSize(bytes)}`
      );
    } catch (error) {
      console.error('Error al comprimir imagen:', error);
      toast.error(error.message || 'Error al comprimir la imagen');
      setLogoFile(null);
      setLogoPreview('');
      setOriginalSize(0);
      setCompressedSize(0);
    } finally {
      setCompressing(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview('');
    setFormData({ ...formData, logo: '' });
    setOriginalSize(0);
    setCompressedSize(0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Asegurar que logo sea siempre un string o null
      let logoValue = null;
      if (formData.logo) {
        // Si es un string, usarlo directamente
        if (typeof formData.logo === 'string') {
          logoValue = formData.logo.trim() || null;
        } 
        // Si es un objeto (por ejemplo, File o Blob), usar logoPreview si está disponible
        else if (typeof formData.logo === 'object') {
          // Si hay logoPreview, usar ese (ya está en base64)
          logoValue = (logoPreview && typeof logoPreview === 'string') ? logoPreview : null;
        }
      } else if (logoPreview && typeof logoPreview === 'string') {
        // Si no hay logo en formData pero hay preview, usar el preview
        logoValue = logoPreview;
      }
      
      const data = {
        nombre: formData.nombre,
        codigo: formData.codigo || null,
        logo: logoValue,
        direccion: formData.direccion || null,
        telefono: formData.telefono || null,
        email: formData.email || null,
        rector: formData.rector || null,
        activa: formData.activa,
      };

      if (editingInstitution) {
        await api.put(`/institutions/${editingInstitution.id}`, data);
        toast.success('Institución actualizada exitosamente');
      } else {
        await api.post('/institutions', data);
        toast.success('Institución creada exitosamente');
      }

      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error al guardar institución:', error);
      toast.error(error.response?.data?.error || 'Error al guardar institución');
    }
  };

  const handleEdit = (institution) => {
    setEditingInstitution(institution);
    const logoString = normalizeLogoValue(institution.logo);
    
    setFormData({
      nombre: institution.nombre || '',
      codigo: institution.codigo || '',
      logo: logoString,
      direccion: institution.direccion || '',
      telefono: institution.telefono || '',
      email: institution.email || '',
      rector: institution.rector || '',
      activa: institution.activa ?? true,
    });
    setLogoFile(null);
    setLogoPreview(logoString);
    setOriginalSize(0);
    setCompressedSize(0);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar esta institución? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await api.delete(`/institutions/${id}`);
      toast.success('Institución eliminada exitosamente');
      fetchData();
    } catch (error) {
      console.error('Error al eliminar institución:', error);
      toast.error(error.response?.data?.error || 'Error al eliminar institución');
    }
  };

  const handleActivate = async (id) => {
    try {
      await api.post(`/institutions/${id}/activate`);
      toast.success('Institución activada exitosamente');
      fetchData();
    } catch (error) {
      console.error('Error al activar institución:', error);
      toast.error(error.response?.data?.error || 'Error al activar institución');
    }
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      codigo: '',
      logo: '',
      direccion: '',
      telefono: '',
      email: '',
      rector: '',
      activa: true,
    });
    setLogoFile(null);
    setLogoPreview('');
    setOriginalSize(0);
    setCompressedSize(0);
    setEditingInstitution(null);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        <span className="ml-4 text-gray-600">Cargando...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Configuración de Institución</h1>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
        >
          Nueva Institución
        </button>
      </div>

      {/* Configuración General - Año Escolar Activo */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Año Escolar Activo</h2>
        {activeSchoolYear ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Año Escolar</label>
                <p className="mt-1 text-lg font-semibold text-gray-900">{activeSchoolYear.nombre}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Fecha Inicio</label>
                <p className="mt-1 text-gray-900">
                  {new Date(activeSchoolYear.fechaInicio).toLocaleDateString('es-ES')}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Fecha Fin</label>
                <p className="mt-1 text-gray-900">
                  {new Date(activeSchoolYear.fechaFin).toLocaleDateString('es-ES')}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              <strong>Nota:</strong> Este es el año escolar activo que se utilizará para crear cursos y asignar estudiantes. 
              Los períodos solo se usan para ingresar calificaciones.
            </p>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <p className="text-sm text-yellow-800">
              <strong>Advertencia:</strong> No hay un año escolar activo configurado. 
              Por favor, configura un año escolar activo para poder crear cursos y asignar estudiantes.
            </p>
          </div>
        )}

        {/* Selector de Año Escolar Activo */}
        {schoolYears.length > 0 && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cambiar Año Escolar Activo
            </label>
            <div className="flex gap-2">
              <select
                value={activeSchoolYear?.id || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    handleSetActiveSchoolYear(e.target.value);
                  }
                }}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Seleccionar año escolar...</option>
                {schoolYears.map((sy) => (
                  <option key={sy.id} value={sy.id}>
                    {sy.nombre} {sy.activo && '(Activo)'}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Institución Activa */}
      {activeInstitution && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Institución Activa</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nombre</label>
              <p className="mt-1 text-gray-900">{activeInstitution.nombre}</p>
            </div>
            {activeInstitution.codigo && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Código</label>
                <p className="mt-1 text-gray-900">{activeInstitution.codigo}</p>
              </div>
            )}
            {activeInstitution.rector && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Rector</label>
                <p className="mt-1 text-gray-900">{activeInstitution.rector}</p>
              </div>
            )}
            {activeInstitution.email && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-gray-900">{activeInstitution.email}</p>
              </div>
            )}
            {activeInstitution.telefono && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                <p className="mt-1 text-gray-900">{activeInstitution.telefono}</p>
              </div>
            )}
            {activeInstitution.direccion && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Dirección</label>
                <p className="mt-1 text-gray-900">{activeInstitution.direccion}</p>
              </div>
            )}
            {activeInstitution.logo && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Logo</label>
                <img src={activeInstitution.logo} alt="Logo" className="mt-2 h-20 object-contain" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lista de Instituciones */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rector</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {institutions.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                    No hay instituciones registradas
                  </td>
                </tr>
              ) : (
                institutions.map((institution) => (
                  <tr key={institution.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap font-medium">{institution.nombre}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{institution.codigo || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{institution.rector || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {institution.activa ? (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          Activa
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                          Inactiva
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {!institution.activa && (
                        <button
                          onClick={() => handleActivate(institution.id)}
                          className="text-green-600 hover:text-green-900 mr-4"
                        >
                          Activar
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(institution)}
                        className="text-primary-600 hover:text-primary-900 mr-4"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(institution.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingInstitution ? 'Editar Institución' : 'Nueva Institución'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                  placeholder="Nombre de la institución"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Código</label>
                  <input
                    type="text"
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Código de la institución"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Rector</label>
                  <input
                    type="text"
                    value={formData.rector}
                    onChange={(e) => setFormData({ ...formData, rector: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Nombre del rector"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Logo de la Institución
                </label>
                
                {/* Input de archivo */}
                <div className="mt-1 flex items-center space-x-4">
                  <label className="cursor-pointer">
                    <span className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                      {compressing ? 'Comprimiendo...' : 'Seleccionar Imagen'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      disabled={compressing}
                      className="hidden"
                    />
                  </label>
                  
                  {logoPreview && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Eliminar
                    </button>
                  )}
                </div>

                {/* Información de compresión */}
                {originalSize > 0 && compressedSize > 0 && (
                  <div className="mt-2 text-xs text-gray-500">
                    <p>
                      Tamaño original: <span className="font-medium">{formatFileSize(originalSize)}</span>
                    </p>
                    <p>
                      Tamaño comprimido: <span className="font-medium text-green-600">{formatFileSize(compressedSize)}</span>
                      {' '}({Math.round((1 - compressedSize / originalSize) * 100)}% reducción)
                    </p>
                  </div>
                )}

                {/* Preview de imagen */}
                {(logoPreview || formData.logo) && (
                  <div className="mt-3">
                    <img
                      src={logoPreview || formData.logo}
                      alt="Preview del logo"
                      className="h-32 object-contain border border-gray-300 rounded-md p-2 bg-gray-50"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      La imagen será comprimida automáticamente para optimizar el almacenamiento
                    </p>
                  </div>
                )}

                {/* Mensaje de ayuda */}
                {!logoPreview && !formData.logo && (
                  <p className="mt-1 text-xs text-gray-500">
                    Formatos soportados: JPG, PNG, GIF. Máximo 10MB. La imagen se comprimirá automáticamente.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="institucion@ejemplo.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                  <input
                    type="text"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="0999999999"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Dirección</label>
                <textarea
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  rows="3"
                  placeholder="Dirección completa"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="activa"
                  checked={formData.activa}
                  onChange={(e) => setFormData({ ...formData, activa: e.target.checked })}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="activa" className="ml-2 block text-sm text-gray-900">
                  Activar esta institución
                </label>
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
                  {editingInstitution ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstitutionSettings;

