import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
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
  
  // Estados para actualización masiva
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [bulkPreview, setBulkPreview] = useState([]);
  const [bulkFileName, setBulkFileName] = useState('');
  const [bulkSummary, setBulkSummary] = useState(null);
  const [bulkError, setBulkError] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

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

  // Handlers para actualización masiva
  const resetBulkState = () => {
    setBulkPreview([]);
    setBulkFileName('');
    setBulkSummary(null);
    setBulkError('');
    setBulkLoading(false);
  };

  const handleOpenBulkUpdateModal = () => {
    resetBulkState();
    setShowBulkUpdateModal(true);
  };

  const handleCloseBulkUpdateModal = () => {
    resetBulkState();
    setShowBulkUpdateModal(false);
  };

  const handleDownloadBulkTemplate = async () => {
    try {
      const response = await api.get('/students/bulk-update-template', {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'plantilla_actualizacion_estudiantes.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Plantilla descargada exitosamente');
    } catch (error) {
      console.error('Error al descargar plantilla:', error);
      toast.error('Error al descargar la plantilla');
    }
  };

  const handleBulkFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setBulkError('');
    try {
      // Leer el archivo Excel
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      
      // Obtener la primera hoja
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convertir la hoja a JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      if (jsonData.length < 2) {
        throw new Error('El archivo debe incluir encabezados y al menos una fila de datos.');
      }

      // Procesar headers
      const rawHeaders = jsonData[0].map(header => String(header).trim());

      // Validar header obligatorio
      const hasNumeroId = rawHeaders.some(h => 
        h.toLowerCase().includes('numeroidentificacion') || 
        h.toLowerCase().includes('numero identificacion')
      );
      
      if (!hasNumeroId) {
        throw new Error('Falta la columna obligatoria: numeroIdentificacion');
      }

      // Procesar filas de datos
      const parsedData = [];
      for (let rowIndex = 1; rowIndex < jsonData.length; rowIndex += 1) {
        const row = jsonData[rowIndex];
        
        // Saltar filas vacías
        if (!row || row.every(cell => !cell || String(cell).trim() === '')) {
          continue;
        }

        const record = {};
        rawHeaders.forEach((header, columnIndex) => {
          if (!header) return;
          const value = row[columnIndex] !== undefined && row[columnIndex] !== null 
            ? String(row[columnIndex]).trim() 
            : '';
          record[header] = value;
        });

        // Verificar que tenga numeroIdentificacion
        const numeroIdKey = rawHeaders.find(h => 
          h.toLowerCase().includes('numeroidentificacion') || 
          h.toLowerCase().includes('numero identificacion')
        );
        
        if (record[numeroIdKey]) {
          parsedData.push(record);
        }
      }

      if (parsedData.length === 0) {
        throw new Error('No se encontraron registros válidos en el archivo.');
      }

      setBulkPreview(parsedData);
      setBulkFileName(file.name);
      setBulkSummary(null);
    } catch (error) {
      console.error('Error al procesar el archivo Excel:', error);
      setBulkPreview([]);
      setBulkFileName('');
      setBulkSummary(null);
      setBulkError(error.message || 'No se pudo procesar el archivo. Verifica el formato.');
    } finally {
      event.target.value = '';
    }
  };

  const handleConfirmBulkUpdate = async () => {
    if (bulkPreview.length === 0) {
      toast.error('No hay datos para actualizar');
      return;
    }

    setBulkLoading(true);
    setBulkError('');

    try {
      // Crear FormData con el archivo original
      const formData = new FormData();
      
      // Recrear el archivo Excel desde bulkPreview
      const workbook = XLSX.utils.book_new();
      const headers = Object.keys(bulkPreview[0]);
      const data = [
        headers,
        ...bulkPreview.map(item => headers.map(h => item[h] || ''))
      ];
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Estudiantes');
      
      const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
      const blob = new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      formData.append('file', blob, 'estudiantes.xlsx');

      // Enviar al backend
      const response = await api.post('/students/bulk-update', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setBulkSummary(response.data);
      setBulkPreview([]);
      
      if (response.data.resumen.errores === 0) {
        toast.success('Actualización completada exitosamente');
        fetchStudents(); // Refrescar la lista de estudiantes
      } else {
        toast.success(`Actualización completada con ${response.data.resumen.errores} error(es)`);
      }
    } catch (error) {
      console.error('Error al actualizar estudiantes:', error);
      setBulkError(error.response?.data?.error || 'Error al actualizar los estudiantes');
      toast.error('Error al actualizar los estudiantes');
    } finally {
      setBulkLoading(false);
    }
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
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header moderno con gradiente */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-xl shadow-medium p-6 text-white">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight mb-2">Estudiantes</h1>
            <p className="text-primary-100">Gestión de estudiantes del sistema educativo</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDownloadBulkTemplate}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200"
              title="Descargar plantilla para actualización masiva"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="font-medium">Plantilla</span>
            </button>
            <button
              onClick={handleOpenBulkUpdateModal}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200"
              title="Actualización masiva de estudiantes"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="font-medium">Actualizar Masivo</span>
            </button>
            <button
              onClick={fetchStudents}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200"
              title="Actualizar lista"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="font-medium">Actualizar</span>
            </button>
          </div>
        </div>
        
        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="bg-white bg-opacity-20 p-3 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold">{students.length}</p>
                <p className="text-sm text-primary-100">Estudiantes</p>
              </div>
            </div>
          </div>
          <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="bg-white bg-opacity-20 p-3 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold">{students.filter(s => s.user?.estado === 'ACTIVO').length}</p>
                <p className="text-sm text-primary-100">Activos</p>
              </div>
            </div>
          </div>
          <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="bg-white bg-opacity-20 p-3 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold">{courses.length}</p>
                <p className="text-sm text-primary-100">Cursos</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros mejorados con iconos */}
      <div className="card p-6 animate-slide-up">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filtros de Búsqueda
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Búsqueda */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <svg className="w-4 h-4 inline mr-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Buscar
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyPress={handleSearchKeyPress}
                className="flex-1 input-field"
                placeholder="Nombre, ID, email..."
              />
              <button
                onClick={handleSearch}
                className="btn-primary whitespace-nowrap"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Filtro por Curso */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <svg className="w-4 h-4 inline mr-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Curso
            </label>
            <select
              value={filters.grupoId}
              onChange={(e) => handleFilterChange('grupoId', e.target.value)}
              className="input-field"
            >
              <option value="">Todos los cursos</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.nombre}
                </option>
              ))}
            </select>
          </div>
          
          {/* Filtro por Estado */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <svg className="w-4 h-4 inline mr-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Estado
            </label>
            <select
              value={filters.estado}
              onChange={(e) => handleFilterChange('estado', e.target.value)}
              className="input-field"
            >
              <option value="">Todos</option>
              <option value="ACTIVO">Activo</option>
              <option value="INACTIVO">Inactivo</option>
              <option value="SUSPENDIDO">Suspendido</option>
            </select>
          </div>
          
          {/* Acciones */}
          <div className="space-y-2">
            <label className="flex items-center space-x-2 mt-2">
              <input
                type="checkbox"
                checked={filters.includeRetired}
                onChange={(e) => handleFilterChange('includeRetired', e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Incluir retirados</span>
            </label>
            <button
              onClick={clearFilters}
              className="w-full btn-outline text-sm"
            >
              Limpiar Filtros
            </button>
          </div>
        </div>
      </div>

      <div className="card animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="table-container">
          <table className="modern-table">
            <thead>
              <tr>
                <th className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                    </svg>
                    <span>ID</span>
                  </div>
                </th>
                <th className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>Estudiante</span>
                  </div>
                </th>
                <th className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>Email</span>
                  </div>
                </th>
                <th className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span>Curso</span>
                  </div>
                </th>
                <th className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Matrícula</span>
                  </div>
                </th>
                <th className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Estado</span>
                  </div>
                </th>
                <th className="px-6 py-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {!filters.grupoId && !filters.estado && !filters.search.trim() ? (
                <tr>
                  <td colSpan="7">
                    <div className="empty-state">
                      <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <h3 className="empty-state-title">Aplica filtros para ver estudiantes</h3>
                      <p className="empty-state-description">Usa los filtros de búsqueda, curso o estado para mostrar los estudiantes</p>
                    </div>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan="7">
                    <div className="empty-state">
                      <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      <h3 className="empty-state-title">No se encontraron estudiantes</h3>
                      <p className="empty-state-description">Intenta cambiar los filtros de búsqueda</p>
                    </div>
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id} className={`${student._isPending ? 'bg-warning-50' : ''} ${student.retirado ? 'bg-danger-50' : ''}`}>
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm font-medium text-gray-900">
                        {student.user?.numeroIdentificacion ?? '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        {/* Avatar con iniciales */}
                        <div className="avatar avatar-md bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-md">
                          {student.user?.nombre?.charAt(0) || 'S'}{student.user?.apellido?.charAt(0) || 'N'}
                        </div>
                        <div>
                          {student._isPending ? (
                            <span className="text-gray-900 font-semibold block">
                              {student.user?.apellido || ''} {student.user?.nombre || 'Sin nombre'}
                            </span>
                          ) : (
                            <Link
                              to={`/students/${student.id}`}
                              className="text-primary-600 hover:text-primary-800 font-semibold transition-colors block"
                            >
                              {student.user?.apellido || ''} {student.user?.nombre || 'Sin nombre'}
                            </Link>
                          )}
                          {student._isPending && (
                            <span className="badge badge-warning text-xs mt-1">Pendiente de registro</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        {student.user?.email || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {student.grupo ? (
                        <span className="badge badge-primary">
                          {student.grupo.nombre}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">Sin asignar</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm text-gray-600">
                        {student.matricula || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <span className={`badge ${
                          student.user?.estado === 'ACTIVO' 
                            ? 'badge-success' 
                            : student.user?.estado === 'SUSPENDIDO'
                            ? 'badge-warning'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          <span className={`status-dot mr-1.5 ${
                            student.user?.estado === 'ACTIVO' 
                              ? 'status-dot-success' 
                              : student.user?.estado === 'SUSPENDIDO'
                              ? 'status-dot-warning'
                              : 'bg-gray-500'
                          }`}></span>
                          {student.user?.estado || 'N/A'}
                        </span>
                        {student.retirado && (
                          <span className="badge badge-danger">Retirado</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {!student._isPending && (
                        <div className="flex space-x-2">
                          {student.retirado ? (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedStudent({ ...student, reactivationMode: 'reactivate' });
                                  setShowReactivationModal(true);
                                }}
                                className="text-info-600 hover:text-info-800 text-sm font-medium transition-colors"
                                title="Reactivar con segunda matrícula"
                              >
                                Reactivar
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedStudent({ ...student, reactivationMode: 'transfer' });
                                  setShowReactivationModal(true);
                                }}
                                className="text-success-600 hover:text-success-800 text-sm font-medium transition-colors"
                                title="Transferir a otra institución"
                              >
                                Transferir
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedStudent(student);
                                setShowWithdrawalModal(true);
                              }}
                              className="text-danger-600 hover:text-danger-800 text-sm font-medium transition-colors"
                              title="Retirar estudiante"
                            >
                              Retirar
                            </button>
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

      {/* Modal de Actualización Masiva */}
      {showBulkUpdateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Actualización Masiva de Estudiantes</h2>
            
            {/* Sección de carga de archivo */}
            {!bulkSummary && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <label className="flex flex-col items-center cursor-pointer">
                    <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-sm text-gray-600">Haz clic para seleccionar un archivo Excel</span>
                    <span className="text-xs text-gray-500 mt-1">(.xlsx)</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleBulkFile}
                      className="hidden"
                    />
                  </label>
                  {bulkFileName && (
                    <p className="mt-2 text-sm text-green-600 text-center">
                      Archivo seleccionado: {bulkFileName}
                    </p>
                  )}
                </div>

                {bulkError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {bulkError}
                  </div>
                )}

                {/* Preview de datos */}
                {bulkPreview.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Vista Previa ({bulkPreview.length} estudiantes)</h3>
                    <div className="border rounded-lg overflow-hidden">
                      <div className="max-h-96 overflow-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-xs">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                              {bulkPreview[0] && Object.keys(bulkPreview[0]).slice(0, 8).map((key, idx) => (
                                <th key={idx} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                  {key}
                                </th>
                              ))}
                              {bulkPreview[0] && Object.keys(bulkPreview[0]).length > 8 && (
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                  ... +{Object.keys(bulkPreview[0]).length - 8} campos
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {bulkPreview.slice(0, 10).map((student, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-3 py-2">{index + 1}</td>
                                {Object.keys(bulkPreview[0]).slice(0, 8).map((key, idx) => (
                                  <td key={idx} className="px-3 py-2">{student[key] || '-'}</td>
                                ))}
                                {Object.keys(bulkPreview[0]).length > 8 && (
                                  <td className="px-3 py-2 text-gray-400">...</td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {bulkPreview.length > 10 && (
                        <div className="bg-gray-50 px-4 py-2 text-xs text-gray-500 text-center">
                          Mostrando 10 de {bulkPreview.length} registros
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Resultados de la actualización */}
            {bulkSummary && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-800 mb-2">Resumen de Actualización</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Procesados</p>
                      <p className="text-xl font-bold text-gray-900">{bulkSummary.resumen.procesados}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Actualizados</p>
                      <p className="text-xl font-bold text-green-600">{bulkSummary.resumen.actualizados}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Omitidos</p>
                      <p className="text-xl font-bold text-yellow-600">{bulkSummary.resumen.omitidos}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Errores</p>
                      <p className="text-xl font-bold text-red-600">{bulkSummary.resumen.errores}</p>
                    </div>
                  </div>
                </div>

                {/* Lista de errores */}
                {bulkSummary.errores && bulkSummary.errores.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h3 className="font-semibold text-red-800 mb-2">Errores Encontrados</h3>
                    <div className="max-h-64 overflow-y-auto">
                      <ul className="space-y-2">
                        {bulkSummary.errores.map((error, index) => (
                          <li key={index} className="text-sm text-red-700">
                            <span className="font-semibold">Fila {error.fila}</span>
                            {error.numeroIdentificacion && error.numeroIdentificacion !== '-' && (
                              <span className="text-gray-600"> ({error.numeroIdentificacion})</span>
                            )}
                            : {error.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Botones */}
            <div className="flex justify-end space-x-3 pt-4 border-t mt-4">
              <button
                type="button"
                onClick={handleCloseBulkUpdateModal}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                {bulkSummary ? 'Cerrar' : 'Cancelar'}
              </button>
              {!bulkSummary && bulkPreview.length > 0 && (
                <button
                  type="button"
                  onClick={handleConfirmBulkUpdate}
                  disabled={bulkLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {bulkLoading && (
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {bulkLoading ? 'Actualizando...' : 'Confirmar Actualización'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Students;

