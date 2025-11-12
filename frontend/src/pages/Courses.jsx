import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import toast from 'react-hot-toast';

const Courses = () => {
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    nivel: '',
    paralelo: '',
    docenteId: '',
    capacidad: 30,
    cursoSiguienteId: '',
    sortOrder: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [coursesRes, teachersRes] = await Promise.all([
        api.get('/courses?limit=100'),
        api.get('/teachers?limit=100'),
      ]);

      setCourses(coursesRes.data.data || []);
      
      // Filtrar solo profesores activos
      const activeTeachers = (teachersRes.data.data || []).filter(
        t => t.user && t.user.estado === 'ACTIVO'
      );
      setTeachers(activeTeachers);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        paralelo: formData.paralelo || null,
        docenteId: formData.docenteId || null,
        capacidad: formData.capacidad ? parseInt(formData.capacidad) : null,
        cursoSiguienteId: formData.cursoSiguienteId || null,
        sortOrder: formData.sortOrder !== '' && formData.sortOrder !== null
          ? parseInt(formData.sortOrder, 10)
          : 0,
      };

      if (editingCourse) {
        await api.put(`/courses/${editingCourse.id}`, data);
        toast.success('Curso actualizado exitosamente');
      } else {
        await api.post('/courses', data);
        toast.success('Curso creado exitosamente');
      }

      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error al guardar curso:', error);
      toast.error(error.response?.data?.error || 'Error al guardar curso');
    }
  };

  const handleEdit = (course) => {
    setEditingCourse(course);
    setFormData({
      nombre: course.nombre || '',
      nivel: course.nivel || '',
      paralelo: course.paralelo || '',
      docenteId: course.docenteId || '',
      capacidad: course.capacidad || 30,
      cursoSiguienteId: course.cursoSiguienteId || '',
      sortOrder: typeof course.sortOrder === 'number' ? course.sortOrder : 0,
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este curso? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await api.delete(`/courses/${id}`);
      toast.success('Curso eliminado exitosamente');
      fetchData();
    } catch (error) {
      console.error('Error al eliminar curso:', error);
      toast.error(error.response?.data?.error || 'Error al eliminar curso');
    }
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      nivel: '',
      paralelo: '',
      docenteId: '',
      capacidad: 30,
      cursoSiguienteId: '',
      sortOrder: 0,
    });
    setEditingCourse(null);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        <span className="ml-4 text-gray-600">Cargando cursos...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Gestión de Cursos</h1>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
        >
          Nuevo Curso
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orden</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nivel</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paralelo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Año Escolar</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Docente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estudiantes</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacidad</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {courses.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-4 text-center text-gray-500">
                    No hay cursos registrados
                  </td>
                </tr>
              ) : (
                courses.map((course) => (
                  <tr key={course.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {course.sortOrder ?? 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={`/courses/${course.id}`}
                        className="text-primary-600 hover:text-primary-900 font-medium"
                      >
                        {course.nombre}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{course.nivel}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{course.paralelo || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {course.anioLectivo?.nombre || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {course.docente?.user 
                        ? `${course.docente.user.nombre} ${course.docente.user.apellido}`
                        : '-'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {course.cursoSiguiente ? (
                        <span className="text-blue-600">
                          {course.cursoSiguiente.nombre}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        (course._count?.estudiantes || 0) >= (course.capacidad || 30)
                          ? 'bg-red-100 text-red-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {course._count?.estudiantes || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{course.capacidad || 30}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEdit(course)}
                        className="text-primary-600 hover:text-primary-900 mr-4"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(course.id)}
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
      </div>

      {/* Modal para crear/editar curso */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingCourse ? 'Editar Curso' : 'Nuevo Curso'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Ej: Primero de Bachillerato"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Nivel <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nivel}
                    onChange={(e) => setFormData({ ...formData, nivel: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Ej: Bachillerato, Primaria"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Paralelo
                  </label>
                  <input
                    type="text"
                    value={formData.paralelo}
                    onChange={(e) => setFormData({ ...formData, paralelo: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Ej: A, B, C"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Capacidad
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.capacidad}
                    onChange={(e) => setFormData({ ...formData, capacidad: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Orden de listado
                  </label>
                  <input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Docente Tutor (Opcional)
                  </label>
                  <select
                    value={formData.docenteId}
                    onChange={(e) => setFormData({ ...formData, docenteId: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Sin docente tutor</option>
                    {teachers.map(teacher => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.user?.nombre} {teacher.user?.apellido} - {teacher.user?.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Siguiente Grado (Opcional)
                </label>
                <select
                  value={formData.cursoSiguienteId}
                  onChange={(e) => setFormData({ ...formData, cursoSiguienteId: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">Sin siguiente grado</option>
                  {courses
                    .filter(c => !editingCourse || c.id !== editingCourse.id) // Excluir el curso actual
                    .map(course => (
                      <option key={course.id} value={course.id}>
                        {course.nombre} ({course.nivel} {course.paralelo || ''}) - {course.anioLectivo?.nombre || ''}
                      </option>
                    ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Curso al que promocionarán los estudiantes al finalizar el año escolar
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
                  {editingCourse ? 'Actualizar' : 'Crear Curso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Courses;

