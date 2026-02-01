import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const MensajeBadge = () => {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000); // Actualizar cada 30s
    return () => clearInterval(interval);
  }, []);

  const fetchCount = async () => {
    try {
      const response = await api.get('/mensajes/count');
      setCount(response.data.count);
    } catch (error) {
      console.error('Error al cargar contador de mensajes');
    }
  };

  if (count === 0) return null;

  return (
    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
      {count > 99 ? '99+' : count}
    </span>
  );
};

export default MensajeBadge;
