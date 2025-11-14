import { useState, useEffect } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';

const GeneralSettings = () => {
  const [activeSchoolYear, setActiveSchoolYear] = useState(null);
  const [schoolYears, setSchoolYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSchoolYearModal, setShowSchoolYearModal] = useState(false);
  const [editingSchoolYear, setEditingSchoolYear] = useState(null);
  const [formData, setFormData] = useState({
    ano: new Date().getFullYear(),
    nombre: '',
    fechaInicio: '',
    fechaFin: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [schoolYearsRes, activeSchoolYearRes] = await Promise.all([
        api.get('/school-years?limit=100').catch(() => ({ data: { data: [] } })),
        api.get('/school-years/active').catch(() => ({ data: null })),
      ]);

      setSchoolYears(schoolYearsRes.data.data || []);
      // Manejar tanto null como objeto vacío
      if (activeSchoolYearRes && activeSchoolYearRes.data && activeSchoolYearRes.data !== null) {
        setActiveSchoolYear(activeSchoolYearRes.data);
      } else {
        setActiveSchoolYear(null);
      }
    } catch (error) {
      console.error('Error al cargar datos:', error);
      // No mostrar error si es solo que no hay año activo
      if (error.response?.status !== 404) {
        toast.error('Error al cargar datos');
      }
      setActiveSchoolYear(null);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Validar que las fechas estén presentes
      if (!formData.fechaInicio || !formData.fechaFin) {
        toast.error('Por favor completa todas las fechas');
        return;
      }

      // Validar que la fecha fin sea posterior a la fecha inicio
      const fechaInicio = new Date(formData.fechaInicio);
      const fechaFin = new Date(formData.fechaFin);
      
      if (fechaFin <= fechaInicio) {
        toast.error('La fecha de fin debe ser posterior a la fecha de inicio');
        return;
      }

      // Validar que el año esté presente
      if (!formData.ano) {
        toast.error('Por favor ingresa el año');
        return;
      }

      const data = {
        ano: parseInt(formData.ano),
        nombre: formData.nombre.trim() || undefined, // Opcional, se generará automáticamente
        fechaInicio: formData.fechaInicio, // Enviar como YYYY-MM-DD, el backend lo manejará
        fechaFin: formData.fechaFin, // Enviar como YYYY-MM-DD, el backend lo manejará
      };

      console.log('Datos a enviar:', data);

      if (editingSchoolYear) {
        await api.put(`/school-years/${editingSchoolYear.id}`, data);
        toast.success('Año escolar actualizado exitosamente');
      } else {
        await api.post('/school-years', data);
        toast.success('Año escolar creado exitosamente');
      }

      setShowSchoolYearModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error al guardar año escolar:', error);
      console.error('Respuesta del servidor:', error.response?.data);
      
      // Mostrar detalles del error de validación
      let errorMessage = 'Error al guardar año escolar';
      if (error.response?.data) {
        // Si hay detalles de validación, mostrar todos
        if (error.response.data.details && Array.isArray(error.response.data.details)) {
          const detailMessages = error.response.data.details.map(d => {
            const path = d.path?.join('.') || '';
            const fieldName = path === 'nombre' ? 'Nombre' : 
                            path === 'fechaInicio' ? 'Fecha Inicio' : 
                            path === 'fechaFin' ? 'Fecha Fin' : path;
            return `${fieldName ? fieldName + ': ' : ''}${d.message}`;
          }).join('\n');
          if (detailMessages) {
            errorMessage = detailMessages;
          } else if (error.response.data.error) {
            errorMessage = error.response.data.error;
          }
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error;
        }
      }
      
      // Mostrar error en múltiples líneas si es necesario
      toast.error(errorMessage, { duration: 5000 });
    }
  };

  const handleEdit = (schoolYear) => {
    setEditingSchoolYear(schoolYear);
    setFormData({
      ano: schoolYear.ano || new Date().getFullYear(),
      nombre: schoolYear.nombre || '',
      fechaInicio: schoolYear.fechaInicio 
        ? new Date(schoolYear.fechaInicio).toISOString().split('T')[0]
        : '',
      fechaFin: schoolYear.fechaFin 
        ? new Date(schoolYear.fechaFin).toISOString().split('T')[0]
        : '',
    });
    setShowSchoolYearModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este año escolar? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await api.delete(`/school-years/${id}`);
      toast.success('Año escolar eliminado exitosamente');
      fetchData();
    } catch (error) {
      console.error('Error al eliminar año escolar:', error);
      toast.error(error.response?.data?.error || 'Error al eliminar año escolar');
    }
  };

  const resetForm = () => {
    setFormData({
      ano: new Date().getFullYear(),
      nombre: '',
      fechaInicio: '',
      fechaFin: '',
    });
    setEditingSchoolYear(null);
  };

  const handleCloseModal = () => {
    setShowSchoolYearModal(false);
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
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Configuración General</h1>
      </div>

      {/* Año Escolar Activo */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Año Escolar Activo</h2>
        {activeSchoolYear ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Año Escolar</label>
                <p className="mt-1 text-lg font-semibold text-primary-600">{activeSchoolYear.nombre}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Fecha Inicio</label>
                <p className="mt-1 text-gray-900">
                  {new Date(activeSchoolYear.fechaInicio).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Fecha Fin</label>
                <p className="mt-1 text-gray-900">
                  {new Date(activeSchoolYear.fechaFin).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <p className="text-sm text-blue-800">
                <strong>Nota:</strong> Este es el año escolar activo que se utilizará para crear cursos y asignar estudiantes. 
                Los períodos solo se usan para ingresar calificaciones.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <p className="text-sm text-yellow-800">
              <strong>Advertencia:</strong> No hay un año escolar activo configurado. 
              Por favor, crea un año escolar y actívalo para poder crear cursos y asignar estudiantes.
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
              <button
                onClick={() => {
                  resetForm();
                  setShowSchoolYearModal(true);
                }}
                className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 whitespace-nowrap"
              >
                Nuevo Año Escolar
              </button>
            </div>
          </div>
        )}

        {schoolYears.length === 0 && (
          <div className="mt-4">
            <button
              onClick={() => {
                resetForm();
                setShowSchoolYearModal(true);
              }}
              className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
            >
              Crear Primer Año Escolar
            </button>
          </div>
        )}
      </div>

      {/* Lista de Años Escolares */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Años Escolares</h2>
          <button
            onClick={() => {
              resetForm();
              setShowSchoolYearModal(true);
            }}
            className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 text-sm"
          >
            Nuevo Año Escolar
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Año Escolar</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Inicio</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Fin</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {schoolYears.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                    No hay años escolares registrados
                  </td>
                </tr>
              ) : (
                schoolYears.map((sy) => (
                  <tr key={sy.id} className={sy.activo ? 'bg-primary-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{sy.nombre}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(sy.fechaInicio).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(sy.fechaFin).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {sy.activo ? (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          Activo
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {!sy.activo && (
                        <button
                          onClick={() => handleSetActiveSchoolYear(sy.id)}
                          className="text-primary-600 hover:text-primary-900 mr-4"
                        >
                          Activar
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(sy)}
                        className="text-primary-600 hover:text-primary-900 mr-4"
                      >
                        Editar
                      </button>
                      {!sy.activo && (
                        <button
                          onClick={() => handleDelete(sy.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para crear/editar año escolar */}
      {showSchoolYearModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingSchoolYear ? 'Editar Año Escolar' : 'Nuevo Año Escolar'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Año <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="2000"
                  max="2100"
                  value={formData.ano}
                  onChange={(e) => {
                    const ano = parseInt(e.target.value) || new Date().getFullYear();
                    const nombre = `${ano}-${ano + 1}`;
                    setFormData({ ...formData, ano, nombre });
                  }}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Ej: 2025"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Ingresa el año del año escolar (ej: 2025)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Nombre del Año Escolar <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  readOnly
                  value={formData.nombre}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                  placeholder="Se genera automáticamente"
                />
                <p className="mt-1 text-xs text-gray-500">
                  El nombre se genera automáticamente desde el año (ej: 2025-2026)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Fecha Inicio <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.fechaInicio}
                    onChange={(e) => setFormData({ ...formData, fechaInicio: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Fecha Fin <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.fechaFin}
                    onChange={(e) => setFormData({ ...formData, fechaFin: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <p className="text-sm text-blue-800">
                  <strong>Importante:</strong> Después de crear el año escolar, recuerda activarlo para que se utilice 
                  como el año escolar activo del sistema.
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
                  {editingSchoolYear ? 'Actualizar' : 'Crear Año Escolar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeneralSettings;

