import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import StudentWithdrawalModal from '../components/StudentWithdrawalModal';
import StudentReactivationModal from '../components/StudentReactivationModal';

const Students = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [courses, setCourses] = useState([]);
  const [filters, setFilters] = useState({
    grupoId: '',
    estado: '',
    search: '',
    includeRetired: false,
  });
  const [searchInput, setSearchInput] = useState(''); // Estado separado para el input de búsqueda
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [showReactivationModal, setShowReactivationModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    // Solo cargar estudiantes si hay algún filtro activo
    const hasActiveFilter = filters.grupoId || filters.estado || (filters.search && filters.search.trim());
    if (hasActiveFilter) {
      fetchStudents();
    } else {
      // Si no hay filtros, limpiar la lista y resetear paginación
      setStudents([]);
      setPagination(prev => ({ ...prev, total: 0, pages: 0 }));
      setLoading(false);
    }
  }, [filters.grupoId, filters.estado, filters.search, filters.includeRetired, pagination.page]);

  const fetchCourses = async () => {
    try {
      const response = await api.get('/courses?limit=100');
      setCourses(response.data.data || []);
    } catch (error) {
      console.error('Error al cargar cursos:', error);
    }
  };

  const fetchStudents = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (filters.grupoId) {
        params.append('grupoId', filters.grupoId);
      }
      if (filters.estado) {
        params.append('estado', filters.estado);
      }
      // Aumentar el límite para permitir búsqueda completa en el cliente
      params.append('page', 1);
      params.append('limit', '1000');
      if (filters.includeRetired) {
        params.append('includeRetired', 'true');
      }
      const response = await api.get(`/students?${params.toString()}`);
      const studentsData = response.data.data || [];
      
      
      // Filtrar por curso si está seleccionado (asegurar que solo se muestren estudiantes del curso)
      let filteredStudents = studentsData;
      if (filters.grupoId) {
        filteredStudents = studentsData.filter(student => {
          // Solo incluir estudiantes que pertenezcan al curso seleccionado
          return student.grupoId === filters.grupoId;
        });
      }
      
      // Filtrar por búsqueda si hay texto (búsqueda en el cliente)
      if (filters.search && filters.search.trim()) {
        const searchLower = filters.search.toLowerCase().trim();
        filteredStudents = filteredStudents.filter(student => {
          const nombre = (student.user?.nombre || '').toLowerCase();
          const apellido = (student.user?.apellido || '').toLowerCase();
          const email = (student.user?.email || '').toLowerCase();
          const matricula = (student.matricula || '').toLowerCase();
          const numeroIdentificacion = (student.user?.numeroIdentificacion || '').toLowerCase();
          const nombreCompleto = `${apellido} ${nombre}`.toLowerCase();
          const nombreCompletoInverso = `${nombre} ${apellido}`.toLowerCase();
          return nombre.includes(searchLower) || 
                 apellido.includes(searchLower) || 
                 nombreCompleto.includes(searchLower) ||
                 nombreCompletoInverso.includes(searchLower) ||
                 email.includes(searchLower) ||
                 matricula.includes(searchLower) ||
                 numeroIdentificacion.includes(searchLower);
        });
      }
      
      // Filtrar por estado si está seleccionado
      if (filters.estado) {
        filteredStudents = filteredStudents.filter(student => {
          return student.user?.estado === filters.estado;
        });
      }

      // Ordenar por apellido y luego nombre (alfabético ascendente) como respaldo
      const sortedStudents = [...filteredStudents].sort((a, b) => {
        const apellidoA = (a.user?.apellido || '').toLowerCase();
        const apellidoB = (b.user?.apellido || '').toLowerCase();
        if (apellidoA !== apellidoB) {
          return apellidoA.localeCompare(apellidoB);
        }
        const nombreA = (a.user?.nombre || '').toLowerCase();
        const nombreB = (b.user?.nombre || '').toLowerCase();
        return nombreA.localeCompare(nombreB);
      });

      setStudents(sortedStudents);
      
      // Actualizar paginación basada en resultados filtrados
      const totalFiltered = filteredStudents.length;
      setPagination(prev => ({
        ...prev,
        total: totalFiltered,
        pages: Math.ceil(totalFiltered / prev.limit),
      }));
    } catch (error) {
      console.error('Error al cargar estudiantes:', error);
      setError('Error al cargar estudiantes');
      toast.error('Error al cargar estudiantes');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => {
      const newFilters = { ...prev, [key]: value };
      return newFilters;
    });
    setPagination(prev => ({ ...prev, page: 1 })); // Resetear a primera página al cambiar filtros
  };

  const handleSearch = () => {
    // Aplicar la búsqueda cuando se presiona el botón
    setFilters(prev => ({ ...prev, search: searchInput.trim() }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleSearchKeyPress = (e) => {
    // Permitir búsqueda al presionar Enter
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const clearFilters = () => {
    setSearchInput(''); // Limpiar también el input de búsqueda
    setFilters({
      grupoId: '',
      estado: '',
      search: '',
      includeRetired: false,
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleWithdrawalSuccess = () => {
    fetchStudents();
  };

  const handleReactivationSuccess = () => {
    fetchStudents();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        <span className="ml-4 text-gray-600">Cargando estudiantes...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={fetchStudents}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Estudiantes</h1>
        <button
          onClick={fetchStudents}
          className="text-primary-600 hover:text-primary-700 text-sm flex items-center"
          title="Actualizar lista"
        >
          <span className="mr-1">🔄</span> Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyPress={handleSearchKeyPress}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                placeholder="Número de identificación, nombre, apellido, email o matrícula..."
              />
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 whitespace-nowrap"
              >
                Buscar
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtrar por Curso
            </label>
            <select
              value={filters.grupoId}
              onChange={(e) => handleFilterChange('grupoId', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Todos los cursos</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtrar por Estado
            </label>
            <select
              value={filters.estado}
              onChange={(e) => handleFilterChange('estado', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Todos los estados</option>
              <option value="ACTIVO">Activo</option>
              <option value="INACTIVO">Inactivo</option>
              <option value="SUSPENDIDO">Suspendido</option>
            </select>
          </div>
          <div>
            <label className="flex items-center space-x-2 mt-2">
              <input
                type="checkbox"
                checked={filters.includeRetired}
                onChange={(e) => handleFilterChange('includeRetired', e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Incluir estudiantes retirados</span>
            </label>
          </div>
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="w-full px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm"
            >
              Limpiar Filtros
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Número de Identificación
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Curso
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Matrícula
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {!filters.grupoId && !filters.estado && !filters.search.trim() ? (
                <tr>
                  <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center py-8">
                      <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <p className="text-lg font-medium text-gray-700 mb-2">Aplica filtros para ver estudiantes</p>
                      <p className="text-sm text-gray-500">Usa los filtros de búsqueda, curso o estado para mostrar los estudiantes</p>
                    </div>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                    No se encontraron estudiantes con los filtros aplicados
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id} className={`hover:bg-gray-50 ${student._isPending ? 'bg-yellow-50' : ''} ${student.retirado ? 'bg-red-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {student.user?.numeroIdentificacion ?? '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {student._isPending ? (
                        <span className="text-gray-900 font-medium">
                          {student.user?.apellido || ''} {student.user?.nombre || 'Sin nombre'}
                          <span className="ml-2 text-xs text-yellow-600">(Pendiente de registro)</span>
                        </span>
                      ) : (
                        <Link
                          to={`/students/${student.id}`}
                          className="text-primary-600 hover:text-primary-900 font-medium"
                        >
                          {student.user?.apellido || ''} {student.user?.nombre || 'Sin nombre'}
                        </Link>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {student.user?.email || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {student.grupo ? (
                        <span className="text-blue-600">{student.grupo.nombre}</span>
                      ) : (
                        <span className="text-gray-400">Sin asignar</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {student.matricula || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        student.user?.estado === 'ACTIVO' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {student.user?.estado || 'N/A'}
                      </span>
                      {student._isPending && (
                        <span className="ml-2 px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          Pendiente
                        </span>
                      )}
                      {student.retirado && (
                        <span className="ml-2 px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                          Retirado
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {!student._isPending && (
                        <div className="flex space-x-2">
                          {student.retirado ? (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedStudent({ ...student, reactivationMode: 'reactivate' });
                                  setShowReactivationModal(true);
                                }}
                                className="text-blue-600 hover:text-blue-900 text-sm"
                                title="Reactivar con segunda matrícula"
                              >
                                Reactivar
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedStudent({ ...student, reactivationMode: 'transfer' });
                                  setShowReactivationModal(true);
                                }}
                                className="text-green-600 hover:text-green-900 text-sm"
                                title="Transferir a otra institución"
                              >
                                Transferir
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedStudent(student);
                                  setShowWithdrawalModal(true);
                                }}
                                className="text-red-600 hover:text-red-900 text-sm"
                                title="Retirar estudiante"
                              >
                                Retirar
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Paginación */}
        {pagination.pages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                disabled={pagination.page === pagination.pages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Mostrando <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> a{' '}
                  <span className="font-medium">
                    {Math.min(pagination.page * pagination.limit, pagination.total)}
                  </span>{' '}
                  de <span className="font-medium">{pagination.total}</span> resultados
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={pagination.page === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  {[...Array(pagination.pages)].map((_, i) => {
                    const page = i + 1;
                    if (
                      page === 1 ||
                      page === pagination.pages ||
                      (page >= pagination.page - 1 && page <= pagination.page + 1)
                    ) {
                      return (
                        <button
                          key={page}
                          onClick={() => setPagination(prev => ({ ...prev, page }))}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            pagination.page === page
                              ? 'z-10 bg-primary-50 border-primary-500 text-primary-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    } else if (page === pagination.page - 2 || page === pagination.page + 2) {
                      return (
                        <span key={page} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                          ...
                        </span>
                      );
                    }
                    return null;
                  })}
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                    disabled={pagination.page === pagination.pages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Siguiente
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modales */}
      {showWithdrawalModal && selectedStudent && (
        <StudentWithdrawalModal
          student={selectedStudent}
          onClose={() => {
            setShowWithdrawalModal(false);
            setSelectedStudent(null);
          }}
          onSuccess={handleWithdrawalSuccess}
        />
      )}

      {showReactivationModal && selectedStudent && (
        <StudentReactivationModal
          student={selectedStudent}
          onClose={() => {
            setShowReactivationModal(false);
            setSelectedStudent(null);
          }}
          onSuccess={handleReactivationSuccess}
        />
      )}
    </div>
  );
};

export default Students;

