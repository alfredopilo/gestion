import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const MisTareas = () => {
  const { user } = useAuth();
  const [tareas, setTareas] = useState([]);
  const [pendientes, setPendientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInsumo, setSelectedInsumo] = useState(null);
  const [archivo, setArchivo] = useState(null);
  const [observaciones, setObservaciones] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchTareas();
  }, []);

  const fetchTareas = async () => {
    try {
      const response = await api.get('/tareas/mis-tareas');
      setTareas(response.data.data || []);
      setPendientes(response.data.pendientes || []);
    } catch (error) {
      console.error('Error al cargar tareas:', error);
      toast.error('Error al cargar las tareas');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validar tamaño (2 MB)
      if (file.size > 2 * 1024 * 1024) {
        toast.error('El archivo no puede ser mayor a 2 MB');
        e.target.value = '';
        return;
      }
      setArchivo(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedInsumo || !archivo) {
      toast.error('Por favor selecciona un insumo y un archivo');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('archivo', archivo);
      formData.append('insumoId', selectedInsumo.id);
      if (observaciones) {
        formData.append('observaciones', observaciones);
      }

      await api.post('/tareas/upload', formData);
      toast.success('Tarea subida exitosamente');
      setSelectedInsumo(null);
      setArchivo(null);
      setObservaciones('');
      // Limpiar el input de archivo
      const fileInput = document.getElementById('archivo-input');
      if (fileInput) fileInput.value = '';
      fetchTareas();
    } catch (error) {
      console.error('Error al subir tarea:', error);
      const errorMessage =
        error.response?.data?.error || 'Error al subir la tarea';
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (tareaId) => {
    try {
      const response = await api.get(`/tareas/${tareaId}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      // Obtener el nombre del archivo desde el header
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'tarea.pdf';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error al descargar archivo:', error);
      toast.error('Error al descargar el archivo');
    }
  };

  const getEstadoColor = (estado) => {
    const colors = {
      PENDIENTE: 'bg-yellow-100 text-yellow-800',
      ENTREGADA: 'bg-blue-100 text-blue-800',
      CALIFICADA: 'bg-green-100 text-green-800',
    };
    return colors[estado] || 'bg-gray-100 text-gray-800';
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Mis Tareas</h1>
        <p className="mt-2 text-gray-600">
          Gestiona tus entregas de tareas
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <span className="ml-4 text-gray-600">Cargando tareas...</span>
        </div>
      ) : (
        <>
          {/* Tareas Pendientes */}
          {pendientes.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">
                Tareas Pendientes ({pendientes.length})
              </h2>
              <div className="space-y-4">
                {pendientes.map((insumo) => (
                  <div
                    key={insumo.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">
                          {insumo.nombre}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {insumo.materia?.nombre} - {insumo.curso?.nombre}
                        </p>
                        {insumo.descripcion && (
                          <p className="text-sm text-gray-500 mt-2">
                            {insumo.descripcion}
                          </p>
                        )}
                        <div className="mt-2 text-sm text-gray-500">
                          <span>
                            Fecha de entrega:{' '}
                            {insumo.fechaEntrega
                              ? new Date(
                                  insumo.fechaEntrega
                                ).toLocaleDateString('es-ES')
                              : 'Sin fecha límite'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedInsumo(insumo)}
                        className="ml-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        Subir Tarea
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Modal de Subida */}
          {selectedInsumo && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h3 className="text-xl font-semibold mb-4">
                  Subir Tarea: {selectedInsumo.nombre}
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Archivo (máximo 2 MB)
                    </label>
                    <input
                      id="archivo-input"
                      type="file"
                      onChange={handleFileSelect}
                      accept=".pdf,.doc,.docx,.txt,.rtf,.odt"
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                      required
                    />
                    {archivo && (
                      <p className="mt-2 text-sm text-gray-600">
                        Archivo seleccionado: {archivo.name} (
                        {formatFileSize(archivo.size)})
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Observaciones (opcional)
                    </label>
                    <textarea
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedInsumo(null);
                        setArchivo(null);
                        setObservaciones('');
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={uploading || !archivo}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploading ? 'Subiendo...' : 'Subir Tarea'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Tareas Entregadas */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">
              Tareas Entregadas ({tareas.length})
            </h2>
            {tareas.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">
                  No has entregado ninguna tarea aún
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tarea
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Materia
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Curso
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha de Entrega
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {tareas.map((tarea) => (
                      <tr key={tarea.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {tarea.insumo?.nombre}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {tarea.insumo?.materia?.nombre}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {tarea.insumo?.curso?.nombre}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {new Date(
                              tarea.fechaEntrega
                            ).toLocaleDateString('es-ES')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getEstadoColor(
                              tarea.estado
                            )}`}
                          >
                            {tarea.estado}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleDownload(tarea.id)}
                            className="text-primary-600 hover:text-primary-900"
                          >
                            Descargar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default MisTareas;

