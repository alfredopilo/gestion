import { useState, useEffect } from 'react';
import { api } from '../services/api';
import NotificationPanel from './NotificationPanel';

const NotificationBadge = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUnreadCount();
    // Actualizar cada 30 segundos
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const response = await api.get('/notifications/count');
      setUnreadCount(response.data.count || 0);
    } catch (error) {
      console.error('Error al obtener conteo de notificaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePanel = () => {
    setShowPanel(!showPanel);
  };

  const handleNotificationRead = () => {
    // Actualizar el contador cuando se marca una notificación como leída
    fetchUnreadCount();
  };

  if (loading) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={handleTogglePanel}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-full"
        aria-label="Notificaciones"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {showPanel && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowPanel(false)}
          />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg z-50 border border-gray-200">
            <NotificationPanel
              onNotificationRead={handleNotificationRead}
              onClose={() => setShowPanel(false)}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBadge;

