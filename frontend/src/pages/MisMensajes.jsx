import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';

const MisMensajes = () => {
  const [mensajes, setMensajes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMensaje, setSelectedMensaje] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await api.get('/mensajes/recibidos');
        if (!cancelled) setMensajes(response.data.data ?? []);
      } catch (error) {
        if (!cancelled) toast.error('Error al cargar mensajes');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const fetchMensajes = async () => {
    try {
      const response = await api.get('/mensajes/recibidos');
      setMensajes(response.data.data ?? []);
    } catch (error) {
      toast.error('Error al cargar mensajes');
    } finally {
      setLoading(false);
    }
  };

  const handleDescargarAdjunto = async (mensajeId) => {
    try {
      const response = await api.get(`/mensajes/${mensajeId}/adjunto`, {
        responseType: 'blob'
      });
      
      // Crear URL del blob y descargar
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `adjunto-${mensajeId}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Error al descargar el archivo adjunto');
    }
  };

  const handleOpenMensaje = async (mensaje) => {
    setSelectedMensaje(mensaje);
    setShowModal(true);
    
    if (!mensaje.leido) {
      try {
        await api.patch(`/mensajes/${mensaje.id}/leer`);
        fetchMensajes(); // Actualizar lista
      } catch (error) {
        console.error('Error al marcar como leído');
      }
    }
  };

  const formatFecha = (fecha) => {
    return new Date(fecha).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        <span className="ml-4 text-gray-600">Cargando mensajes...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Mis Mensajes</h1>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {mensajes.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No tienes mensajes
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {mensajes.map((mensaje) => (
              <div
                key={mensaje.id}
                onClick={() => handleOpenMensaje(mensaje)}
                className={`p-4 hover:bg-gray-50 cursor-pointer ${
                  !mensaje.leido ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {!mensaje.leido && (
                        <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                      )}
                      <h3 className={`text-lg ${!mensaje.leido ? 'font-bold' : 'font-semibold'}`}>
                        {mensaje.asunto}
                      </h3>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      De: {mensaje.emisor.nombre} {mensaje.emisor.apellido}
                    </p>
                    <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                      {mensaje.cuerpo}
                    </p>
                    {mensaje.archivoAdjunto && (
                      <div className="mt-2 inline-flex items-center text-xs text-blue-600">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        Tiene archivo adjunto
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 ml-4">
                    {formatFecha(mensaje.fechaEnvio)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Detalle */}
      {showModal && selectedMensaje && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">{selectedMensaje.asunto}</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600">
                De: {selectedMensaje.emisor.nombre} {selectedMensaje.emisor.apellido}
              </p>
              <p className="text-sm text-gray-600">
                Fecha: {formatFecha(selectedMensaje.fechaEnvio)}
              </p>
              {selectedMensaje.archivoAdjunto && (
                <div className="mt-2">
                  <button
                    onClick={() => handleDescargarAdjunto(selectedMensaje.id)}
                    className="inline-flex items-center px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Descargar archivo adjunto
                  </button>
                </div>
              )}
            </div>

            <div className="mb-6 p-4 bg-gray-50 rounded">
              <p className="whitespace-pre-wrap">{selectedMensaje.cuerpo}</p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MisMensajes;
