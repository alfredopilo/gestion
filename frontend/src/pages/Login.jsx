import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import toast from 'react-hot-toast';

const Login = () => {
  const [numeroIdentificacion, setNumeroIdentificacion] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [checkingMaintenance, setCheckingMaintenance] = useState(true);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Verificar estado del modo mantenimiento al cargar
  useEffect(() => {
    const checkMaintenanceStatus = async () => {
      try {
        const response = await api.get('/settings/maintenance');
        setMaintenanceMode(response.data.maintenanceMode);
      } catch (error) {
        console.error('Error al verificar modo mantenimiento:', error);
        setMaintenanceMode(false);
      } finally {
        setCheckingMaintenance(false);
      }
    };

    checkMaintenanceStatus();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!numeroIdentificacion.trim()) {
      toast.error('Número de identificación requerido');
      return;
    }
    
    setLoading(true);
    const result = await login(numeroIdentificacion.trim(), password);
    
    if (result.success) {
      navigate('/dashboard');
    } else if (result.maintenanceMode) {
      // Si el error es por modo mantenimiento, mostrar mensaje específico
      toast.error('Sistema en mantenimiento. Solo administradores pueden acceder.');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-700 via-primary-800 to-primary-950 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Elementos decorativos de fondo */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{animationDelay: '1s'}}></div>
      </div>

      <div className="max-w-md w-full space-y-8 relative z-10">
        {/* Logo/Icono */}
        <div className="text-center animate-fade-in">
          <div className="flex justify-center mb-6">
            <div className="bg-white p-4 rounded-2xl shadow-strong">
              <svg className="w-16 h-16 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          </div>
          <h2 className="text-4xl font-bold text-white mb-2">
            Gestión Escolar
          </h2>
          <p className="text-primary-100 text-lg">
            Sistema de Administración Educativa
          </p>
        </div>

        {/* Banner de Modo Mantenimiento */}
        {!checkingMaintenance && maintenanceMode && (
          <div className="bg-amber-500 border-l-4 border-amber-700 rounded-lg p-4 animate-fade-in">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-amber-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-bold text-amber-900">
                  Sistema en Mantenimiento
                </h3>
                <p className="text-sm text-amber-800 mt-1">
                  El sistema se encuentra en modo de mantenimiento. Solo los administradores pueden acceder en este momento.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Card de login */}
        <div className="bg-white rounded-2xl shadow-strong p-8 animate-slide-up">
          <div className="mb-6">
            <h3 className="text-2xl font-semibold text-gray-900 text-center mb-2">
              Iniciar Sesión
            </h3>
            <p className="text-gray-600 text-center text-sm">
              Ingresa tus credenciales para continuar
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="numeroIdentificacion" className="block text-sm font-medium text-gray-700 mb-2">
                  Número de Identificación
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    id="numeroIdentificacion"
                    name="numeroIdentificacion"
                    type="text"
                    autoComplete="username"
                    required
                    className="input-field pl-10"
                    placeholder="Ingresa tu identificación"
                    value={numeroIdentificacion}
                    onChange={(e) => setNumeroIdentificacion(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Contraseña
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="input-field pl-10"
                    placeholder="Ingresa tu contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-base font-semibold"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Iniciando sesión...
                </span>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-primary-100 text-sm animate-fade-in">
          © 2026 Sistema de Gestión Escolar - Todos los derechos reservados
        </p>
      </div>
    </div>
  );
};

export default Login;
