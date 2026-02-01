import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const DashboardRepresentante = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const response = await api.get('/representantes/my-students');
        if (!cancelled) setStudents(response.data.data || []);
      } catch (error) {
        if (!cancelled) {
          console.error('Error al cargar estudiantes:', error);
          toast.error('Error al cargar los estudiantes');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const response = await api.get('/representantes/my-students');
      setStudents(response.data.data || []);
    } catch (error) {
      console.error('Error al cargar estudiantes:', error);
      toast.error('Error al cargar los estudiantes');
    } finally {
      setLoading(false);
    }
  };

  const handleStudentClick = (studentId) => {
    navigate(`/representantes/students/${studentId}`);
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Panel del Representante</h1>
        <p className="mt-2 text-gray-600">
          Bienvenido, {user?.nombre} {user?.apellido}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div>
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Estudiantes a mi Cargo</h2>
            {students.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-lg">
                  No hay estudiantes asignados a tu cuenta
                </p>
                <p className="text-gray-400 text-sm mt-2">
                  Contacta con la administración para asociar estudiantes
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {students.map((student) => {
                  const enrollment = student.enrollments?.[0];
                  return (
                    <div
                      key={student.id}
                      onClick={() => handleStudentClick(student.id)}
                      className="block p-6 border border-gray-200 rounded-lg hover:bg-gray-50 hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg text-gray-900">
                            {student.user.nombre} {student.user.apellido}
                          </h3>
                          {enrollment && (
                            <div className="mt-2 space-y-1">
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Curso:</span>{' '}
                                {enrollment.curso?.nombre || student.grupo?.nombre || 'Sin curso'}
                              </p>
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Año Lectivo:</span>{' '}
                                {enrollment.anioLectivo?.nombre || 'N/A'}
                              </p>
                            </div>
                          )}
                          {!enrollment && student.grupo && (
                            <p className="text-sm text-gray-600 mt-2">
                              <span className="font-medium">Grupo:</span> {student.grupo.nombre}
                            </p>
                          )}
                        </div>
                        <div className="ml-4">
                          <svg
                            className="w-5 h-5 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardRepresentante;
