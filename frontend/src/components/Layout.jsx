import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';
import { api } from '../services/api';
import NotificationBadge from './NotificationBadge';
import MensajeBadge from './MensajeBadge';
import MensajeNotification from './MensajeNotification';

const Layout = () => {
  const { user, logout, selectedInstitutionId, changeInstitution } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [institutions, setInstitutions] = useState([]);
  const [activeInstitution, setActiveInstitution] = useState(null);
  const [expandedMenus, setExpandedMenus] = useState({});

  // Iconos SVG inline
  const icons = {
    Dashboard: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    Estudiantes: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    Cursos: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    Materias: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    'Asignar Materias': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    Períodos: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    Calificaciones: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
    'Ingresar Calificaciones': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    Supletorios: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
      </svg>
    ),
    Insumos: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    Reportes: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    Boletines: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    'Escalas de Calificación': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    Asistencia: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    Horarios: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
      </svg>
    ),
    Pagos: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    'Ficha del Estudiante': (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 1.657-1.343 3-3 3S6 12.657 6 11s1.343-3 3-3 3 1.343 3 3z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 19v-1a4 4 0 014-4h2a4 4 0 014 4v1" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7h5m-2.5-2.5V9" />
      </svg>
    ),
    Usuarios: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    Configuración: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    'Configuración General': (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    'Configuración Institución': (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    'Promoción Escolar': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    'Respaldo de BD': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
    'Mis Tareas': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    'Mis Estudiantes': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    'Asociar Padres': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    Mensajes: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    'Enviar Mensaje': (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    ),
    'Recibidos': (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
    ),
    'Historial de Envíos': (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    'Configuración de Email': (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
      </svg>
    ),
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', roles: ['ADMIN', 'PROFESOR', 'ESTUDIANTE', 'REPRESENTANTE'] },
    { name: 'Mis Tareas', href: '/mis-tareas', roles: ['ESTUDIANTE'] },
    { name: 'Mis Estudiantes', href: '/dashboard', roles: ['REPRESENTANTE'] },
    { name: 'Estudiantes', href: '/students', roles: ['ADMIN', 'PROFESOR', 'SECRETARIA'] },
    { name: 'Asociar Padres', href: '/associate-students', roles: ['ADMIN', 'SECRETARIA'] },
    { name: 'Cursos', href: '/courses', roles: ['ADMIN', 'PROFESOR', 'SECRETARIA'] },
    { name: 'Materias', href: '/subjects', roles: ['ADMIN', 'SECRETARIA'] },
    { name: 'Asignar Materias', href: '/assignments', roles: ['ADMIN', 'SECRETARIA'] },
    { name: 'Calificaciones', href: '/grades', roles: ['ADMIN', 'PROFESOR', 'ESTUDIANTE', 'REPRESENTANTE'] },
    { name: 'Insumos', href: '/insumos', roles: ['ADMIN', 'PROFESOR', 'SECRETARIA'] },
    { name: 'Ingresar Calificaciones', href: '/grade-entry', roles: ['ADMIN', 'PROFESOR', 'SECRETARIA'] },
    { name: 'Supletorios', href: '/supplementary', roles: ['ADMIN', 'PROFESOR', 'SECRETARIA'] },
    { name: 'Reportes', href: '/reports', roles: ['ADMIN', 'PROFESOR', 'SECRETARIA'] },
    { name: 'Boletines', href: '/report-cards', roles: ['ADMIN', 'PROFESOR', 'SECRETARIA'] },
    { name: 'Asistencia', href: '/attendance', roles: ['ADMIN', 'PROFESOR', 'SECRETARIA'] },
    { name: 'Horarios', href: '/schedule', roles: ['ADMIN', 'PROFESOR', 'SECRETARIA', 'ESTUDIANTE'] },
    { name: 'Pagos', href: '/payments', roles: ['ADMIN', 'SECRETARIA', 'ESTUDIANTE', 'REPRESENTANTE'] },
    { name: 'Promoción Escolar', href: '/school-promotion', roles: ['ADMIN'] },
    {
      name: 'Mensajes',
      roles: ['ADMIN', 'PROFESOR', 'SECRETARIA', 'ESTUDIANTE', 'REPRESENTANTE'],
      children: [
        { name: 'Recibidos', href: '/mensajes', roles: ['ADMIN', 'PROFESOR', 'SECRETARIA', 'ESTUDIANTE', 'REPRESENTANTE'] },
        { name: 'Enviar Mensaje', href: '/mensajes/enviar', roles: ['ADMIN', 'PROFESOR', 'SECRETARIA'] },
        { name: 'Historial de Envíos', href: '/mensajes/historial', roles: ['ADMIN', 'PROFESOR', 'SECRETARIA'] }
      ]
    },
    { 
      name: 'Configuración', 
      roles: ['ADMIN', 'SECRETARIA'],
      children: [
        { name: 'Períodos', href: '/periods', roles: ['ADMIN', 'SECRETARIA'] },
        { name: 'Escalas de Calificación', href: '/grade-scales', roles: ['ADMIN', 'SECRETARIA'] },
        { name: 'Usuarios', href: '/users', roles: ['ADMIN', 'SECRETARIA'] },
        { name: 'Respaldo de BD', href: '/database-backup', roles: ['ADMIN'] },
        { name: 'Configuración General', href: '/general-settings', roles: ['ADMIN', 'SECRETARIA'] },
        { name: 'Configuración Institución', href: '/institution-settings', roles: ['ADMIN'] },
        { name: 'Configuración de Email', href: '/email-settings', roles: ['ADMIN'] },
        { name: 'Ficha del Estudiante', href: '/student-profile-template', roles: ['ADMIN', 'SECRETARIA'] },
        { name: 'Gestión de Permisos', href: '/permission-management', roles: ['ADMIN'] },
        { name: 'Logs de Acceso', href: '/access-logs', roles: ['ADMIN'] },
      ]
    },
  ];

  const isActive = (path) => location.pathname === path;

  // Filtrar navegación
  const filteredNav = navigation.filter(item => {
    if (item.children) {
      // Si tiene hijos, verificar si alguno tiene acceso
      return item.children.some(child => 
        !child.roles || child.roles.includes(user?.rol)
      );
    }
    return !item.roles || item.roles.includes(user?.rol);
  });

  // Expandir automáticamente si algún subitem está activo
  useEffect(() => {
    navigation.forEach(item => {
      if (item.children) {
        const hasActiveChild = item.children.some(child => 
          (isActive(child.href) || location.pathname.startsWith(child.href)) &&
          (!child.roles || child.roles.includes(user?.rol))
        );
        if (hasActiveChild && !expandedMenus[item.name]) {
          setExpandedMenus(prev => ({ ...prev, [item.name]: true }));
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, user?.rol]);

  const toggleMenu = (menuName) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuName]: !prev[menuName]
    }));
  };

  const hasActiveChild = (item) => {
    if (!item.children) return false;
    return item.children.some(child => 
      (isActive(child.href) || location.pathname.startsWith(child.href)) &&
      (!child.roles || child.roles.includes(user?.rol))
    );
  };

  useEffect(() => {
    let controller = new AbortController();
    let isMounted = true;
    
    const fetchInstitutions = async () => {
      try {
        const [institutionsRes, activeRes] = await Promise.all([
          api.get('/institutions/user-institutions', { signal: controller.signal }),
          api.get('/institutions/active', { signal: controller.signal }).catch(() => null),
        ]);

        if (isMounted) {
          setInstitutions(institutionsRes.data.data || []);
          if (activeRes?.data) {
            setActiveInstitution(activeRes.data);
          }

          // Si no hay institución seleccionada, usar la activa o la primera disponible
          // Siempre debe haber una institución seleccionada
          if (!selectedInstitutionId && institutionsRes.data.data?.length > 0) {
            const defaultInstitution = activeRes?.data || institutionsRes.data.data[0];
            if (defaultInstitution) {
              changeInstitution(defaultInstitution.id, { reload: false });
            }
          } else if (selectedInstitutionId && !institutionsRes.data.data.find(i => i.id === selectedInstitutionId)) {
            // Si la institución seleccionada ya no está disponible, seleccionar la primera
            if (institutionsRes.data.data?.length > 0) {
              const defaultInstitution = activeRes?.data || institutionsRes.data.data[0];
              changeInstitution(defaultInstitution.id, { reload: false });
            }
          }
        }
      } catch (error) {
        // Ignorar errores de aborto
        if (isMounted && error.name !== 'CanceledError' && error.code !== 'ECONNABORTED' && error.code !== 'ERR_CANCELED') {
          console.error('Error al cargar instituciones:', error);
        }
      }
    };

    fetchInstitutions();
    
    return () => {
      isMounted = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Solo cargar una vez al montar

  const handleInstitutionChange = (e) => {
    const institutionId = e.target.value || null;
    changeInstitution(institutionId);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar Desktop */}
      <aside className={`hidden lg:block bg-white border-r border-gray-200 transition-all duration-300 ${
        sidebarOpen ? 'w-64' : 'w-20'
      } fixed h-screen z-30`}>
        {/* Header del sidebar con degradado */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-purple-200/50 bg-gradient-to-r from-primary-600 to-purple-700 relative overflow-hidden">
          {/* Efecto de brillo animado */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
          
          {sidebarOpen && (
            <h1 className="text-xl font-bold text-white drop-shadow-lg relative z-10">Gestión Escolar</h1>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/20 backdrop-blur-sm transition-all duration-300 relative z-10"
            aria-label="Toggle sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {sidebarOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* NUEVO: Información de Usuario e Institución - Siempre visible en la parte superior */}
        {sidebarOpen && (
          <div className="p-4 border-b border-purple-200/50 bg-gradient-to-br from-primary-50 via-purple-50/30 to-white relative overflow-hidden">
            {/* Decorative gradient blobs */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full blur-2xl -z-10" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-blue-500/10 to-transparent rounded-full blur-2xl -z-10" />
            
            {/* Selector de Institución */}
            {institutions.length > 0 && (
              <div className="mb-3 relative">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Institución
                </label>
                <div className="relative">
                  <select
                    value={selectedInstitutionId || ''}
                    onChange={(e) => {
                      const institutionId = e.target.value || null;
                      changeInstitution(institutionId);
                    }}
                    className="w-full text-sm border-2 border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent hover:border-purple-300 transition-all appearance-none"
                  >
                    {institutions.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.nombre} {inst.activa && '✓'}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            )}
            
            {/* Info Usuario */}
            <div className="flex items-center space-x-3 mb-3">
              {/* Avatar con anillo degradado animado */}
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg relative z-10">
                  {user?.nombre?.charAt(0)}{user?.apellido?.charAt(0)}
                </div>
                {/* Anillo pulsante */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 animate-ping opacity-20" />
                {/* Anillo estático con blur */}
                <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 opacity-30 blur-sm -z-10" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">
                  {user?.nombre} {user?.apellido}
                </p>
                <p className="text-xs text-gray-600 truncate">{user?.email}</p>
              </div>
            </div>
            
            {/* Botones Perfil y Cerrar Sesión */}
            <div className="flex gap-2">
              <Link 
                to="/profile" 
                className="flex-1 text-center px-3 py-2 text-xs font-semibold text-primary-700 bg-white border-2 border-primary-300 rounded-lg hover:bg-gradient-to-r hover:from-primary-600 hover:to-purple-600 hover:text-white hover:border-transparent transition-all duration-300 shadow-sm hover:shadow-md"
              >
                Perfil
              </Link>
              <button 
                onClick={logout}
                className="flex-1 text-center px-3 py-2 text-xs font-semibold text-white bg-gradient-to-r from-red-600 to-red-700 rounded-lg hover:from-red-700 hover:to-red-800 transition-all duration-300 shadow-sm hover:shadow-md"
              >
                Salir
              </button>
            </div>
          </div>
        )}

        {/* Versión colapsada - Solo avatar */}
        {!sidebarOpen && (
          <div className="py-4 border-b border-purple-200/50 flex justify-center bg-gradient-to-br from-primary-50/50 to-purple-50/30">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg relative z-10">
                {user?.nombre?.charAt(0)}{user?.apellido?.charAt(0)}
              </div>
              {/* Anillo pulsante */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 animate-ping opacity-20" />
              {/* Anillo estático con blur */}
              <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 opacity-30 blur-sm -z-10" />
            </div>
          </div>
        )}

        {/* Menú de navegación */}
        <nav className="flex-1 overflow-y-auto py-4 max-h-[calc(100vh-24rem)] custom-scrollbar">
          <div className="space-y-1 px-2">
            {filteredNav.map((item) => {
              if (item.children) {
                const isExpanded = expandedMenus[item.name] || hasActiveChild(item);
                const filteredChildren = item.children.filter(child =>
                  !child.roles || child.roles.includes(user?.rol)
                );

                return (
                  <div key={item.name}>
                    <button
                      onClick={() => sidebarOpen && toggleMenu(item.name)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 relative overflow-hidden group ${
                        hasActiveChild(item)
                          ? 'bg-gradient-to-r from-primary-100 to-purple-100 text-primary-700 shadow-sm'
                          : 'text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-purple-50/30 hover:text-gray-900'
                      }`}
                      title={!sidebarOpen ? item.name : ''}
                    >
                      {/* Borde degradado al hover */}
                      {!hasActiveChild(item) && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-l-lg" />
                      )}
                      {/* Borde degradado para item activo */}
                      {hasActiveChild(item) && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary-600 to-purple-700 rounded-l-lg" />
                      )}
                      
                      <div className="flex items-center relative z-10">
                        <span className="flex-shrink-0">{icons[item.name]}</span>
                        {sidebarOpen && <span className="ml-3">{item.name}</span>}
                      </div>
                      {sidebarOpen && (
                        <svg
                          className={`w-4 h-4 transition-transform duration-300 relative z-10 ${isExpanded ? 'transform rotate-90' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </button>
                    {sidebarOpen && isExpanded && (
                      <div className="ml-6 mt-1 space-y-1">
                        {filteredChildren.map((child) => (
                          <Link
                            key={child.name}
                            to={child.href}
                            className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-300 relative group ${
                              isActive(child.href)
                                ? 'bg-gradient-to-r from-primary-50 to-purple-50 text-primary-700'
                                : 'text-gray-600 hover:bg-gradient-to-r hover:from-gray-50 hover:to-purple-50/20 hover:text-gray-900'
                            }`}
                          >
                            {/* Indicador de item activo */}
                            {isActive(child.href) && (
                              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-gradient-to-b from-primary-600 to-purple-700 rounded-full" />
                            )}
                            <span className="flex-shrink-0">{icons[child.name]}</span>
                            <span className="ml-3">{child.name}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 relative overflow-hidden group ${
                    isActive(item.href)
                      ? 'bg-gradient-to-r from-primary-100 to-purple-100 text-primary-700 shadow-sm'
                      : 'text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-purple-50/30 hover:text-gray-900'
                  }`}
                  title={!sidebarOpen ? item.name : ''}
                >
                  {/* Borde degradado al hover */}
                  {!isActive(item.href) && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-l-lg" />
                  )}
                  {/* Borde degradado para item activo */}
                  {isActive(item.href) && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary-600 to-purple-700 rounded-l-lg" />
                  )}
                  
                  <span className="flex-shrink-0 relative z-10">{icons[item.name]}</span>
                  {sidebarOpen && <span className="ml-3 relative z-10">{item.name}</span>}
                </Link>
              );
            })}
          </div>
        </nav>
      </aside>

      {/* Overlay para móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar móvil - se muestra sobre el contenido */}
      <aside className={`lg:hidden fixed left-0 top-0 h-full bg-white border-r border-gray-200 transition-transform duration-300 z-30 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } w-64`}>
        {/* Header del sidebar móvil con degradado */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-purple-200/50 bg-gradient-to-r from-primary-600 to-purple-700 relative overflow-hidden">
          {/* Efecto de brillo animado */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
          
          <h1 className="text-xl font-bold text-white drop-shadow-lg relative z-10">Gestión Escolar</h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/20 backdrop-blur-sm transition-all duration-300 relative z-10"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Información de Usuario e Institución Móvil */}
        <div className="p-4 border-b border-purple-200/50 bg-gradient-to-br from-primary-50 via-purple-50/30 to-white relative overflow-hidden">
          {/* Decorative gradient blobs */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full blur-2xl -z-10" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-blue-500/10 to-transparent rounded-full blur-2xl -z-10" />
          
          {/* Selector de Institución */}
          {institutions.length > 0 && (
            <div className="mb-3 relative">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Institución
              </label>
              <div className="relative">
                <select
                  value={selectedInstitutionId || ''}
                  onChange={(e) => {
                    const institutionId = e.target.value || null;
                    changeInstitution(institutionId);
                  }}
                  className="w-full text-sm border-2 border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent hover:border-purple-300 transition-all appearance-none"
                >
                  {institutions.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.nombre} {inst.activa && '✓'}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          )}
          
          {/* Info Usuario */}
          <div className="flex items-center space-x-3 mb-3">
            {/* Avatar con anillo degradado animado */}
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg relative z-10">
                {user?.nombre?.charAt(0)}{user?.apellido?.charAt(0)}
              </div>
              {/* Anillo pulsante */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 animate-ping opacity-20" />
              {/* Anillo estático con blur */}
              <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 opacity-30 blur-sm -z-10" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">
                {user?.nombre} {user?.apellido}
              </p>
              <p className="text-xs text-gray-600 truncate">{user?.email}</p>
            </div>
          </div>
          
          {/* Botones Perfil y Cerrar Sesión */}
          <div className="flex gap-2">
            <Link 
              to="/profile"
              onClick={() => setSidebarOpen(false)}
              className="flex-1 text-center px-3 py-2 text-xs font-semibold text-primary-700 bg-white border-2 border-primary-300 rounded-lg hover:bg-gradient-to-r hover:from-primary-600 hover:to-purple-600 hover:text-white hover:border-transparent transition-all duration-300 shadow-sm hover:shadow-md"
            >
              Perfil
            </Link>
            <button 
              onClick={logout}
              className="flex-1 text-center px-3 py-2 text-xs font-semibold text-white bg-gradient-to-r from-red-600 to-red-700 rounded-lg hover:from-red-700 hover:to-red-800 transition-all duration-300 shadow-sm hover:shadow-md"
            >
              Salir
            </button>
          </div>
        </div>

        {/* Menú de navegación móvil */}
        <nav className="flex-1 overflow-y-auto py-4 max-h-[calc(100vh-24rem)] custom-scrollbar">
          <div className="space-y-1 px-2">
            {filteredNav.map((item) => {
              if (item.children) {
                const isExpanded = expandedMenus[item.name] || hasActiveChild(item);
                const filteredChildren = item.children.filter(child =>
                  !child.roles || child.roles.includes(user?.rol)
                );

                return (
                  <div key={item.name}>
                    <button
                      onClick={() => toggleMenu(item.name)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 relative overflow-hidden group ${
                        hasActiveChild(item)
                          ? 'bg-gradient-to-r from-primary-100 to-purple-100 text-primary-700 shadow-sm'
                          : 'text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-purple-50/30 hover:text-gray-900'
                      }`}
                    >
                      {/* Borde degradado al hover */}
                      {!hasActiveChild(item) && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-l-lg" />
                      )}
                      {/* Borde degradado para item activo */}
                      {hasActiveChild(item) && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary-600 to-purple-700 rounded-l-lg" />
                      )}
                      
                      <div className="flex items-center relative z-10">
                        <span className="flex-shrink-0">{icons[item.name]}</span>
                        <span className="ml-3">{item.name}</span>
                      </div>
                      <svg
                        className={`w-4 h-4 transition-transform duration-300 relative z-10 ${isExpanded ? 'transform rotate-90' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    {isExpanded && (
                      <div className="ml-6 mt-1 space-y-1">
                        {filteredChildren.map((child) => (
                          <Link
                            key={child.name}
                            to={child.href}
                            onClick={() => setSidebarOpen(false)}
                            className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-300 relative group ${
                              isActive(child.href)
                                ? 'bg-gradient-to-r from-primary-50 to-purple-50 text-primary-700'
                                : 'text-gray-600 hover:bg-gradient-to-r hover:from-gray-50 hover:to-purple-50/20 hover:text-gray-900'
                            }`}
                          >
                            {/* Indicador de item activo */}
                            {isActive(child.href) && (
                              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-gradient-to-b from-primary-600 to-purple-700 rounded-full" />
                            )}
                            <span className="flex-shrink-0">{icons[child.name]}</span>
                            <span className="ml-3">{child.name}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 relative overflow-hidden group ${
                    isActive(item.href)
                      ? 'bg-gradient-to-r from-primary-100 to-purple-100 text-primary-700 shadow-sm'
                      : 'text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-purple-50/30 hover:text-gray-900'
                  }`}
                >
                  {/* Borde degradado al hover */}
                  {!isActive(item.href) && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-l-lg" />
                  )}
                  {/* Borde degradado para item activo */}
                  {isActive(item.href) && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary-600 to-purple-700 rounded-l-lg" />
                  )}
                  
                  <span className="flex-shrink-0 relative z-10">{icons[item.name]}</span>
                  <span className="ml-3 relative z-10">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </aside>

      {/* Contenido principal */}
      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}>
        {/* Top bar para móvil */}
        <div className="lg:hidden bg-gradient-to-r from-white via-blue-50/30 to-purple-50/30 shadow-md border-b border-purple-100/50 h-16 flex items-center justify-between px-4 sticky top-0 z-10 backdrop-blur-sm">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg text-gray-600 hover:text-primary-600 hover:bg-white/80 backdrop-blur-sm shadow-sm transition-all duration-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg font-bold bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent drop-shadow-sm">
            Gestión Escolar
          </h1>
          <div className="flex gap-3">
            {user?.rol === 'ESTUDIANTE' && <NotificationBadge />}
            <MensajeBadge />
          </div>
        </div>

        {/* Top bar para desktop */}
        <div className="hidden lg:flex bg-gradient-to-r from-white via-blue-50/20 to-purple-50/20 shadow-sm border-b border-purple-100/50 h-16 items-center justify-end px-6 sticky top-0 z-10 backdrop-blur-sm">
          <div className="flex gap-4 items-center">
            {user?.rol === 'ESTUDIANTE' && <NotificationBadge />}
            <MensajeBadge />
          </div>
        </div>

        {/* Contenido */}
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
      
      {/* Notificaciones de mensajes nuevos */}
      <MensajeNotification />
    </div>
  );
};

export default Layout;

