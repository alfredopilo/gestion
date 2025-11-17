import { useState, useEffect } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

const SubjectAssignments = () => {
  const { selectedInstitutionId } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [gradeScales, setGradeScales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [formData, setFormData] = useState({
    materiaId: '',
    cursoId: '',
    docenteId: '',
    gradeScaleId: '',
  });

  useEffect(() => {
    if (selectedInstitutionId) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInstitutionId]);

  const fetchData = async () => {
    if (!selectedInstitutionId) {
      console.warn('No hay institución seleccionada, no se pueden cargar los datos');
      setLoading(false);
      return;
    }

    try {
      console.log('Cargando datos para institución:', selectedInstitutionId);
      const [assignmentsRes, subjectsRes, coursesRes, teachersRes, gradeScalesRes] = await Promise.all([
        api.get('/assignments?limit=100'),
        api.get('/subjects?limit=100'),
        api.get('/courses?limit=100'),
        api.get('/teachers?limit=100'),
        api.get('/grade-scales?limit=100'),
      ]);

      setAssignments(assignmentsRes.data.data || []);
      setSubjects(subjectsRes.data.data || []);
      
      // Procesar cursos y asegurarse de que tengan IDs válidos
      const coursesData = coursesRes.data.data || coursesRes.data || [];
      console.log('Cursos cargados:', coursesData);
      const validCourses = coursesData.filter(course => {
        const isValid = course && course.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(course.id);
        if (!isValid) {
          console.warn('Curso con ID inválido encontrado:', course);
        }
        return isValid;
      });
      console.log('Cursos válidos:', validCourses.length, validCourses);
      setCourses(validCourses);

      // Obtener teachers con su información de usuario
      // Verificar si la respuesta tiene data.data o data directamente
      console.log('Respuesta completa de teachers:', teachersRes.data);
      const teachersData = teachersRes.data?.data || teachersRes.data || [];
      console.log('Datos de teachers procesados:', teachersData);
      
      const teachersList = Array.isArray(teachersData)
        ? teachersData
            .filter(teacher => {
              // Filtrar solo los que tienen usuario y están activos
              const hasUser = teacher && teacher.user;
              const isActive = teacher.user?.estado === 'ACTIVO';
              if (!hasUser || !isActive) {
                console.warn('Docente filtrado:', teacher, { hasUser, isActive, estado: teacher.user?.estado });
              }
              return hasUser && isActive;
            })
            .map((teacher) => ({
              id: teacher.id,
              nombre: teacher.user?.nombre || '',
              apellido: teacher.user?.apellido || '',
              email: teacher.user?.email || '',
              estado: teacher.user?.estado || '',
            }))
        : [];

      console.log('Docentes cargados:', teachersList.length, teachersList);
      setTeachers(teachersList);
      
      if (teachersList.length === 0) {
        console.warn('No se encontraron docentes con información de usuario');
      }

      // Cargar escalas de calificación
      const gradeScalesData = gradeScalesRes.data?.data || [];
      setGradeScales(gradeScalesData);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      console.error('Detalles del error:', error.response?.data || error.message);
      toast.error(`Error al cargar datos: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validar que todos los campos estén completos
    if (!formData.materiaId || !formData.cursoId || !formData.docenteId || !formData.gradeScaleId) {
      toast.error('Por favor, completa todos los campos requeridos');
      return;
    }
    
    // Validar formato UUID básico
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(formData.materiaId) || !uuidRegex.test(formData.cursoId) || !uuidRegex.test(formData.docenteId) || !uuidRegex.test(formData.gradeScaleId)) {
      toast.error('Error: IDs inválidos. Por favor, selecciona nuevamente los campos.');
      console.error('IDs inválidos:', formData);
      return;
    }
    
    console.log('Enviando datos:', formData);
    
    try {
      if (editingAssignment) {
        await api.put(`/assignments/${editingAssignment.id}`, {
          docenteId: formData.docenteId,
          gradeScaleId: formData.gradeScaleId,
        });
        toast.success('Asignación actualizada exitosamente');
      } else {
        await api.post('/assignments', formData);
        toast.success('Asignación creada exitosamente. Todos los estudiantes del curso ahora tienen acceso a esta materia.');
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error al guardar asignación:', error);
      const errorMessage = error.response?.data?.error || 'Error al guardar asignación';
      const errorDetails = error.response?.data?.details || [];
      if (errorDetails.length > 0) {
        console.error('Detalles del error:', errorDetails);
        toast.error(`${errorMessage}: ${errorDetails.map(d => d.message || d.path?.join('.')).join(', ')}`);
      } else {
        toast.error(errorMessage);
      }
    }
  };

  const handleEdit = (assignment) => {
    setEditingAssignment(assignment);
    setFormData({
      materiaId: assignment.materiaId,
      cursoId: assignment.cursoId,
      docenteId: assignment.docenteId,
      gradeScaleId: assignment.gradeScaleId || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar esta asignación?')) {
      return;
    }

    try {
      await api.delete(`/assignments/${id}`);
      toast.success('Asignación eliminada exitosamente');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al eliminar asignación');
    }
  };

  const resetForm = () => {
    setFormData({
      materiaId: '',
      cursoId: '',
      docenteId: '',
      gradeScaleId: '',
    });
    setEditingAssignment(null);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        <span className="ml-4 text-gray-600">Cargando información...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-3xl font-bold text-gray-900">Asignación de Materias</h1>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
          >
            Nueva Asignación
          </button>
        </div>
        <p className="text-sm text-gray-600">
          Una misma materia puede estar asignada a diferentes cursos con diferentes profesores. 
          Cada asignación representa una materia específica en un curso específico con un docente específico.
        </p>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Materia
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Curso
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Docente
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {assignments.length === 0 ? (
              <tr>
                <td colSpan="4" className="px-6 py-4 text-center text-gray-500">
                  No hay asignaciones registradas
                </td>
              </tr>
            ) : (
              assignments.map((assignment) => (
                <tr key={assignment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium">
                    {assignment.materia?.nombre}
                    <div className="text-xs text-gray-500">{assignment.materia?.codigo}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {assignment.curso?.nombre}
                    <div className="text-xs text-gray-500">
                      {assignment.curso?.nivel} - {assignment.curso?.paralelo || 'Sin paralelo'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {assignment.docente?.user
                      ? `${assignment.docente.user.nombre} ${assignment.docente.user.apellido}`
                      : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleEdit(assignment)}
                      className="text-primary-600 hover:text-primary-900 mr-4"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(assignment.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingAssignment ? 'Editar Asignación' : 'Nueva Asignación'}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              {editingAssignment 
                ? 'Puedes cambiar el docente asignado a esta materia en este curso.'
                : 'Una misma materia puede estar en diferentes cursos con diferentes profesores. Al asignar una materia a un curso, todos los estudiantes del curso tendrán acceso automático a esta materia.'}
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Materia <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  disabled={!!editingAssignment}
                  value={formData.materiaId}
                  onChange={(e) => setFormData({ ...formData, materiaId: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Seleccionar materia</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.nombre} ({subject.codigo})
                    </option>
                  ))}
                </select>
                {editingAssignment && (
                  <p className="text-xs text-gray-500 mt-1">No se puede cambiar la materia en una asignación existente</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Curso <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  disabled={!!editingAssignment}
                  value={formData.cursoId}
                  onChange={(e) => {
                    console.log('Curso seleccionado:', e.target.value);
                    const selectedCourse = courses.find(c => c.id === e.target.value);
                    console.log('Curso completo:', selectedCourse);
                    setFormData({ ...formData, cursoId: e.target.value });
                  }}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Seleccionar curso</option>
                  {courses.length === 0 ? (
                    <option disabled>No hay cursos disponibles</option>
                  ) : (
                    courses.map((course) => {
                      // Validar que el curso tenga un UUID válido
                      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(course.id);
                      if (!isValidUUID) {
                        console.error('Curso con ID inválido:', course);
                        return null;
                      }
                      return (
                        <option key={course.id} value={course.id}>
                          {course.nombre} - {course.nivel}
                          {course.paralelo ? ` (${course.paralelo})` : ''}
                        </option>
                      );
                    }).filter(Boolean)
                  )}
                </select>
                {editingAssignment && (
                  <p className="text-xs text-gray-500 mt-1">No se puede cambiar el curso en una asignación existente</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Docente <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.docenteId}
                  onChange={(e) => {
                    console.log('Docente seleccionado:', e.target.value);
                    setFormData({ ...formData, docenteId: e.target.value });
                  }}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">Seleccionar docente</option>
                  {teachers.length === 0 ? (
                    <option disabled>No hay docentes disponibles</option>
                  ) : (
                    teachers
                      .sort((a, b) => {
                        const nameA = `${a.nombre} ${a.apellido}`.toLowerCase();
                        const nameB = `${b.nombre} ${b.apellido}`.toLowerCase();
                        return nameA.localeCompare(nameB);
                      })
                      .map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.nombre} {teacher.apellido}
                          {teacher.email ? ` (${teacher.email})` : ''}
                        </option>
                      ))
                  )}
                </select>
                {teachers.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {teachers.length} docente{teachers.length !== 1 ? 's' : ''} disponible{teachers.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Escala de Calificación <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.gradeScaleId}
                  onChange={(e) => setFormData({ ...formData, gradeScaleId: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
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
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                >
                  {editingAssignment ? 'Actualizar' : 'Crear Asignación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubjectAssignments;

