import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const DashboardProfesor = () => {
  const { user } = useAuth();
  const cancelledRef = useRef(false);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cancelledRef.current = false;
    fetchCourses();
    return () => { cancelledRef.current = true; };
  }, []);

  const fetchCourses = async () => {
    try {
      const response = await api.get('/teachers/my-assignments');
      const assignments = response.data.data || [];
      const coursesList = assignments.map(a => ({
        id: a.curso.id,
        nombre: a.curso.nombre,
        nivel: a.curso.nivel,
        paralelo: a.curso.paralelo,
        _count: a.curso._count || { estudiantes: 0 },
      }));
      if (!cancelledRef.current) setCourses(coursesList);
    } catch (error) {
      if (!cancelledRef.current) console.error('Error al cargar cursos:', error);
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Panel del Profesor</h1>
        <p className="mt-2 text-gray-600">Bienvenido, {user?.nombre} {user?.apellido}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Mis Cursos</h2>
            {loading ? (
              <p>Cargando...</p>
            ) : courses.length === 0 ? (
              <p className="text-gray-500">No tienes cursos asignados</p>
            ) : (
              <div className="space-y-4">
                {courses.map((course) => (
                  <Link
                    key={course.id}
                    to={`/courses/${course.id}`}
                    className="block p-4 border border-gray-200 rounded-md hover:bg-gray-50"
                  >
                    <h3 className="font-medium">{course.nombre}</h3>
                    <p className="text-sm text-gray-600">
                      {course.nivel} - {course.paralelo || 'Sin paralelo'}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {course._count?.estudiantes || 0} estudiantes
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="font-semibold mb-4">Accesos Rápidos</h3>
            <div className="space-y-2">
              <Link
                to="/grades"
                className="block text-primary-600 hover:text-primary-700"
              >
                Registrar Calificaciones
              </Link>
              <Link
                to="/attendance"
                className="block text-primary-600 hover:text-primary-700"
              >
                Registrar Asistencia
              </Link>
              <Link
                to="/courses"
                className="block text-primary-600 hover:text-primary-700"
              >
                Ver Cursos
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardProfesor;

