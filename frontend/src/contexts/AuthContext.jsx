import { createContext, useState, useContext, useEffect } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState(() => {
    return localStorage.getItem('selectedInstitutionId');
  });

  useEffect(() => {
    // Verificar si hay token guardado
    const token = localStorage.getItem('token');
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Obtener perfil del usuario
      api.get('/auth/profile')
        .then(response => {
          setUser(response.data);
        })
        .catch(() => {
          localStorage.removeItem('token');
          delete api.defaults.headers.common['Authorization'];
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (numeroIdentificacion, password) => {
    try {
      const loginData = { 
        numeroIdentificacion, 
        password
      };
      const response = await api.post('/auth/login', loginData);
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      
      toast.success('¡Bienvenido!');
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || 'Error al iniciar sesión';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
    toast.success('Sesión cerrada');
  };

  const changeInstitution = async (institutionId, { reload = true } = {}) => {
    setSelectedInstitutionId(institutionId);
    if (institutionId) {
      localStorage.setItem('selectedInstitutionId', institutionId);
      // Establecer la institución activa en el backend
      try {
        await api.post(`/institutions/${institutionId}/activate`);
      } catch (error) {
        console.error('Error al establecer institución activa:', error);
        toast.error(error.response?.data?.error || 'Error al cambiar institución');
        // No bloqueamos el cambio si falla, solo lo registramos
      }
    } else {
      localStorage.removeItem('selectedInstitutionId');
    }

    // Forzar recarga completa para refrescar todos los datos dependientes de la institución
    if (reload && typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    selectedInstitutionId,
    changeInstitution,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};

