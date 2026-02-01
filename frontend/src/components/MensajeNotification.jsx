import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const MensajeNotification = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [lastCheckedId, setLastCheckedId] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const checkNewMessages = useCallback(async () => {
    try {
      const response = await api.get('/mensajes/recibidos?limit=5&leido=false');
      const mensajes = response.data.data || [];
      
      if (!isInitialized) {
        // Primera carga: solo guardar el último ID sin mostrar notificaciones
        if (mensajes.length > 0) {
          setLastCheckedId(mensajes[0].id);
        }
        setIsInitialized(true);
        return;
      }
      
      // Verificar si hay mensajes nuevos
      if (mensajes.length > 0 && mensajes[0].id !== lastCheckedId) {
        const newMessages = [];
        for (const msg of mensajes) {
          if (msg.id === lastCheckedId) break;
          newMessages.push(msg);
        }
        
        if (newMessages.length > 0) {
          // Agregar nuevas notificaciones
          setNotifications(prev => [
            ...newMessages.map(msg => ({
              id: msg.id,
              asunto: msg.asunto,
              cuerpo: msg.cuerpo,
              emisor: msg.emisor,
              fechaEnvio: msg.fechaEnvio,
              visible: true
            })),
            ...prev
          ].slice(0, 5)); // Máximo 5 notificaciones visibles
          
          setLastCheckedId(mensajes[0].id);
        }
      }
    } catch (error) {
      console.error('Error verificando mensajes:', error);
    }
  }, [isInitialized, lastCheckedId]);

  useEffect(() => {
    if (!user) return;
    
    // Verificar inmediatamente
    checkNewMessages();
    
    // Polling cada 15 segundos
    const interval = setInterval(checkNewMessages, 15000);
    
    return () => clearInterval(interval);
  }, [user, checkNewMessages]);

  const dismissNotification = (id) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, visible: false } : n)
    );
    
    // Remover después de la animación
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 300);
  };

  const handleClick = async (notification) => {
    try {
      // Marcar como leído
      await api.patch(`/mensajes/${notification.id}/leer`);
    } catch (error) {
      console.error('Error al marcar como leído:', error);
    }
    
    dismissNotification(notification.id);
    navigate('/mensajes');
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const truncateText = (text, maxLength = 80) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 max-w-sm">
      {notifications.filter(n => n.visible).map((notification, index) => (
        <div
          key={notification.id}
          className={`
            bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden
            transform transition-all duration-300 ease-out
            ${notification.visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
            hover:shadow-xl cursor-pointer
          `}
          style={{
            animation: 'slideIn 0.3s ease-out',
            animationDelay: `${index * 100}ms`
          }}
          onClick={() => handleClick(notification)}
        >
          {/* Header con gradiente */}
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-white text-sm font-medium">Nuevo mensaje</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                dismissNotification(notification.id);
              }}
              className="text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Contenido */}
          <div className="p-4">
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-semibold text-gray-900 text-sm line-clamp-1">
                {notification.asunto}
              </h4>
              <span className="text-xs text-gray-400 ml-2 whitespace-nowrap">
                {formatDate(notification.fechaEnvio)}
              </span>
            </div>
            
            <p className="text-xs text-gray-500 mb-2">
              De: {notification.emisor?.nombre} {notification.emisor?.apellido}
            </p>
            
            <p className="text-sm text-gray-600 line-clamp-2">
              {truncateText(notification.cuerpo)}
            </p>
            
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-blue-600 font-medium">
                Clic para ver mensaje completo
              </span>
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
          
          {/* Barra de progreso para auto-dismiss */}
          <div className="h-1 bg-gray-100">
            <div 
              className="h-full bg-blue-500 animate-shrink"
              style={{
                animation: 'shrink 10s linear forwards'
              }}
              onAnimationEnd={() => dismissNotification(notification.id)}
            />
          </div>
        </div>
      ))}
      
      {/* Estilos para animaciones */}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
        
        .line-clamp-1 {
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};

export default MensajeNotification;
