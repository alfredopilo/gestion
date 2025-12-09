import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const NotificationPanel = ({ onNotificationRead, onClose }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/notifications?leido=false');
      setNotifications(response.data.data || []);
    } catch (error) {
      console.error('Error al obtener notificaciones:', error);
      toast.error('Error al cargar notificaciones');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await api.patch(`/notifications/${notificationId}/read`);
      setNotifications(notifications.filter((n) => n.id !== notificationId));
      if (onNotificationRead) {
        onNotificationRead();
      }
    } catch (error) {
      console.error('Error al marcar notificación como leída:', error);
      toast.error('Error al marcar notificación como leída');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications([]);
      if (onNotificationRead) {
        onNotificationRead();
      }
      toast.success('Todas las notificaciones marcadas como leídas');
    } catch (error) {
      console.error('Error al marcar todas como leídas:', error);
      toast.error('Error al marcar todas las notificaciones');
    }
  };

  return (
    <div className="max-h-96 overflow-y-auto">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Notificaciones</h3>
        {notifications.length > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="text-sm text-primary-600 hover:text-primary-800"
          >
            Marcar todas como leídas
          </button>
        )}
      </div>

      {loading ? (
        <div className="p-4 text-center text-gray-500">Cargando...</div>
      ) : notifications.length === 0 ? (
        <div className="p-4 text-center text-gray-500">
          No hay notificaciones nuevas
        </div>
      ) : (
        <div className="divide-y divide-gray-200">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className="p-4 hover:bg-gray-50 cursor-pointer"
              onClick={() => {
                handleMarkAsRead(notification.id);
                if (notification.insumoId) {
                  // Redirigir a la página de tareas si es una notificación de tarea
                  window.location.href = '/mis-tareas';
                }
              }}
            >
              <div className="flex items-start">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {notification.titulo}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {notification.mensaje}
                  </p>
                  {notification.insumo && (
                    <p className="text-xs text-gray-500 mt-1">
                      {notification.insumo.materia?.nombre} -{' '}
                      {notification.insumo.curso?.nombre}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(notification.createdAt).toLocaleDateString(
                      'es-ES',
                      {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      }
                    )}
                  </p>
                </div>
                <div className="ml-2">
                  <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {notifications.length > 0 && (
        <div className="p-4 border-t border-gray-200 text-center">
          <Link
            to="/mis-tareas"
            onClick={onClose}
            className="text-sm text-primary-600 hover:text-primary-800"
          >
            Ver todas las tareas
          </Link>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;

