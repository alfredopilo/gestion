import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';
import { api } from '../services/api';

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
    Asistencia: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    Pagos: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
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
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', roles: ['ADMIN', 'PROFESOR', 'ESTUDIANTE', 'REPRESENTANTE'] },
    { name: 'Estudiantes', href: '/students', roles: ['ADMIN', 'PROFESOR', 'SECRETARIA'] },
    { name: 'Cursos', href: '/courses', roles: ['ADMIN', 'PROFESOR', 'SECRETARIA'] },
    { name: 'Materias', href: '/subjects', roles: ['ADMIN', 'SECRETARIA'] },
    { name: 'Asignar Materias', href: '/assignments', roles: ['ADMIN', 'SECRETARIA'] },
    { name: 'Períodos', href: '/periods', roles: ['ADMIN', 'SECRETARIA'] },
    { name: 'Calificaciones', href: '/grades', roles: ['ADMIN', 'PROFESOR', 'ESTUDIANTE', 'REPRESENTANTE'] },
    { name: 'Ingresar Calificaciones', href: '/grade-entry', roles: ['ADMIN', 'PROFESOR', 'SECRETARIA'] },
    { name: 'Insumos', href: '/insumos', roles: ['ADMIN', 'PROFESOR', 'SECRETARIA'] },
    { name: 'Reportes', href: '/reports', roles: ['ADMIN', 'PROFESOR', 'SECRETARIA'] },
    { name: 'Asistencia', href: '/attendance', roles: ['ADMIN', 'PROFESOR', 'SECRETARIA'] },
    { name: 'Pagos', href: '/payments', roles: ['ADMIN', 'SECRETARIA', 'ESTUDIANTE', 'REPRESENTANTE'] },
    { name: 'Usuarios', href: '/users', roles: ['ADMIN', 'SECRETARIA'] },
    { 
      name: 'Configuración', 
      roles: ['ADMIN', 'SECRETARIA'],
      children: [
        { name: 'Configuración General', href: '/general-settings', roles: ['ADMIN', 'SECRETARIA'] },
        { name: 'Configuración Institución', href: '/institution-settings', roles: ['ADMIN'] },
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
        {/* Header del sidebar */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          {sidebarOpen && (
            <h1 className="text-xl font-bold text-primary-600">Gestión Escolar</h1>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
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

        {/* Menú de navegación */}
        <nav className="flex-1 overflow-y-auto py-4">
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
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        hasActiveChild(item)
                          ? 'bg-primary-100 text-primary-700'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                      title={!sidebarOpen ? item.name : ''}
                    >
                      <div className="flex items-center">
                        <span className="flex-shrink-0">{icons[item.name]}</span>
                        {sidebarOpen && <span className="ml-3">{item.name}</span>}
                      </div>
                      {sidebarOpen && (
                        <svg
                          className={`w-4 h-4 transition-transform ${isExpanded ? 'transform rotate-90' : ''}`}
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
                            className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                              isActive(child.href)
                                ? 'bg-primary-100 text-primary-700'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                          >
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
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive(item.href)
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                  title={!sidebarOpen ? item.name : ''}
                >
                  <span className="flex-shrink-0">{icons[item.name]}</span>
                  {sidebarOpen && <span className="ml-3">{item.name}</span>}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Selector de Institución */}
        {institutions.length > 0 && (
          <div className="border-t border-gray-200 p-4">
            {sidebarOpen ? (
              <>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Institución
                </label>
                <select
                  value={selectedInstitutionId || ''}
                  onChange={(e) => {
                    const institutionId = e.target.value || null;
                    changeInstitution(institutionId);
                  }}
                  className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                >
                  {institutions.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.nombre} {inst.activa && '(Activa)'}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <div className="flex justify-center">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            )}
          </div>
        )}

        {/* Footer del sidebar - Información del usuario */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-primary-600 text-sm font-semibold">
                  {user?.nombre?.charAt(0)}{user?.apellido?.charAt(0)}
                </span>
              </div>
            </div>
            {sidebarOpen && (
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.nombre} {user?.apellido}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            )}
          </div>
          {sidebarOpen && (
            <div className="mt-3 space-y-1">
              <Link
                to="/profile"
                className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Perfil
              </Link>
              <button
                onClick={logout}
                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md"
              >
                Cerrar Sesión
              </button>
            </div>
          )}
        </div>
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
        {/* Header del sidebar móvil */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-primary-600">Gestión Escolar</h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Menú de navegación móvil */}
        <nav className="flex-1 overflow-y-auto py-4">
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
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        hasActiveChild(item)
                          ? 'bg-primary-100 text-primary-700'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      <div className="flex items-center">
                        <span className="flex-shrink-0">{icons[item.name]}</span>
                        <span className="ml-3">{item.name}</span>
                      </div>
                      <svg
                        className={`w-4 h-4 transition-transform ${isExpanded ? 'transform rotate-90' : ''}`}
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
                            className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                              isActive(child.href)
                                ? 'bg-primary-100 text-primary-700'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                          >
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
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive(item.href)
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <span className="flex-shrink-0">{icons[item.name]}</span>
                  <span className="ml-3">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Selector de Institución móvil */}
        {institutions.length > 0 && (
          <div className="border-t border-gray-200 p-4">
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Institución
            </label>
            <select
              value={selectedInstitutionId || ''}
              onChange={(e) => {
                const institutionId = e.target.value || null;
                changeInstitution(institutionId);
              }}
              className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            >
              {institutions.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.nombre} {inst.activa && '(Activa)'}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Footer del sidebar móvil */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center mb-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-primary-600 text-sm font-semibold">
                {user?.nombre?.charAt(0)}{user?.apellido?.charAt(0)}
              </span>
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.nombre} {user?.apellido}
              </p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          <div className="space-y-1">
            <Link
              to="/profile"
              onClick={() => setSidebarOpen(false)}
              className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
            >
              Perfil
            </Link>
            <button
              onClick={logout}
              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </aside>

      {/* Contenido principal */}
      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}>
        {/* Top bar para móvil */}
        <div className="lg:hidden bg-white shadow-sm border-b h-16 flex items-center justify-between px-4 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-primary-600">Gestión Escolar</h1>
          <div className="w-10"></div>
        </div>

        {/* Contenido */}
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;

