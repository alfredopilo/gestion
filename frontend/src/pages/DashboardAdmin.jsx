import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

const DashboardAdmin = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalStudents: 0,
    totalCourses: 0,
    totalPayments: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [users, students, courses, payments] = await Promise.all([
        api.get('/users?limit=1'),
        api.get('/students?limit=1'),
        api.get('/courses?limit=1'),
        api.get('/payments?limit=1'),
      ]);

      setStats({
        totalUsers: users.data.pagination.total,
        totalStudents: students.data.pagination.total,
        totalCourses: courses.data.pagination.total,
        totalPayments: payments.data.pagination.total,
      });
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
    }
  };

  const statCards = [
    {
      name: 'Usuarios',
      value: stats.totalUsers,
      href: '/users',
      gradient: 'from-blue-500 via-blue-600 to-purple-600',
      shadowColor: 'rgba(59, 130, 246, 0.5)',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      name: 'Estudiantes',
      value: stats.totalStudents,
      href: '/students',
      gradient: 'from-emerald-500 via-green-600 to-teal-600',
      shadowColor: 'rgba(16, 185, 129, 0.5)',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      name: 'Cursos',
      value: stats.totalCourses,
      href: '/courses',
      gradient: 'from-purple-500 via-purple-600 to-pink-600',
      shadowColor: 'rgba(168, 85, 247, 0.5)',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      name: 'Pagos',
      value: stats.totalPayments,
      href: '/payments',
      gradient: 'from-orange-500 via-orange-600 to-red-600',
      shadowColor: 'rgba(249, 115, 22, 0.5)',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header con animación */}
      <div className="animate-fade-in">
        <h1 className="text-4xl font-bold text-gradient gradient-primary">
          Panel de Administración
        </h1>
        <p className="mt-3 text-lg text-gray-600">
          Gestión integral del sistema educativo
        </p>
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 animate-slide-up">
        {statCards.map((stat, index) => (
          <Link
            key={stat.name}
            to={stat.href}
            className="group relative overflow-hidden rounded-2xl transition-all duration-500 hover:-translate-y-2"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            {/* Fondo con degradado vibrante */}
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-100 group-hover:opacity-90 transition-opacity`} />
            
            {/* Efecto shimmer */}
            <div className="absolute inset-0 shimmer opacity-0 group-hover:opacity-100" />
            
            {/* Contenido */}
            <div className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                {/* Icono flotante con glassmorphism */}
                <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 text-white shadow-xl group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 float">
                  {stat.icon}
                </div>
                {/* Flecha animada */}
                <svg className="w-6 h-6 text-white/70 group-hover:text-white group-hover:translate-x-1 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <dt className="text-sm font-medium text-white/80 mb-1">
                {stat.name}
              </dt>
              <dd className="text-4xl font-bold text-white drop-shadow-lg">
                {stat.value}
              </dd>
              
              {/* Efecto de brillo en la parte inferior */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/50 to-transparent" />
            </div>
            
            {/* Sombra con color dinámico */}
            <div 
              className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-xl"
              style={{ 
                boxShadow: `0 20px 60px ${stat.shadowColor}`,
                transform: 'translateY(10px)'
              }}
            />
          </Link>
        ))}
      </div>

      {/* Sección de accesos rápidos e información */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 animate-fade-in" style={{ animationDelay: '400ms' }}>
        {/* Accesos Rápidos */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white to-blue-50/30 backdrop-blur-sm border border-blue-100/50 shadow-soft hover:shadow-medium transition-all duration-300">
          <div className="px-6 py-4 border-b border-blue-100/50 bg-gradient-to-r from-blue-50/50 to-purple-50/30">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white mr-3 shadow-md">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              Accesos Rápidos
            </h3>
          </div>
          <div className="px-6 py-4 space-y-3">
            <Link
              to="/students"
              className="group relative flex items-center p-4 rounded-xl bg-white border-2 border-transparent hover:border-blue-200 transition-all duration-300 overflow-hidden hover-lift"
            >
              {/* Borde degradado animado */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500 via-blue-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" style={{ padding: '2px' }}>
                <div className="w-full h-full bg-white rounded-xl" />
              </div>
              
              {/* Efecto glow */}
              <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md -z-20" style={{ boxShadow: '0 0 30px rgba(59, 130, 246, 0.4)' }} />
              
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-md">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <span className="ml-4 font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                Gestionar Estudiantes
              </span>
              <svg className="ml-auto w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-2 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            
            <Link
              to="/courses"
              className="group relative flex items-center p-4 rounded-xl bg-white border-2 border-transparent hover:border-green-200 transition-all duration-300 overflow-hidden hover-lift"
            >
              {/* Borde degradado animado */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500 via-green-600 to-teal-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" style={{ padding: '2px' }}>
                <div className="w-full h-full bg-white rounded-xl" />
              </div>
              
              {/* Efecto glow */}
              <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md -z-20" style={{ boxShadow: '0 0 30px rgba(16, 185, 129, 0.4)' }} />
              
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-md">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <span className="ml-4 font-semibold text-gray-900 group-hover:text-green-700 transition-colors">
                Gestionar Cursos
              </span>
              <svg className="ml-auto w-5 h-5 text-gray-400 group-hover:text-green-600 group-hover:translate-x-2 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            
            <Link
              to="/users"
              className="group relative flex items-center p-4 rounded-xl bg-white border-2 border-transparent hover:border-orange-200 transition-all duration-300 overflow-hidden hover-lift"
            >
              {/* Borde degradado animado */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-500 via-orange-600 to-red-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" style={{ padding: '2px' }}>
                <div className="w-full h-full bg-white rounded-xl" />
              </div>
              
              {/* Efecto glow */}
              <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md -z-20" style={{ boxShadow: '0 0 30px rgba(249, 115, 22, 0.4)' }} />
              
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-md">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <span className="ml-4 font-semibold text-gray-900 group-hover:text-orange-700 transition-colors">
                Gestionar Usuarios
              </span>
              <svg className="ml-auto w-5 h-5 text-gray-400 group-hover:text-orange-600 group-hover:translate-x-2 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Información del Sistema */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white via-indigo-50/20 to-purple-50/30 backdrop-blur-sm border border-purple-100/50 shadow-soft hover:shadow-medium transition-all duration-300">
          <div className="px-6 py-4 border-b border-purple-100/50 bg-gradient-to-r from-indigo-50/50 to-purple-50/50">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center">
              <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white mr-3 shadow-md">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              Información del Sistema
            </h3>
          </div>
          <div className="px-6 py-4 space-y-3">
            {/* Versión */}
            <div className="group relative flex items-center p-4 rounded-xl glass-effect border-l-4 border-indigo-500 hover:-translate-y-1 transition-all duration-300 overflow-hidden">
              {/* Fondo animado */}
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              <div className="relative flex-shrink-0 w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                {/* Efecto de pulso en el icono */}
                <div className="absolute inset-0 rounded-xl bg-indigo-500 animate-ping opacity-20" />
              </div>
              <div className="ml-4 relative">
                <p className="text-sm font-medium text-gray-600">Versión</p>
                <p className="text-lg font-bold text-gray-900">1.0.0</p>
              </div>
            </div>
            
            {/* Estado */}
            <div className="group relative flex items-center p-4 rounded-xl glass-effect border-l-4 border-green-500 hover:-translate-y-1 transition-all duration-300 overflow-hidden">
              {/* Fondo animado */}
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              <div className="relative flex-shrink-0 w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-md">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {/* Efecto de pulso en el icono */}
                <div className="absolute inset-0 rounded-xl bg-green-500 animate-ping opacity-20" />
              </div>
              <div className="ml-4 relative">
                <p className="text-sm font-medium text-gray-600">Estado</p>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                  <p className="text-lg font-bold bg-gradient-to-r from-green-600 to-green-700 bg-clip-text text-transparent">
                    Operativo
                  </p>
                </div>
              </div>
            </div>
            
            {/* Base de Datos */}
            <div className="group relative flex items-center p-4 rounded-xl glass-effect border-l-4 border-blue-500 hover:-translate-y-1 transition-all duration-300 overflow-hidden">
              {/* Fondo animado */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              <div className="relative flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
                {/* Efecto de pulso en el icono */}
                <div className="absolute inset-0 rounded-xl bg-blue-500 animate-ping opacity-20" />
              </div>
              <div className="ml-4 relative">
                <p className="text-sm font-medium text-gray-600">Base de datos</p>
                <p className="text-lg font-bold text-gray-900">PostgreSQL</p>
              </div>
            </div>
          </div>
          
          {/* Decorative gradient overlay */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full blur-3xl -z-10" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-indigo-500/10 to-transparent rounded-full blur-3xl -z-10" />
        </div>
      </div>
    </div>
  );
};

export default DashboardAdmin;

