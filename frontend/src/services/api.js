import axios from 'axios';
import {
  clearSessionActivity,
  getSessionStartTimestamp,
  isSessionActive,
  isTokenExpired,
} from '../utils/tokenUtils';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30 segundos timeout (aumentado para VPS lentos)
  headers: {
    'Content-Type': 'application/json',
  },
});

const refreshClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshPromise = null;

const attemptTokenRefresh = async () => {
  if (refreshPromise) {
    return refreshPromise;
  }

  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) {
    throw new Error('Refresh token no disponible');
  }

  refreshPromise = refreshClient
    .post('/auth/refresh', { refreshToken })
    .then((response) => {
      const { token, refreshToken: newRefreshToken } = response.data || {};
      if (!token) {
        throw new Error('Respuesta de refresh inválida');
      }
      localStorage.setItem('token', token);
      if (newRefreshToken) {
        localStorage.setItem('refreshToken', newRefreshToken);
      }
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      return token;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
};

// Interceptor para añadir token y institución seleccionada
api.interceptors.request.use(
  async (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      if (
        isTokenExpired(token) ||
        !getSessionStartTimestamp() ||
        !isSessionActive(10 * 60 * 1000)
      ) {
        try {
          const newToken = await attemptTokenRefresh();
          config.headers.Authorization = `Bearer ${newToken}`;
        } catch (error) {
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          delete api.defaults.headers.common['Authorization'];
          clearSessionActivity();
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          return Promise.reject(error);
        }
      }
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Agregar institución seleccionada al header
    const selectedInstitutionId = localStorage.getItem('selectedInstitutionId');
    if (selectedInstitutionId) {
      config.headers['x-institution-id'] = selectedInstitutionId;
    }
    
    // No sobrescribir Content-Type si es FormData (el navegador lo maneja automáticamente)
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};
    // Solo manejar errores 401 si hay una respuesta del servidor
    // Si es un error de red o CORS, no redirigir
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const newToken = await attemptTokenRefresh();
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // continuar con limpieza abajo
      }
    }

    if (error.response?.status === 401) {
      // Solo limpiar el token si no estamos en la página de login
      if (window.location.pathname !== '/login') {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        delete api.defaults.headers.common['Authorization'];
        clearSessionActivity();
        // Solo redirigir si no estamos ya en la página de login
        window.location.href = '/login';
      }
    }
    // Para errores de CORS o red, no hacer nada especial, dejar que el componente maneje el error
    return Promise.reject(error);
  }
);

export default api;

