import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30 segundos timeout (aumentado para VPS lentos)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para añadir token y institución seleccionada
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
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
  (error) => {
    // Solo manejar errores 401 si hay una respuesta del servidor
    // Si es un error de red o CORS, no redirigir
    if (error.response?.status === 401) {
      // Solo limpiar el token si no estamos en la página de login
      if (window.location.pathname !== '/login') {
        localStorage.removeItem('token');
        delete api.defaults.headers.common['Authorization'];
        // Solo redirigir si no estamos ya en la página de login
        window.location.href = '/login';
      }
    }
    // Para errores de CORS o red, no hacer nada especial, dejar que el componente maneje el error
    return Promise.reject(error);
  }
);

export default api;

