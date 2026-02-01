import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const HistorialEnvios = () => {
  const { user } = useAuth();
  const [mensajes, setMensajes] = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({
    leido: '',
    tipoMensaje: '',
    fechaDesde: '',
    fechaHasta: ''
  });
  const [selectedMensaje, setSelectedMensaje] = useState(null);
  const [detalleMensaje, setDetalleMensaje] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, [filtros]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (filtros.leido) params.append('leido', filtros.leido);
      if (filtros.tipoMensaje) params.append('tipoMensaje', filtros.tipoMensaje);
      if (filtros.fechaDesde) params.append('fechaDesde', filtros.fechaDesde);
      if (filtros.fechaHasta) params.append('fechaHasta', filtros.fechaHasta);
      
      const [mensajesRes, estadisticasRes] = await Promise.all([
        api.get(`/mensajes/enviados?${params.toString()}`),
        api.get('/mensajes/estadisticas')
      ]);
      
      setMensajes(mensajesRes.data.data);
      setEstadisticas(estadisticasRes.data);
    } catch (error) {
      toast.error('Error al cargar historial');
    } finally {
      setLoading(false);
    }
  };

  const handleVerDetalle = async (mensaje) => {
    try {
      const response = await api.get(`/mensajes/enviados/${mensaje.id}`);
      setDetalleMensaje(response.data);
      setSelectedMensaje(mensaje);
      setShowModal(true);
    } catch (error) {
      toast.error('Error al cargar detalle del mensaje');
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

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Historial de Mensajes Enviados</h1>

      {/* Tarjetas de Estadísticas */}
      {estadisticas && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">Total Enviados</div>
            <div className="text-3xl font-bold text-blue-600">{estadisticas.totalEnviados}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">Leídos</div>
            <div className="text-3xl font-bold text-green-600">{estadisticas.totalLeidos}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">No Leídos</div>
            <div className="text-3xl font-bold text-orange-600">{estadisticas.totalNoLeidos}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">Tasa de Lectura</div>
            <div className="text-3xl font-bold text-purple-600">{estadisticas.porcentajeLeidos}%</div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Filtros</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
            <select
              value={filtros.leido}
              onChange={(e) => setFiltros({ ...filtros, leido: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Todos</option>
              <option value="true">Leídos</option>
              <option value="false">No Leídos</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
            <select
              value={filtros.tipoMensaje}
              onChange={(e) => setFiltros({ ...filtros, tipoMensaje: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Todos</option>
              <option value="INDIVIDUAL">Individual</option>
              <option value="MASIVO_CURSO">Masivo por Curso</option>
              <option value="MASIVO_MATERIA">Masivo por Materia</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Desde</label>
            <input
              type="date"
              value={filtros.fechaDesde}
              onChange={(e) => setFiltros({ ...filtros, fechaDesde: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Hasta</label>
            <input
              type="date"
              value={filtros.fechaHasta}
              onChange={(e) => setFiltros({ ...filtros, fechaHasta: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
        </div>
      </div>

      {/* Tabla de Mensajes */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asunto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destinatario</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {mensajes.map((mensaje) => (
              <tr key={mensaje.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatFecha(mensaje.fechaEnvio)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {mensaje.asunto}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {mensaje.receptor.nombre} {mensaje.receptor.apellido}
                  <div className="text-xs text-gray-500">{mensaje.receptor.rol}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    mensaje.tipoMensaje === 'INDIVIDUAL' 
                      ? 'bg-blue-100 text-blue-800'
                      : mensaje.tipoMensaje === 'MASIVO_CURSO'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {mensaje.tipoMensaje === 'INDIVIDUAL' ? 'Individual' :
                     mensaje.tipoMensaje === 'MASIVO_CURSO' ? 'Por Curso' : 'Por Materia'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  {mensaje.leido ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Leído
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                      No leído
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  {mensaje.emailEnviado ? (
                    <svg className="w-5 h-5 text-green-500 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                    </svg>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                  <button
                    onClick={() => handleVerDetalle(mensaje)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    Ver detalle
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {mensajes.length === 0 && !loading && (
          <div className="p-8 text-center text-gray-500">
            No hay mensajes enviados
          </div>
        )}
      </div>

      {/* Modal de Detalle */}
      {showModal && detalleMensaje && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">{detalleMensaje.mensaje.asunto}</h2>
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
                Enviado: {formatFecha(detalleMensaje.mensaje.fechaEnvio)}
              </p>
              <p className="text-sm text-gray-600">
                Tipo: {detalleMensaje.mensaje.tipoMensaje === 'INDIVIDUAL' ? 'Individual' :
                       detalleMensaje.mensaje.tipoMensaje === 'MASIVO_CURSO' ? 'Masivo por Curso' : 'Masivo por Materia'}
              </p>
            </div>

            <div className="mb-6 p-4 bg-gray-50 rounded">
              <p className="whitespace-pre-wrap">{detalleMensaje.mensaje.cuerpo}</p>
            </div>

            {/* Estadísticas para mensajes masivos */}
            {detalleMensaje.destinatarios && (
              <>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="bg-blue-50 p-3 rounded">
                    <div className="text-sm text-gray-600">Total Destinatarios</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {detalleMensaje.totalDestinatarios}
                    </div>
                  </div>
                  <div className="bg-green-50 p-3 rounded">
                    <div className="text-sm text-gray-600">Leídos</div>
                    <div className="text-2xl font-bold text-green-600">
                      {detalleMensaje.totalLeidos}
                    </div>
                  </div>
                  <div className="bg-orange-50 p-3 rounded">
                    <div className="text-sm text-gray-600">No Leídos</div>
                    <div className="text-2xl font-bold text-orange-600">
                      {detalleMensaje.totalNoLeidos}
                    </div>
                  </div>
                </div>

                <h3 className="font-semibold mb-2">Destinatarios:</h3>
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Estudiante
                        </th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                          Estado
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {detalleMensaje.destinatarios.map((dest) => (
                        <tr key={dest.id}>
                          <td className="px-4 py-2 text-sm">
                            {dest.receptor.nombre} {dest.receptor.apellido}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {dest.leido ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                Leído
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                No leído
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="flex justify-end mt-4">
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

export default HistorialEnvios;
