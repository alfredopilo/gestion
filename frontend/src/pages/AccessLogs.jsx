import { useState, useEffect } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';

const AccessLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 50,
    action: '',
    startDate: '',
    endDate: '',
    search: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0,
  });
  const [actions, setActions] = useState([]);

  useEffect(() => {
    fetchLogs();
    fetchActions();
    fetchStats();
  }, [filters.page, filters.action, filters.startDate, filters.endDate]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key]) params.append(key, filters[key]);
      });
      
      const response = await api.get(`/logs/access-logs?${params.toString()}`);
      setLogs(response.data.data);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error al cargar logs:', error);
      toast.error('Error al cargar logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchActions = async () => {
    try {
      const response = await api.get('/logs/actions');
      setActions(response.data);
    } catch (error) {
      console.error('Error al cargar acciones:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/logs/login-stats?days=7');
      setStats(response.data);
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleSearch = () => {
    fetchLogs();
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.action) params.append('action', filters.action);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      
      const response = await api.get(`/logs/export/csv?${params.toString()}`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `logs-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Logs exportados exitosamente');
    } catch (error) {
      console.error('Error al exportar logs:', error);
      toast.error('Error al exportar logs');
    }
  };

  const getActionBadgeColor = (action) => {
    if (action === 'LOGIN') return 'badge-success';
    if (action === 'LOGIN_FAILED') return 'badge-danger';
    if (action === 'LOGOUT') return 'badge-info';
    return 'badge-primary';
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-xl shadow-medium p-6 text-white">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Logs de Acceso</h1>
        <p className="text-primary-100">Registro de actividad y accesos al sistema</p>
      </div>

      {/* Estadísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {stats.statsByAction.map((stat) => (
            <div key={stat.action} className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{stat.action}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat._count.action}</p>
                </div>
                <div className={`p-3 rounded-lg ${
                  stat.action === 'LOGIN' ? 'bg-success-100 text-success-600' :
                  stat.action === 'LOGIN_FAILED' ? 'bg-danger-100 text-danger-600' :
                  'bg-info-100 text-info-600'
                }`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {stat.action === 'LOGIN' && (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    )}
                    {stat.action === 'LOGOUT' && (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    )}
                    {stat.action === 'LOGIN_FAILED' && (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    )}
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filtros
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Búsqueda</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="input-field"
              placeholder="Email, IP, acción..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Acción</label>
            <select
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              className="input-field"
            >
              <option value="">Todas</option>
              {actions.map((action) => (
                <option key={action.action} value={action.action}>
                  {action.action} ({action._count.action})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Inicio</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Fin</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="input-field"
            />
          </div>
          <div className="flex items-end space-x-2">
            <button onClick={handleSearch} className="btn-primary flex-1">
              Buscar
            </button>
            <button onClick={handleExport} className="btn-secondary">
              Exportar
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de Logs */}
      <div className="card">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-primary-600"></div>
            <p className="mt-4 text-gray-600">Cargando logs...</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th className="px-6 py-4">Fecha/Hora</th>
                    <th className="px-6 py-4">Usuario</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Acción</th>
                    <th className="px-6 py-4">IP</th>
                    <th className="px-6 py-4">Detalles</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan="6">
                        <div className="empty-state">
                          <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <h3 className="empty-state-title">No hay logs</h3>
                          <p className="empty-state-description">No se encontraron registros con los filtros aplicados</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">
                              {new Date(log.timestamp).toLocaleDateString('es-EC')}
                            </div>
                            <div className="text-gray-600">
                              {new Date(log.timestamp).toLocaleTimeString('es-EC')}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {log.user ? (
                            <div className="flex items-center space-x-2">
                              <div className="avatar avatar-sm bg-gradient-to-br from-primary-500 to-primary-700 text-white">
                                {log.user.nombre?.charAt(0)}{log.user.apellido?.charAt(0)}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {log.user.nombre} {log.user.apellido}
                                </div>
                                <div className="text-xs text-gray-600">{log.user.rol}</div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">N/A</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-900">{log.email || 'N/A'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`badge ${getActionBadgeColor(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-sm text-gray-600">{log.ipAddress || 'N/A'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => {
                              if (log.details) {
                                alert(JSON.stringify(log.details, null, 2));
                              }
                            }}
                            className="text-primary-600 hover:text-primary-800 text-sm"
                            disabled={!log.details}
                          >
                            {log.details ? 'Ver detalles' : 'Sin detalles'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {pagination.pages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Mostrando <span className="font-medium">{(pagination.page - 1) * filters.limit + 1}</span> a{' '}
                    <span className="font-medium">{Math.min(pagination.page * filters.limit, pagination.total)}</span> de{' '}
                    <span className="font-medium">{pagination.total}</span> registros
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleFilterChange('page', pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="btn-outline text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => handleFilterChange('page', pagination.page + 1)}
                    disabled={pagination.page === pagination.pages}
                    className="btn-outline text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AccessLogs;
