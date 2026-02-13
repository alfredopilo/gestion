import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';

const CourseDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { selectedInstitutionId, user } = useAuth();
  const cancelledRef = useRef(false);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [gradeScales, setGradeScales] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedPeriodoDestino, setSelectedPeriodoDestino] = useState('');
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [assignmentFormData, setAssignmentFormData] = useState({
    materiaId: '',
    docenteId: '',
    gradeScaleId: '',
    horarios: [], // Array de { hora: number, diasSemana: string[] }
  });
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState([]);
  const [importFileName, setImportFileName] = useState('');
  const [importSummary, setImportSummary] = useState(null);
  const [importDetails, setImportDetails] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');

  useEffect(() => {
    if (!selectedInstitutionId) return;
    cancelledRef.current = false;
    setLoading(true);
    setCourse(null);
    setAvailableStudents([]);
    setFilteredStudents([]);
    setSubjects([]);
    setTeachers([]);
    fetchCourse();
    return () => { cancelledRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, selectedInstitutionId]);

  useEffect(() => {
    if (course?.id && (user?.rol === 'ADMIN' || user?.rol === 'SECRETARIA')) {
      cancelledRef.current = false;
      fetchAvailableStudents();
      return () => { cancelledRef.current = true; };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course?.id, user?.rol]);

  const fetchCourse = async () => {
    try {
      const response = await api.get(`/courses/${id}`);
      if (!cancelledRef.current) setCourse(response.data);
    } catch (error) {
      if (!cancelledRef.current) {
        console.error('Error al cargar curso:', error);
        if (error.response?.status === 403) {
          toast.error('Este curso no pertenece a la institución seleccionada.');
        } else if (error.response?.status === 404) {
          toast.error('Curso no encontrado en la institución actual.');
        } else {
          toast.error('Error al cargar información del curso');
        }
        navigate('/courses');
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  };

  const fetchAvailableStudents = async () => {
    if (!course?.id) return;
    
    // Solo permitir a ADMIN y SECRETARIA cargar estudiantes disponibles
    if (user?.rol !== 'ADMIN' && user?.rol !== 'SECRETARIA') {
      return;
    }
    
    try {
      const response = await api.get(`/courses/available-students?cursoId=${id}`);
      const students = response.data.data || [];
      if (!cancelledRef.current) {
        setAvailableStudents(students);
        setFilteredStudents(students);
      }
    } catch (error) {
      if (!cancelledRef.current) {
        console.error('Error al cargar estudiantes disponibles:', error);
        if (error.response?.status !== 403) {
          toast.error('Error al cargar estudiantes disponibles');
        }
      }
    }
  };

  // Filtrar estudiantes según búsqueda
  useEffect(() => {
    if (!studentSearch.trim()) {
      setFilteredStudents(availableStudents);
      return;
    }

    const searchLower = studentSearch.toLowerCase().trim();
    const filtered = availableStudents.filter((student) => {
      const nombre = (student.user?.nombre || '').toLowerCase();
      const apellido = (student.user?.apellido || '').toLowerCase();
      const email = (student.user?.email || '').toLowerCase();
      const matricula = (student.matricula || '').toLowerCase();
      const fullName = `${nombre} ${apellido}`.toLowerCase();
      
      return (
        nombre.includes(searchLower) ||
        apellido.includes(searchLower) ||
        email.includes(searchLower) ||
        matricula.includes(searchLower) ||
        fullName.includes(searchLower)
      );
    });

    setFilteredStudents(filtered);
  }, [studentSearch, availableStudents]);

  const fetchSubjectsAndTeachers = async () => {
    try {
      const [subjectsRes, teachersRes, periodsRes, gradeScalesRes] = await Promise.all([
        api.get('/subjects?limit=100'),
        api.get('/teachers?limit=100'),
        api.get('/periods?limit=100'), // Mantener para el modal de promoción
        api.get('/grade-scales?limit=100'),
      ]);

      setSubjects(subjectsRes.data.data || []);
      
      // Filtrar solo profesores activos
      const activeTeachers = (teachersRes.data.data || []).filter(
        t => t.user && t.user.estado === 'ACTIVO'
      );
      setTeachers(activeTeachers);
      
      setPeriods(periodsRes.data.data || []);
      setGradeScales(gradeScalesRes.data?.data || []);
    } catch (error) {
      console.error('Error al cargar materias y docentes:', error);
    }
  };

  const handleAddStudent = async () => {
    if (!selectedStudentId) {
      toast.error('Debes seleccionar un estudiante');
      return;
    }

    try {
      await api.post(`/courses/${id}/students`, { estudianteId: selectedStudentId });
      toast.success('Estudiante agregado al curso exitosamente');
      
      // Limpiar selección y búsqueda
      setSelectedStudentId('');
      setStudentSearch('');
      
      // Actualizar el curso primero
      await fetchCourse();
      
      // Luego refrescar la lista de estudiantes disponibles
      await fetchAvailableStudents();
      
      // Cerrar el modal después de actualizar
      setShowStudentModal(false);
    } catch (error) {
      console.error('Error al agregar estudiante:', error);
      toast.error(error.response?.data?.error || 'Error al agregar estudiante');
    }
  };

  const resetImportState = () => {
    setImportPreview([]);
    setImportFileName('');
    setImportSummary(null);
    setImportDetails(null);
    setImportError('');
    setImportLoading(false);
  };

  const handleOpenImportModal = () => {
    resetImportState();
    setShowImportModal(true);
  };

  const handleCloseImportModal = () => {
    resetImportState();
    setShowImportModal(false);
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setImportError('');
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

      const headerMap = {
        nombre: 'nombre',
        apellido: 'apellido',
        email: 'email',
        telefono: 'telefono',
        direccion: 'direccion',
        numeroidentificacion: 'numeroIdentificacion',
        'numero identificacion': 'numeroIdentificacion',
        numero_identificacion: 'numeroIdentificacion',
        genero: 'genero',
        fechanacimiento: 'fechaNacimiento',
        'fecha nacimiento': 'fechaNacimiento',
        fecha_nacimiento: 'fechaNacimiento',
        password: 'password',
      };

      // Procesar headers
      const rawHeaders = jsonData[0].map(header => String(header).trim());
      const headers = rawHeaders.map(header => headerMap[header.toLowerCase()] ?? header);

      const requiredHeaders = ['nombre', 'apellido', 'numeroIdentificacion'];
      const missingHeaders = requiredHeaders.filter(required => !headers.includes(required));
      if (missingHeaders.length > 0) {
        throw new Error(`Faltan las columnas obligatorias: ${missingHeaders.join(', ')}`);
      }

      // Procesar filas de datos
      const parsedStudents = [];
      for (let rowIndex = 1; rowIndex < jsonData.length; rowIndex += 1) {
        const row = jsonData[rowIndex];
        
        // Saltar filas vacías
        if (!row || row.every(cell => !cell || String(cell).trim() === '')) {
          continue;
        }

        const record = {};
        headers.forEach((header, columnIndex) => {
          if (!header) return;
          const value = row[columnIndex] !== undefined && row[columnIndex] !== null 
            ? String(row[columnIndex]).trim() 
            : '';
          if (value !== '') {
            record[header] = value;
          }
        });

        if (Object.keys(record).length > 0 && record.nombre && record.apellido && record.numeroIdentificacion) {
          parsedStudents.push(record);
        }
      }

      if (parsedStudents.length === 0) {
        throw new Error('No se encontraron registros válidos en el archivo.');
      }

      setImportPreview(parsedStudents);
      setImportFileName(file.name);
      setImportSummary(null);
      setImportDetails(null);
    } catch (error) {
      console.error('Error al procesar el archivo Excel:', error);
      setImportPreview([]);
      setImportFileName('');
      setImportSummary(null);
      setImportDetails(null);
      setImportError(error.message || 'No se pudo procesar el archivo. Verifica el formato.');
    } finally {
      event.target.value = '';
    }
  };

  const handleImportSubmit = async () => {
    if (importPreview.length === 0) {
      setImportError('Debes seleccionar un archivo con al menos un estudiante.');
      return;
    }

    setImportLoading(true);
    setImportError('');
    try {
      const response = await api.post(`/courses/${id}/import-students`, {
        students: importPreview,
      });

      toast.success(response.data?.message || 'Importación completada exitosamente.');
      setImportSummary(response.data?.resumen || null);
      setImportDetails({
        nuevos: response.data?.nuevos || [],
        omitidos: response.data?.omitidos || [],
        errores: response.data?.errores || [],
      });
      setImportPreview([]);
      setImportFileName('');

      await fetchCourse();
    } catch (error) {
      console.error('Error al importar estudiantes:', error);
      setImportError(error.response?.data?.error || 'Error al importar estudiantes.');
      toast.error(error.response?.data?.error || 'Error al importar estudiantes.');
    } finally {
      setImportLoading(false);
    }
  };

const handleDownloadTemplate = async () => {
  try {
    const response = await api.get('/courses/import-template', {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'plantilla_importacion_estudiantes.xlsx');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error al descargar la plantilla:', error);
    toast.error('No se pudo descargar la plantilla. Intenta nuevamente.');
  }
};

  const handleRemoveStudent = async (estudianteId) => {
    if (!window.confirm('¿Estás seguro de remover este estudiante del curso?')) {
      return;
    }

    try {
      await api.delete(`/courses/${id}/students/${estudianteId}`);
      toast.success('Estudiante removido del curso exitosamente');
      fetchCourse();
      fetchAvailableStudents();
    } catch (error) {
      console.error('Error al remover estudiante:', error);
      toast.error(error.response?.data?.error || 'Error al remover estudiante');
    }
  };

  const handleAddSubject = () => {
    setEditingAssignment(null);
    setAssignmentFormData({
      materiaId: '',
      docenteId: '',
      gradeScaleId: '',
      horarios: [],
    });
    fetchSubjectsAndTeachers();
    setShowSubjectModal(true);
  };

  const handleEditAssignment = (assignment) => {
    setEditingAssignment(assignment);
    
    // Convertir horarios de la base de datos al formato del formulario
    const horariosFormatted = [];
    if (assignment.horarios && assignment.horarios.length > 0) {
      // Agrupar por hora
      const horariosPorHora = {};
      assignment.horarios.forEach(h => {
        if (!horariosPorHora[h.hora]) {
          horariosPorHora[h.hora] = [];
        }
        horariosPorHora[h.hora].push(h.diaSemana);
      });
      
      // Convertir a formato del formulario
      Object.keys(horariosPorHora).forEach(hora => {
        horariosFormatted.push({
          hora: parseInt(hora),
          diasSemana: horariosPorHora[hora],
        });
      });
    }
    
    setAssignmentFormData({
      materiaId: assignment.materiaId,
      docenteId: assignment.docenteId,
      gradeScaleId: assignment.gradeScaleId || '',
      horarios: horariosFormatted,
    });
    fetchSubjectsAndTeachers();
    setShowSubjectModal(true);
  };

  const addHorario = () => {
    setAssignmentFormData({
      ...assignmentFormData,
      horarios: [...assignmentFormData.horarios, { hora: 1, diasSemana: [] }],
    });
  };

  const removeHorario = (index) => {
    setAssignmentFormData({
      ...assignmentFormData,
      horarios: assignmentFormData.horarios.filter((_, i) => i !== index),
    });
  };

  const updateHorarioHora = (index, hora) => {
    const newHorarios = [...assignmentFormData.horarios];
    newHorarios[index].hora = parseInt(hora);
    setAssignmentFormData({ ...assignmentFormData, horarios: newHorarios });
  };

  const toggleDiaSemana = (horarioIndex, dia) => {
    const newHorarios = [...assignmentFormData.horarios];
    const diasSemana = newHorarios[horarioIndex].diasSemana || [];
    if (diasSemana.includes(dia)) {
      newHorarios[horarioIndex].diasSemana = diasSemana.filter(d => d !== dia);
    } else {
      newHorarios[horarioIndex].diasSemana = [...diasSemana, dia];
    }
    setAssignmentFormData({ ...assignmentFormData, horarios: newHorarios });
  };

  const handleSubmitAssignment = async (e) => {
    e.preventDefault();
    
    // Validar campos requeridos
    if (!assignmentFormData.docenteId) {
      toast.error('Debes seleccionar un docente');
      return;
    }
    
    if (!assignmentFormData.gradeScaleId) {
      toast.error('Debes seleccionar una escala de calificación');
      return;
    }
    
    try {
      const requestData = {
        docenteId: assignmentFormData.docenteId,
        gradeScaleId: assignmentFormData.gradeScaleId || null,
      };
      
      if (assignmentFormData.horarios && assignmentFormData.horarios.length > 0) {
        requestData.horarios = assignmentFormData.horarios.filter(h => h.diasSemana && h.diasSemana.length > 0);
      }
      
      if (editingAssignment) {
        // Actualizar asignación existente
        await api.put(`/assignments/${editingAssignment.id}`, requestData);
        toast.success('Asignación actualizada exitosamente');
      } else {
        // Validar materia para nueva asignación
        if (!assignmentFormData.materiaId) {
          toast.error('Debes seleccionar una materia');
          return;
        }
        
        // Crear nueva asignación
        await api.post('/assignments', {
          cursoId: id,
          materiaId: assignmentFormData.materiaId,
          docenteId: assignmentFormData.docenteId,
          gradeScaleId: assignmentFormData.gradeScaleId,
          ...(requestData.horarios && { horarios: requestData.horarios }),
        });
        toast.success('Materia asignada al curso exitosamente');
      }

      setShowSubjectModal(false);
      fetchCourse();
    } catch (error) {
      console.error('Error al guardar asignación:', error);
      toast.error(error.response?.data?.error || 'Error al guardar asignación');
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    if (!window.confirm('¿Estás seguro de eliminar esta asignación de materia?')) {
      return;
    }

    try {
      await api.delete(`/assignments/${assignmentId}`);
      toast.success('Asignación eliminada exitosamente');
      fetchCourse();
    } catch (error) {
      console.error('Error al eliminar asignación:', error);
      toast.error(error.response?.data?.error || 'Error al eliminar asignación');
    }
  };

  const handlePromoteStudents = async () => {
    if (!course?.cursoSiguiente) {
      toast.error('Este curso no tiene un siguiente grado configurado');
      return;
    }

    try {
      const data = selectedPeriodoDestino ? { periodoIdDestino: selectedPeriodoDestino } : {};
      const response = await api.post(`/courses/${id}/promote`, data);
      toast.success(response.data.message || 'Estudiantes promocionados exitosamente');
      setShowPromoteModal(false);
      setSelectedPeriodoDestino('');
      fetchCourse();
    } catch (error) {
      console.error('Error al promocionar estudiantes:', error);
      toast.error(error.response?.data?.error || 'Error al promocionar estudiantes');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        <span className="ml-4 text-gray-600">Cargando información...</span>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Curso no encontrado</p>
        <button
          onClick={() => navigate('/courses')}
          className="mt-4 text-primary-600 hover:text-primary-700"
        >
          Volver a cursos
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/courses')}
            className="text-primary-600 hover:text-primary-700 mb-2"
          >
            ← Volver a cursos
          </button>
          <h1 className="text-3xl font-bold text-gray-900">{course.nombre}</h1>
          <p className="mt-2 text-gray-600">
            {course.nivel} - {course.paralelo || 'Sin paralelo'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Información General */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Información del Curso</h2>
            <div className="space-y-3">
              {course.periodo && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Período</label>
                  <p className="mt-1 text-gray-900">{course.periodo.nombre}</p>
                  {course.periodo.fechaInicio && course.periodo.fechaFin && (
                    <p className="text-xs text-gray-500 mt-1">
                      {format(new Date(course.periodo.fechaInicio), 'dd/MM/yyyy')} -{' '}
                      {format(new Date(course.periodo.fechaFin), 'dd/MM/yyyy')}
                    </p>
                  )}
                </div>
              )}
              {course.docente && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Docente</label>
                  <p className="mt-1 text-gray-900">
                    {course.docente.user?.nombre} {course.docente.user?.apellido}
                  </p>
                  {course.docente.user?.email && (
                    <p className="text-xs text-gray-500 mt-1">{course.docente.user.email}</p>
                  )}
                </div>
              )}
              {course.capacidad && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Capacidad</label>
                  <p className="mt-1 text-gray-900">
                    {course.estudiantes?.length || 0} / {course.capacidad} estudiantes
                  </p>
                </div>
              )}
              {course.cursoSiguiente && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Siguiente Grado</label>
                  <p className="mt-1 text-gray-900 text-blue-600">
                    {course.cursoSiguiente.nombre}
                  </p>
                  {course.estudiantes && course.estudiantes.length > 0 && !course.ultimoCurso && (
                    <button
                      onClick={() => setShowPromoteModal(true)}
                      className="mt-2 w-full bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 text-sm"
                    >
                      🎓 Promocionar Estudiantes
                    </button>
                  )}
                </div>
              )}
              {course.ultimoCurso && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Último curso</label>
                  <p className="mt-1 text-gray-900 font-semibold text-orange-600">
                    Sí
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Los estudiantes de este curso no se promocionan; datos históricos.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Estudiantes y Materias */}
        <div className="lg:col-span-2">
          {/* Estudiantes */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                Estudiantes ({course.estudiantes?.length || 0}{course.capacidad ? ` / ${course.capacidad}` : ''})
              </h2>
              {(user?.rol === 'ADMIN' || user?.rol === 'SECRETARIA') && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleOpenImportModal}
                    className="bg-blue-100 text-blue-700 px-4 py-2 rounded-md hover:bg-blue-200 text-sm"
                    disabled={importLoading}
                  >
                    📥 Importar estudiantes
                  </button>
                  <button
                    onClick={async () => {
                      await fetchAvailableStudents();
                      setShowStudentModal(true);
                    }}
                    className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 text-sm"
                    disabled={course.capacidad && (course.estudiantes?.length || 0) >= course.capacidad}
                  >
                    + Agregar Estudiante
                  </button>
                </div>
              )}
            </div>
            {course.estudiantes && course.estudiantes.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Nombre
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Email
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Matrícula
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {course.estudiantes.map((student) => (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-medium text-gray-900">
                            {student.user?.apellido} {student.user?.nombre}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {student.user?.email || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {student.matricula || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                          <Link
                            to={`/students/${student.id}`}
                            className="text-primary-600 hover:text-primary-900 mr-4"
                          >
                            Ver
                          </Link>
                          <button
                            onClick={() => handleRemoveStudent(student.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">No hay estudiantes inscritos en este curso</p>
            )}
          </div>

          {/* Materias */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                Materias ({course.asignacionesMaterias?.length || 0})
              </h2>
              <button
                onClick={handleAddSubject}
                className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 text-sm"
              >
                + Agregar Materia
              </button>
            </div>
            {course.asignacionesMaterias && course.asignacionesMaterias.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {course.asignacionesMaterias.map((asignacion) => (
                  <div
                    key={asignacion.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow relative"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-lg">{asignacion.materia?.nombre}</h3>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditAssignment(asignacion)}
                          className="text-primary-600 hover:text-primary-900 text-sm"
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteAssignment(asignacion.id)}
                          className="text-red-600 hover:text-red-900 text-sm"
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p>
                        <span className="font-medium">Código:</span> {asignacion.materia?.codigo || '-'}
                      </p>
                      {asignacion.materia?.creditos && (
                        <p>
                          <span className="font-medium">Créditos:</span> {asignacion.materia.creditos}
                        </p>
                      )}
                      {asignacion.materia?.horas && (
                        <p>
                          <span className="font-medium">Horas:</span> {asignacion.materia.horas}
                        </p>
                      )}
                      {asignacion.docente && (
                        <p>
                          <span className="font-medium">Docente:</span>{' '}
                          {asignacion.docente.user?.nombre} {asignacion.docente.user?.apellido}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No hay materias asignadas a este curso</p>
            )}
          </div>
        </div>
      </div>

      {/* Modal para agregar estudiante */}
      {showStudentModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Agregar Estudiante al Curso</h2>
              <button
                onClick={fetchAvailableStudents}
                className="text-primary-600 hover:text-primary-700 text-sm flex items-center"
                title="Actualizar lista"
              >
                <span className="mr-1">🔄</span> Actualizar
              </button>
            </div>

            {/* Barra de búsqueda */}
            {availableStudents.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Buscar Estudiante
                </label>
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Buscar por nombre, apellido, email o matrícula..."
                  className="w-full border border-gray-300 rounded-md px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                {filteredStudents.length !== availableStudents.length && (
                  <p className="text-xs text-gray-500 mt-1">
                    Mostrando {filteredStudents.length} de {availableStudents.length} estudiantes
                  </p>
                )}
              </div>
            )}

            {availableStudents.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">
                  No hay estudiantes disponibles sin curso asignado en el período actual.
                </p>
                <p className="text-sm text-gray-400">
                  Asegúrate de que los estudiantes estén activos y sin curso asignado.
                </p>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-2">No se encontraron estudiantes con la búsqueda "{studentSearch}"</p>
                <button
                  onClick={() => setStudentSearch('')}
                  className="text-primary-600 hover:text-primary-700 text-sm"
                >
                  Limpiar búsqueda
                </button>
              </div>
            ) : (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seleccionar Estudiante <span className="text-red-500">*</span>
                </label>
                <div className="max-h-96 overflow-y-auto border border-gray-300 rounded-md">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-12">
                          Seleccionar
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Nombre
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Email
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Matrícula
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Curso Actual
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredStudents.map((student) => (
                        <tr
                          key={student.id}
                          className={`hover:bg-gray-50 cursor-pointer ${
                            selectedStudentId === student.id ? 'bg-primary-50' : ''
                          }`}
                          onClick={() => setSelectedStudentId(student.id)}
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="radio"
                              name="student"
                              value={student.id}
                              checked={selectedStudentId === student.id}
                              onChange={() => setSelectedStudentId(student.id)}
                              className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="font-medium text-gray-900">
                              {student.user?.apellido} {student.user?.nombre}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {student.user?.email || '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {student.matricula || '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {student.grupo ? (
                              <span className="text-orange-600">
                                {student.grupo.nombre}
                                {student.grupo.periodo && ` (${student.grupo.periodo.nombre})`}
                              </span>
                            ) : (
                              <span className="text-green-600">Sin curso</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <div className="text-sm text-gray-500">
                {selectedStudentId && (
                  <span>
                    Estudiante seleccionado: {
                      filteredStudents.find(s => s.id === selectedStudentId)?.user?.nombre
                    } {
                      filteredStudents.find(s => s.id === selectedStudentId)?.user?.apellido
                    }
                  </span>
                )}
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowStudentModal(false);
                    setSelectedStudentId('');
                    setStudentSearch('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                {filteredStudents.length > 0 && (
                  <button
                    onClick={handleAddStudent}
                    disabled={!selectedStudentId}
                    className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Agregar Estudiante
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para agregar/editar materia */}
      {showSubjectModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingAssignment ? 'Editar Asignación de Materia' : 'Agregar Materia al Curso'}
            </h2>
            <form onSubmit={handleSubmitAssignment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Materia <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={assignmentFormData.materiaId}
                  onChange={(e) => setAssignmentFormData({ ...assignmentFormData, materiaId: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  disabled={!!editingAssignment}
                >
                  <option value="">Selecciona una materia...</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.nombre} ({subject.codigo})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Docente <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={assignmentFormData.docenteId}
                  onChange={(e) => setAssignmentFormData({ ...assignmentFormData, docenteId: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">Selecciona un docente...</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.user?.nombre} {teacher.user?.apellido} - {teacher.user?.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Escala de Calificación <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={assignmentFormData.gradeScaleId}
                  onChange={(e) => setAssignmentFormData({ ...assignmentFormData, gradeScaleId: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">Selecciona una escala...</option>
                  {gradeScales.map((scale) => (
                    <option key={scale.id} value={scale.id}>
                      {scale.nombre}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  La escala se usará para convertir promedios numéricos a letras o categorías
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Horarios
                  </label>
                  <button
                    type="button"
                    onClick={addHorario}
                    className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-md hover:bg-blue-200"
                  >
                    + Agregar Hora
                  </button>
                </div>
                
                {assignmentFormData.horarios.length === 0 ? (
                  <p className="text-sm text-gray-500 mb-2">No hay horarios agregados. Haz clic en "+ Agregar Hora" para comenzar.</p>
                ) : (
                  <div className="space-y-3">
                    {assignmentFormData.horarios.map((horario, index) => (
                      <div key={index} className="border border-gray-200 rounded-md p-3 bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium text-gray-700">
                            Hora:
                          </label>
                          <button
                            type="button"
                            onClick={() => removeHorario(index)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Eliminar
                          </button>
                        </div>
                        <select
                          value={horario.hora}
                          onChange={(e) => updateHorarioHora(index, e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 mb-2"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8].map(h => (
                            <option key={h} value={h}>Hora {h}</option>
                          ))}
                        </select>
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-1 block">
                            Días de la Semana:
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(dia => (
                              <label key={dia} className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={(horario.diasSemana || []).includes(dia)}
                                  onChange={() => toggleDiaSemana(index, dia)}
                                  className="mr-1"
                                />
                                <span className="text-sm">{dia}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowSubjectModal(false);
                    setEditingAssignment(null);
                    setAssignmentFormData({ materiaId: '', docenteId: '', gradeScaleId: '', horarios: [] });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                >
                  {editingAssignment ? 'Actualizar' : 'Agregar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para importar estudiantes */}
      {showImportModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-xl font-bold">Importar estudiantes mediante Excel</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Usa la plantilla para asegurar los encabezados correctos:{' '}
                  <span className="font-mono text-xs">
                    nombre, apellido, numeroIdentificacion, email, telefono, direccion, genero, fechaNacimiento, password
                  </span>
                  . Campos obligatorios: <strong>nombre</strong>, <strong>apellido</strong> y{' '}
                  <strong>numeroIdentificacion</strong>.
                </p>
              </div>
              <button
                onClick={handleDownloadTemplate}
                className="bg-blue-100 text-blue-700 px-3 py-2 rounded-md hover:bg-blue-200 text-sm font-medium"
              >
                📄 Descargar plantilla
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Archivo Excel <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={handleImportFile}
                  className="w-full text-sm text-gray-700"
                  disabled={importLoading}
                />
                {importFileName && (
                  <p className="text-xs text-gray-500 mt-1">Archivo seleccionado: {importFileName}</p>
                )}
              </div>

              {importError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                  {importError}
                </div>
              )}

              {importPreview.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-3 max-h-56 overflow-y-auto text-sm">
                  <p className="font-medium mb-2">
                    Vista previa ({Math.min(importPreview.length, 5)} de {importPreview.length} registros)
                  </p>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Apellido</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {importPreview.slice(0, 5).map((student, idx) => (
                        <tr key={`preview-${idx}`}>
                          <td className="px-3 py-2 whitespace-nowrap">{student.nombre}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{student.apellido}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{student.numeroIdentificacion}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{student.email || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {importSummary && (
                <div className="border border-green-200 bg-green-50 rounded-lg p-4 text-sm space-y-3">
                  <div>
                    <p className="font-semibold text-green-700 mb-1">Resumen de la importación</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Procesados: {importSummary.procesados}</li>
                      <li>Usuarios creados: {importSummary.nuevosUsuarios}</li>
                      <li>Estudiantes asignados al curso: {importSummary.estudiantesAsignados}</li>
                      <li>Registros omitidos: {importSummary.omitidos}</li>
                      <li>Errores: {importSummary.errores}</li>
                    </ul>
                  </div>

                  {importDetails?.nuevos?.length > 0 && (
                    <div>
                      <p className="font-semibold text-green-700 mb-1">Usuarios creados</p>
                      <ul className="list-disc pl-5 space-y-1">
                        {importDetails.nuevos.map((student, idx) => (
                          <li key={`nuevo-${idx}`}>
                            {student.nombreCompleto} — {student.email} (ID: {student.numeroIdentificacion}) — Password
                            temporal:{' '}
                            <span className="font-mono bg-white border border-green-200 rounded px-1">
                              {student.passwordTemporal}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {importDetails?.omitidos?.length > 0 && (
                    <div>
                      <p className="font-semibold text-yellow-700 mb-1">Registros omitidos</p>
                      <ul className="list-disc pl-5 space-y-1 text-yellow-700">
                        {importDetails.omitidos.map((item, idx) => (
                          <li key={`omitido-${idx}`}>
                            Fila {item.fila}: {item.nombreCompleto}. {item.motivo}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {importDetails?.errores?.length > 0 && (
                    <div>
                      <p className="font-semibold text-red-700 mb-1">Errores durante la importación</p>
                      <ul className="list-disc pl-5 space-y-1 text-red-700">
                        {importDetails.errores.map((item, idx) => (
                          <li key={`error-${idx}`}>
                            Fila {item.fila}: {item.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={handleCloseImportModal}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                {importSummary ? 'Cerrar' : 'Cancelar'}
              </button>
              <button
                onClick={handleImportSubmit}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                disabled={importLoading || importPreview.length === 0}
              >
                {importLoading ? 'Importando...' : 'Importar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para promocionar estudiantes */}
      {showPromoteModal && course?.cursoSiguiente && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Promocionar Estudiantes</h2>
            
            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-700 mb-2">
                <strong>Curso Origen:</strong> {course.nombre}
              </p>
              <p className="text-sm text-gray-700 mb-2">
                <strong>Curso Destino:</strong> {course.cursoSiguiente.nombre}
              </p>
              <p className="text-sm text-gray-700">
                <strong>Estudiantes a promocionar:</strong> {course.estudiantes?.length || 0}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Período Destino (Opcional)
              </label>
              <select
                value={selectedPeriodoDestino}
                onChange={(e) => setSelectedPeriodoDestino(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">Usar período del curso siguiente (mismo período)</option>
                {periods
                  .filter(p => p.id !== course.periodoId)
                  .map(period => (
                    <option key={period.id} value={period.id}>
                      {period.nombre} - {period.anioEscolar} {period.activo && '(Activo)'}
                    </option>
                  ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Si seleccionas un período diferente, se creará automáticamente el curso en ese período.
                Si lo dejas en blanco, se usará el período del curso siguiente (mismo período).
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800">
                <strong>⚠️ Advertencia:</strong> Esta acción moverá todos los estudiantes del curso actual al curso siguiente. 
                Esta acción no se puede deshacer fácilmente.
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={() => {
                  setShowPromoteModal(false);
                  setSelectedPeriodoDestino('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handlePromoteStudents}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Confirmar Promoción
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseDetail;

