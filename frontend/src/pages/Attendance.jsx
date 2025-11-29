import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const Attendance = () => {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cursos, setCursos] = useState([]);
  const [estudiantes, setEstudiantes] = useState([]);
  const [classes, setClasses] = useState([]);
  
  // Filtros para historial
  const [selectedCurso, setSelectedCurso] = useState('');
  const [selectedMateria, setSelectedMateria] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  
  // Para tomar asistencia
  const [showAttendanceForm, setShowAttendanceForm] = useState(false);
  const [attendanceForm, setAttendanceForm] = useState({
    cursoId: '',
    materiaId: '',
    hora: '',
    fecha: format(new Date(), 'yyyy-MM-dd'),
  });
  const [attendanceRecords, setAttendanceRecords] = useState({});

  useEffect(() => {
    fetchAttendance();
    if (user?.rol === 'ADMIN' || user?.rol === 'SECRETARIA' || user?.rol === 'PROFESOR') {
      fetchCourses();
    }
  }, [selectedCurso, selectedMateria, fechaInicio, fechaFin, estadoFilter]);

  const fetchCourses = async () => {
    try {
      // Si es PROFESOR, obtener solo sus cursos asignados
      if (user?.rol === 'PROFESOR') {
        const response = await api.get('/assignments?limit=100');
        // Obtener cursos únicos de las asignaciones
        const cursosUnicos = {};
        (response.data.data || []).forEach(assignment => {
          if (assignment.curso && !cursosUnicos[assignment.curso.id]) {
            cursosUnicos[assignment.curso.id] = assignment.curso;
          }
        });
        setCursos(Object.values(cursosUnicos));
      } else {
        const response = await api.get('/courses?limit=100');
        setCursos(response.data.data || []);
      }
    } catch (error) {
      console.error('Error al cargar cursos:', error);
    }
  };

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedCurso) params.grupoId = selectedCurso;
      if (fechaInicio) params.fechaInicio = fechaInicio;
      if (fechaFin) params.fechaFin = fechaFin;
      if (estadoFilter) params.estado = estadoFilter;

      const response = await api.get('/attendance', { params });
      setAttendance(response.data.data || []);
    } catch (error) {
      console.error('Error al cargar asistencia:', error);
      toast.error('Error al cargar asistencia');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async (cursoId) => {
    try {
      const response = await api.get(`/courses/${cursoId}`);
      setEstudiantes(response.data.estudiantes || []);
    } catch (error) {
      console.error('Error al cargar estudiantes:', error);
      toast.error('Error al cargar estudiantes');
    }
  };

  const fetchClasses = async () => {
    if (!attendanceForm.cursoId || !attendanceForm.fecha) return;
    
    try {
      const response = await api.get('/attendance/course-classes', {
        params: {
          cursoId: attendanceForm.cursoId,
          fecha: attendanceForm.fecha,
        },
      });
      const classesData = response.data.data || [];
      setClasses(classesData);
      
      // Cargar estudiantes del curso solo si hay clases disponibles
      if (classesData.length > 0) {
        await fetchStudents(attendanceForm.cursoId);
      } else {
        setEstudiantes([]);
        setAttendanceRecords({});
        // No mostrar error, solo limpiar el estado
      }
    } catch (error) {
      console.error('Error al cargar clases:', error);
      toast.error('Error al cargar clases');
    }
  };

  useEffect(() => {
    if (showAttendanceForm && attendanceForm.cursoId && attendanceForm.fecha) {
      fetchClasses();
    }
  }, [attendanceForm.cursoId, attendanceForm.fecha]);

  useEffect(() => {
    // Cargar asistencia existente cuando se selecciona materia y hora
    const loadExistingAttendance = async () => {
      if (attendanceForm.materiaId && attendanceForm.hora && estudiantes.length > 0) {
        try {
          const existingResponse = await api.get('/attendance', {
            params: {
              grupoId: attendanceForm.cursoId,
              fechaInicio: attendanceForm.fecha,
              fechaFin: attendanceForm.fecha,
            },
          });
          
          const records = {};
          existingResponse.data.data
            .filter(a => a.materiaId === attendanceForm.materiaId && a.hora === parseInt(attendanceForm.hora))
            .forEach(a => {
              records[a.estudianteId] = {
                estado: a.estado,
                observaciones: a.observaciones || '',
              };
            });
          
          // Inicializar registros faltantes con FALTA por defecto
          estudiantes.forEach(est => {
            if (!records[est.id]) {
              records[est.id] = { estado: 'FALTA', observaciones: '' };
            }
          });
          
          setAttendanceRecords(records);
        } catch (error) {
          console.error('Error al cargar asistencia existente:', error);
          // Inicializar todos con FALTA por defecto
          const defaultRecords = {};
          estudiantes.forEach(est => {
            defaultRecords[est.id] = { estado: 'FALTA', observaciones: '' };
          });
          setAttendanceRecords(defaultRecords);
        }
      } else if (estudiantes.length > 0 && !attendanceForm.materiaId) {
        // Inicializar todos con FALTA por defecto cuando hay estudiantes pero no materia seleccionada
        const defaultRecords = {};
        estudiantes.forEach(est => {
          defaultRecords[est.id] = { estado: 'FALTA', observaciones: '' };
        });
        setAttendanceRecords(defaultRecords);
      }
    };

    if (showAttendanceForm) {
      loadExistingAttendance();
    }
  }, [attendanceForm.materiaId, attendanceForm.hora, estudiantes.length, showAttendanceForm]);

  const handleAttendanceChange = (estudianteId, estado) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [estudianteId]: {
        ...prev[estudianteId],
        estado,
      },
    }));
  };

  const handleObservationsChange = (estudianteId, observaciones) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [estudianteId]: {
        ...prev[estudianteId],
        observaciones,
      },
    }));
  };

  const saveAttendance = async () => {
    if (!attendanceForm.cursoId || !attendanceForm.materiaId || !attendanceForm.hora || !attendanceForm.fecha) {
      toast.error('Debe completar todos los campos');
      return;
    }

    try {
      const records = Object.keys(attendanceRecords).map(estudianteId => ({
        estudianteId,
        cursoId: attendanceForm.cursoId,
        materiaId: attendanceForm.materiaId,
        hora: parseInt(attendanceForm.hora),
        fecha: attendanceForm.fecha,
        estado: attendanceRecords[estudianteId].estado || 'FALTA',
        observaciones: attendanceRecords[estudianteId].observaciones || null,
      }));

      await api.post('/attendance/bulk', { asistencia: records });
      toast.success('Asistencia guardada exitosamente');
      setShowAttendanceForm(false);
      fetchAttendance();
    } catch (error) {
      console.error('Error al guardar asistencia:', error);
      toast.error('Error al guardar asistencia');
    }
  };

  const getEstadoColor = (estado) => {
    const colors = {
      ASISTENCIA: 'bg-green-100 text-green-800 border-green-300',
      FALTA: 'bg-red-100 text-red-800 border-red-300',
      JUSTIFICADA: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      TARDE: 'bg-orange-100 text-orange-800 border-orange-300',
    };
    return colors[estado] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF('landscape', 'mm', 'a3');
      
      doc.setFontSize(18);
      doc.text('Reporte de Asistencia', 14, 15);
      
      let subtitle = '';
      if (selectedCurso) {
        const curso = cursos.find(c => c.id === selectedCurso);
        subtitle = `Curso: ${curso?.nombre || ''}`;
      }
      if (fechaInicio && fechaFin) {
        subtitle += subtitle ? ` | Período: ${fechaInicio} - ${fechaFin}` : `Período: ${fechaInicio} - ${fechaFin}`;
      }
      if (subtitle) {
        doc.setFontSize(12);
        doc.text(subtitle, 14, 22);
      }
      
      const tableData = attendance.map(a => [
        `${a.estudiante?.user?.nombre || ''} ${a.estudiante?.user?.apellido || ''}`,
        a.curso?.nombre || '-',
        a.materia?.nombre || '-',
        a.hora ? `Hora ${a.hora}` : '-',
        format(new Date(a.fecha), 'dd/MM/yyyy'),
        a.estado,
        a.observaciones || '-',
      ]);
      
      autoTable(doc, {
        head: [['Estudiante', 'Curso', 'Materia', 'Hora', 'Fecha', 'Estado', 'Observaciones']],
        body: tableData,
        startY: subtitle ? 28 : 22,
        styles: { fontSize: 8 },
        headStyles: {
          fillColor: [66, 139, 202],
          textColor: 255,
          fontStyle: 'bold',
        },
      });
      
      doc.save(`asistencia_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('Reporte exportado a PDF exitosamente');
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      toast.error('Error al exportar reporte');
    }
  };

  if (loading && !showAttendanceForm) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Control de Asistencia</h1>
          <p className="text-gray-600 mt-2">Registra y consulta la asistencia de los estudiantes</p>
        </div>
        <div className="flex gap-2">
          {(user?.rol === 'ADMIN' || user?.rol === 'SECRETARIA' || user?.rol === 'PROFESOR') && (
            <button
              onClick={() => setShowAttendanceForm(true)}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
            >
              + Tomar Asistencia
            </button>
          )}
          {attendance.length > 0 && (
            <button
              onClick={exportToPDF}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Exportar PDF
            </button>
          )}
        </div>
      </div>

      {/* Formulario para tomar asistencia */}
      {showAttendanceForm && (user?.rol === 'ADMIN' || user?.rol === 'SECRETARIA' || user?.rol === 'PROFESOR') && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Tomar Asistencia</h2>
            <button
              onClick={() => {
                setShowAttendanceForm(false);
                setAttendanceForm({ cursoId: '', materiaId: '', hora: '', fecha: format(new Date(), 'yyyy-MM-dd') });
                setAttendanceRecords({});
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fecha *</label>
              <input
                type="date"
                value={attendanceForm.fecha}
                onChange={(e) => {
                  const newFecha = e.target.value;
                  setAttendanceForm({ ...attendanceForm, fecha: newFecha, materiaId: '', hora: '' });
                  setClasses([]);
                }}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Curso *</label>
              <select
                value={attendanceForm.cursoId}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, cursoId: e.target.value, materiaId: '', hora: '' })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
                disabled={!attendanceForm.fecha}
              >
                <option value="">Seleccione un curso</option>
                {cursos.map((curso) => (
                  <option key={curso.id} value={curso.id}>
                    {curso.nombre} - {curso.nivel} {curso.paralelo}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Materia *</label>
              <select
                value={attendanceForm.materiaId}
                onChange={(e) => {
                  const selectedClass = classes.find(c => c.materia.id === e.target.value);
                  if (selectedClass) {
                    // Validar que el día de la fecha coincida con el día de la semana de la clase
                    // Usar solo la fecha sin hora para evitar problemas de zona horaria
                    const fechaStr = attendanceForm.fecha.split('T')[0]; // Asegurar formato YYYY-MM-DD
                    const [year, month, day] = fechaStr.split('-').map(Number);
                    const fechaObj = new Date(year, month - 1, day); // month - 1 porque Date usa 0-indexed months
                    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
                    const diaFecha = diasSemana[fechaObj.getDay()];
                    
                    if (selectedClass.diaSemana !== diaFecha) {
                      toast.error(`La fecha seleccionada es ${diaFecha}, pero esta materia se imparte los ${selectedClass.diaSemana}`);
                      return;
                    }
                    
                    setAttendanceForm({ ...attendanceForm, materiaId: e.target.value, hora: selectedClass.hora });
                  }
                }}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
                disabled={!attendanceForm.cursoId || !attendanceForm.fecha || classes.length === 0}
              >
                <option value="">Seleccione una materia</option>
                {classes.length === 0 && attendanceForm.cursoId && attendanceForm.fecha ? (
                  <option value="" disabled>No hay clases programadas para esta fecha</option>
                ) : (
                  classes.map((classItem) => (
                    <option key={`${classItem.materia.id}-${classItem.hora}`} value={classItem.materia.id}>
                      {classItem.materia.nombre} - Hora {classItem.hora} ({classItem.diaSemana})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {classes.length === 0 && attendanceForm.cursoId && attendanceForm.fecha && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-yellow-800 text-sm">
                No hay clases programadas para el día seleccionado. Por favor, seleccione otra fecha.
              </p>
            </div>
          )}

          {estudiantes.length > 0 && attendanceForm.materiaId && attendanceForm.hora && (
            <div className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Estudiantes</h3>
                <div className="flex gap-2">
                  <span className="text-sm text-gray-600">Marcar todos:</span>
                  {['ASISTENCIA', 'FALTA', 'TARDE', 'JUSTIFICADA'].map((estado) => (
                    <button
                      key={estado}
                      onClick={() => {
                        const newRecords = {};
                        estudiantes.forEach(est => {
                          newRecords[est.id] = {
                            estado,
                            observaciones: attendanceRecords[est.id]?.observaciones || '',
                          };
                        });
                        setAttendanceRecords(newRecords);
                      }}
                      className={`px-3 py-1 rounded text-xs border ${
                        getEstadoColor(estado)
                      } hover:opacity-80`}
                    >
                      {estado}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {estudiantes.map((estudiante) => {
                  const record = attendanceRecords[estudiante.id] || { estado: 'FALTA', observaciones: '' };
                  return (
                    <div key={estudiante.id} className="border border-gray-200 rounded-md p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium">
                            {estudiante.user?.apellido} {estudiante.user?.nombre}
                          </p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {['ASISTENCIA', 'FALTA', 'TARDE', 'JUSTIFICADA'].map((estado) => (
                            <button
                              key={estado}
                              onClick={() => handleAttendanceChange(estudiante.id, estado)}
                              className={`px-3 py-1 rounded text-sm border ${
                                record.estado === estado
                                  ? getEstadoColor(estado)
                                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              {estado}
                            </button>
                          ))}
                        </div>
                        <div className="flex-1 ml-4">
                          <input
                            type="text"
                            placeholder="Observaciones"
                            value={record.observaciones}
                            onChange={(e) => handleObservationsChange(estudiante.id, e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-3 py-1 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowAttendanceForm(false);
                    setAttendanceForm({ cursoId: '', materiaId: '', hora: '', fecha: format(new Date(), 'yyyy-MM-dd') });
                    setAttendanceRecords({});
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveAttendance}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                >
                  Guardar Asistencia
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filtros para historial */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold mb-4">Filtros</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Curso</label>
            <select
              value={selectedCurso}
              onChange={(e) => setSelectedCurso(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Todos los cursos</option>
              {cursos.map((curso) => (
                <option key={curso.id} value={curso.id}>
                  {curso.nombre} - {curso.nivel} {curso.paralelo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Inicio</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Fin</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
            <select
              value={estadoFilter}
              onChange={(e) => setEstadoFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Todos</option>
              <option value="ASISTENCIA">Asistencia</option>
              <option value="FALTA">Falta</option>
              <option value="TARDE">Tarde</option>
              <option value="JUSTIFICADA">Justificada</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setSelectedCurso('');
                setFechaInicio('');
                setFechaFin('');
                setEstadoFilter('');
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de asistencia */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estudiante</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Curso</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Materia</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hora</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Observaciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {attendance.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                  No hay registros de asistencia
                </td>
              </tr>
            ) : (
              attendance.map((record) => (
                <tr key={record.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {record.estudiante?.user?.nombre} {record.estudiante?.user?.apellido}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {record.curso?.nombre || record.estudiante?.grupo?.nombre || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {record.materia?.nombre || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {record.hora ? `Hora ${record.hora}` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {format(new Date(record.fecha), 'dd/MM/yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getEstadoColor(record.estado)}`}>
                      {record.estado}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {record.observaciones || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Attendance;
