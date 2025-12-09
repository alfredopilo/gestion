import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import toast from 'react-hot-toast';

// Iconos SVG inline para evitar dependencias externas
const ArrowLeftIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
  </svg>
);

const ArrowDownTrayIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
);

const PencilSquareIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
  </svg>
);

const TaskReview = () => {
  const { insumoId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [entregas, setEntregas] = useState([]);
  const [insumo, setInsumo] = useState(null);
  
  // Estado para el modal de calificación
  const [showModal, setShowModal] = useState(false);
  const [selectedEntrega, setSelectedEntrega] = useState(null);
  const [formData, setFormData] = useState({
    estado: '',
    observaciones: ''
  });

  useEffect(() => {
    fetchEntregas();
  }, [insumoId]);

  const fetchEntregas = async () => {
    try {
      setLoading(true);
      // Primero obtenemos las entregas
      const response = await api.get(`/tareas/insumo/${insumoId}`);
      setEntregas(response.data.data || []);
      
      // Intentamos obtener información del insumo
      // Podríamos necesitar un endpoint específico o deducirlo de las entregas si el backend lo devuelve
      // Por ahora, si la lista de entregas tiene datos del insumo, tomamos el primero
      if (response.data.data && response.data.data.length > 0) {
        setInsumo(response.data.data[0].insumo);
      } else {
        // Si no hay entregas, deberíamos intentar cargar el insumo por separado para mostrar el título
        try {
           // Asumiendo que existe un endpoint para obtener un insumo por ID
           const insumoRes = await api.get(`/insumos/${insumoId}`);
           // Nota: El endpoint original de insumos puede requerir filtros, 
           // si falla, mostraremos un título genérico.
           if (insumoRes.data && insumoRes.data.data) {
             // Ajustar según la estructura de respuesta de tu API de insumos
             setInsumo(insumoRes.data.data); 
           }
        } catch (err) {
          console.log("No se pudo cargar detalles del insumo vacío", err);
        }
      }

    } catch (error) {
      console.error('Error al cargar entregas:', error);
      toast.error('Error al cargar las entregas');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (entrega) => {
    try {
      const response = await api.get(`/tareas/${entrega.id}/download`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', entrega.archivoNombre);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error al descargar archivo:', error);
      toast.error('Error al descargar el archivo');
    }
  };

  const handleOpenModal = (entrega) => {
    setSelectedEntrega(entrega);
    setFormData({
      estado: entrega.estado,
      observaciones: entrega.observaciones || ''
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedEntrega(null);
  };

  const handleUpdateEntrega = async (e) => {
    e.preventDefault();
    if (!selectedEntrega) return;

    try {
      await api.patch(`/tareas/${selectedEntrega.id}/calificar`, formData);
      toast.success('Entrega actualizada correctamente');
      handleCloseModal();
      fetchEntregas(); // Recargar datos
    } catch (error) {
      console.error('Error al actualizar entrega:', error);
      toast.error('Error al actualizar la entrega');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('es-ES');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/insumos')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5 mr-2" />
          Volver a Insumos
        </button>
        
        <h1 className="text-2xl font-bold text-gray-900">
          Revisión de Tareas: {insumo?.nombre || 'Insumo'}
        </h1>
        {insumo && (
          <p className="text-gray-600 mt-1">
            {insumo.descripcion} - {insumo.curso?.nombre} {insumo.curso?.nivel} {insumo.curso?.paralelo} - {insumo.materia?.nombre}
          </p>
        )}
      </div>

      {/* Tabla de Entregas */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        {entregas.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No hay entregas registradas para este insumo.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estudiante
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha Entrega
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Archivo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Observaciones
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {entregas.map((entrega) => (
                  <tr key={entrega.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {entrega.estudiante?.user?.nombre} {entrega.estudiante?.user?.apellido}
                      </div>
                      <div className="text-sm text-gray-500">
                        {entrega.estudiante?.user?.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(entrega.fechaEntrega)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                      <div className="flex items-center">
                        <span className="truncate max-w-xs" title={entrega.archivoNombre}>
                          {entrega.archivoNombre}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${entrega.estado === 'CALIFICADA' ? 'bg-green-100 text-green-800' : 
                          entrega.estado === 'ENTREGADA' ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-gray-100 text-gray-800'}`}>
                        {entrega.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {entrega.observaciones || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDownload(entrega)}
                        className="text-primary-600 hover:text-primary-900 mr-4"
                        title="Descargar"
                      >
                        <ArrowDownTrayIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleOpenModal(entrega)}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="Calificar/Observar"
                      >
                        <PencilSquareIcon className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Calificación */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="bg-white p-5 border w-full max-w-lg shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Revisar Entrega
              </h3>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-500">
                <span className="text-2xl">&times;</span>
              </button>
            </div>
            
            <form onSubmit={handleUpdateEntrega}>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  Estudiante: <span className="font-semibold">{selectedEntrega?.estudiante?.user?.nombre} {selectedEntrega?.estudiante?.user?.apellido}</span>
                </p>
                <p className="text-sm text-gray-600">
                  Archivo: {selectedEntrega?.archivoNombre}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estado
                </label>
                <select
                  value={formData.estado}
                  onChange={(e) => setFormData({...formData, estado: e.target.value})}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md border"
                >
                  <option value="ENTREGADA">Entregada</option>
                  <option value="CALIFICADA">Calificada</option>
                  <option value="PENDIENTE">Pendiente (Devolver)</option>
                </select>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observaciones
                </label>
                <textarea
                  value={formData.observaciones}
                  onChange={(e) => setFormData({...formData, observaciones: e.target.value})}
                  rows={4}
                  className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md border p-2"
                  placeholder="Escribe tus observaciones aquí..."
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskReview;

