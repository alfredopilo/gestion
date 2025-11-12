import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const GradeEntry = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [activePeriod, setActivePeriod] = useState(null);
  const [subPeriods, setSubPeriods] = useState([]);
  const [selectedSubPeriod, setSelectedSubPeriod] = useState(null);
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState({}); // { studentId: [{ id, calificacion, tipoEvaluacion, descripcion, ... }] }
  const [loading, setLoading] = useState(true);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [gradeFormData, setGradeFormData] = useState({
    calificacion: '',
    tipoEvaluacion: 'Tarea',
    descripcion: '',
    observaciones: '',
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      fetchStudents();
      fetchSubjects();
    }
  }, [selectedCourse]);

  useEffect(() => {
    if (selectedSubject && activePeriod) {
      fetchGrades();
    }
  }, [selectedSubject, activePeriod, selectedSubPeriod]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [coursesRes, periodsRes] = await Promise.all([
        api.get('/courses?limit=100'),
        api.get('/periods'),
      ]);

      setCourses(coursesRes.data.data || []);
      const allPeriods = periodsRes.data.data || [];
      setPeriods(allPeriods);
      
      // Encontrar período activo
      const active = allPeriods.find(p => p.activo) || allPeriods[0];
      if (active) {
        setActivePeriod(active);
        fetchSubPeriods(active.id);
      }
    } catch (error) {
      console.error('Error al cargar datos iniciales:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubPeriods = async (periodId) => {
    try {
      const response = await api.get(`/sub-periods?periodoId=${periodId}`);
      const subPeriodsList = response.data.data || [];
      setSubPeriods(subPeriodsList.sort((a, b) => a.orden - b.orden));
      if (subPeriodsList.length > 0 && !selectedSubPeriod) {
        setSelectedSubPeriod(subPeriodsList[0]);
      }
    } catch (error) {
      console.error('Error al cargar subperíodos:', error);
    }
  };

  const fetchSubjects = async () => {
    if (!selectedCourse) return;
    
    try {
      const response = await api.get(`/assignments?cursoId=${selectedCourse.id}`);
      const assignments = response.data.data || [];
      const subjectsList = assignments.map(a => a.materia).filter(Boolean);
      setSubjects(subjectsList);
      if (subjectsList.length > 0 && !selectedSubject) {
        setSelectedSubject(subjectsList[0]);
      }
    } catch (error) {
      console.error('Error al cargar materias:', error);
    }
  };

  const fetchStudents = async () => {
    if (!selectedCourse) return;
    
    try {
      const response = await api.get(`/courses/${selectedCourse.id}`);
      const courseData = response.data;
      setStudents(courseData.estudiantes || []);
    } catch (error) {
      console.error('Error al cargar estudiantes:', error);
      toast.error('Error al cargar estudiantes');
    }
  };

  const fetchGrades = async () => {
    if (!selectedSubject || !activePeriod || !selectedSubPeriod) return;

    try {
      const response = await api.get(
        `/grades?materiaId=${selectedSubject.id}&subPeriodoId=${selectedSubPeriod.id}`
      );
      const gradesList = response.data.data || [];
      
      // Agrupar calificaciones por estudiante
      const gradesByStudent = {};
      gradesList.forEach(grade => {
        if (!gradesByStudent[grade.estudianteId]) {
          gradesByStudent[grade.estudianteId] = [];
        }
        gradesByStudent[grade.estudianteId].push(grade);
      });
      
      setGrades(gradesByStudent);
    } catch (error) {
      console.error('Error al cargar calificaciones:', error);
    }
  };

  const handleAddGrade = (student) => {
    setSelectedStudent(student);
    setGradeFormData({
      calificacion: '',
      tipoEvaluacion: 'Tarea',
      descripcion: '',
      observaciones: '',
    });
    setShowGradeModal(true);
  };

  const handleSubmitGrade = async (e) => {
    e.preventDefault();
    if (!selectedStudent || !selectedSubject || !selectedSubPeriod) return;

    try {
      const data = {
        estudianteId: selectedStudent.id,
        materiaId: selectedSubject.id,
        subPeriodoId: selectedSubPeriod.id,
        calificacion: parseFloat(gradeFormData.calificacion),
        tipoEvaluacion: gradeFormData.tipoEvaluacion || null,
        descripcion: gradeFormData.descripcion || null,
        observaciones: gradeFormData.observaciones || null,
      };

      await api.post('/grades', data);
      toast.success('Calificación registrada exitosamente');
      setShowGradeModal(false);
      fetchGrades();
    } catch (error) {
      console.error('Error al registrar calificación:', error);
      toast.error(error.response?.data?.error || 'Error al registrar calificación');
    }
  };

  const handleDeleteGrade = async (gradeId) => {
    if (!window.confirm('¿Estás seguro de eliminar esta calificación?')) return;

    try {
      await api.delete(`/grades/${gradeId}`);
      toast.success('Calificación eliminada exitosamente');
      fetchGrades();
    } catch (error) {
      console.error('Error al eliminar calificación:', error);
      toast.error('Error al eliminar calificación');
    }
  };

  const calculateAverage = (studentGrades) => {
    if (!studentGrades || studentGrades.length === 0) return 0;
    const sum = studentGrades.reduce((acc, g) => acc + g.calificacion, 0);
    const avg = sum / studentGrades.length;
    // Truncar a 2 decimales
    return Math.floor(avg * 100) / 100;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        <span className="ml-4 text-gray-600">Cargando...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Ingreso de Calificaciones</h1>

      {/* Filtros */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Curso</label>
            <select
              value={selectedCourse?.id || ''}
              onChange={(e) => {
                const course = courses.find(c => c.id === e.target.value);
                setSelectedCourse(course || null);
                setSelectedSubject(null);
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Seleccionar curso</option>
              {courses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.nombre} - {course.nivel} {course.paralelo || ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Materia</label>
            <select
              value={selectedSubject?.id || ''}
              onChange={(e) => {
                const subject = subjects.find(s => s.id === e.target.value);
                setSelectedSubject(subject || null);
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              disabled={!selectedCourse}
            >
              <option value="">Seleccionar materia</option>
              {subjects.map(subject => (
                <option key={subject.id} value={subject.id}>
                  {subject.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Período</label>
            <select
              value={activePeriod?.id || ''}
              onChange={(e) => {
                const period = periods.find(p => p.id === e.target.value);
                setActivePeriod(period || null);
                if (period) {
                  fetchSubPeriods(period.id);
                  setSelectedSubPeriod(null);
                }
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              {periods.map(period => (
                <option key={period.id} value={period.id}>
                  {period.nombre} {period.activo && '(Activo)'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subperíodo</label>
            <select
              value={selectedSubPeriod?.id || ''}
              onChange={(e) => {
                const subPeriod = subPeriods.find(sp => sp.id === e.target.value);
                setSelectedSubPeriod(subPeriod || null);
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              disabled={!activePeriod}
            >
              <option value="">Seleccionar subperíodo</option>
              {subPeriods.map(subPeriod => (
                <option key={subPeriod.id} value={subPeriod.id}>
                  {subPeriod.nombre} ({subPeriod.ponderacion}%)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de estudiantes y calificaciones */}
      {selectedCourse && selectedSubject && selectedSubPeriod && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold">
              Calificaciones: {selectedSubject.nombre} - {selectedSubPeriod.nombre}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Período: {activePeriod?.nombre} | Curso: {selectedCourse.nombre}
            </p>
          </div>

          {students.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No hay estudiantes en este curso
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estudiante</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Calificaciones</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Promedio</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {students.map(student => {
                    const studentGrades = grades[student.id] || [];
                    const average = calculateAverage(studentGrades);
                    
                    return (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">
                            {student.user?.nombre} {student.user?.apellido}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {studentGrades.length === 0 ? (
                            <span className="text-gray-400">Sin calificaciones</span>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {studentGrades.map(grade => (
                                <div
                                  key={grade.id}
                                  className="bg-blue-50 border border-blue-200 rounded px-2 py-1 text-sm"
                                >
                                  <div className="font-medium">{grade.calificacion.toFixed(2)}</div>
                                  {grade.descripcion && (
                                    <div className="text-xs text-gray-600">{grade.descripcion}</div>
                                  )}
                                  <button
                                    onClick={() => handleDeleteGrade(grade.id)}
                                    className="text-xs text-red-600 hover:text-red-800 mt-1"
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-lg font-semibold ${average >= 7 ? 'text-green-600' : 'text-red-600'}`}>
                            {average > 0 ? average.toFixed(2) : '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleAddGrade(student)}
                            className="text-primary-600 hover:text-primary-900 text-sm font-medium"
                          >
                            + Agregar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal para agregar calificación */}
      {showGradeModal && selectedStudent && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">
              Agregar Calificación - {selectedStudent.user?.nombre} {selectedStudent.user?.apellido}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              {selectedSubject?.nombre} - {selectedSubPeriod?.nombre}
            </p>
            <form onSubmit={handleSubmitGrade} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Evaluación
                </label>
                <select
                  value={gradeFormData.tipoEvaluacion}
                  onChange={(e) => setGradeFormData({ ...gradeFormData, tipoEvaluacion: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="Tarea">Tarea</option>
                  <option value="Examen">Examen</option>
                  <option value="Proyecto">Proyecto</option>
                  <option value="Quiz">Quiz</option>
                  <option value="Trabajo">Trabajo</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción <span className="text-gray-500">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={gradeFormData.descripcion}
                  onChange={(e) => setGradeFormData({ ...gradeFormData, descripcion: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Ej: Tarea 1, Examen Parcial, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Calificación <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  max="10"
                  step="0.01"
                  value={gradeFormData.calificacion}
                  onChange={(e) => setGradeFormData({ ...gradeFormData, calificacion: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="0.00 - 10.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observaciones <span className="text-gray-500">(opcional)</span>
                </label>
                <textarea
                  value={gradeFormData.observaciones}
                  onChange={(e) => setGradeFormData({ ...gradeFormData, observaciones: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows="3"
                  placeholder="Observaciones adicionales..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowGradeModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                >
                  Guardar Calificación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GradeEntry;

