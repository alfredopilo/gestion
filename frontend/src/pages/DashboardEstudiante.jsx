import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const DashboardEstudiante = () => {
  const { user } = useAuth();
  const [grades, setGrades] = useState([]);
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      // Intentar obtener el ID del estudiante desde diferentes posibles ubicaciones
      const studentId = user?.student?.id || user?.id;
      if (studentId) {
        fetchData(studentId);
      } else {
        // Si no tenemos el studentId, intentar obtener el perfil completo
        fetchProfile();
      }
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/auth/profile');
      const profileData = response.data;
      if (profileData?.student?.id) {
        fetchData(profileData.student.id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error al obtener perfil:', error);
      setLoading(false);
    }
  };

  const fetchData = async (studentId) => {
    try {
      const [gradesRes, attendanceRes] = await Promise.all([
        api.get(`/grades/student/${studentId}`),
        api.get(`/attendance/summary?estudianteId=${studentId}`),
      ]);

      setGrades(gradesRes.data.resumenPorMateria || []);
      setAttendance(attendanceRes.data.resumen || null);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      // Si hay error, mostrar mensaje pero no dejar en loading infinito
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Panel del Estudiante</h1>
        <p className="mt-2 text-gray-600">Bienvenido, {user?.nombre} {user?.apellido}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <span className="ml-4 text-gray-600">Cargando información...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Calificaciones</h2>
              {grades.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No hay calificaciones registradas aún</p>
                  <p className="text-sm text-gray-400 mt-2">Las calificaciones aparecerán aquí cuando sean registradas por tus profesores</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {grades.map((materia) => (
                    <div key={materia.materia?.id || materia.nombre} className="border-b pb-4">
                      <div className="flex justify-between items-center">
                        <h3 className="font-medium">{materia.materia?.nombre || 'Sin nombre'}</h3>
                        <span className="text-lg font-semibold text-primary-600">
                          {materia.promedio ? materia.promedio.toFixed(2) : 'N/A'}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-gray-600">
                        {materia.calificaciones?.length || 0} calificaciones
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <h3 className="font-semibold mb-4">Asistencia</h3>
              {attendance ? (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Asistencias:</span>
                    <span className="font-semibold text-green-600">{attendance.asistencias || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Faltas:</span>
                    <span className="font-semibold text-red-600">{attendance.faltas || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Porcentaje:</span>
                    <span className="font-semibold">{attendance.porcentajeAsistencia ? attendance.porcentajeAsistencia.toFixed(1) : '0'}%</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-500">No hay datos de asistencia</p>
                  <p className="text-xs text-gray-400 mt-1">Los registros aparecerán aquí</p>
                </div>
              )}
            </div>

            {(user?.student?.grupo || (user && !loading)) && (
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="font-semibold mb-2">Mi Información</h3>
                {user?.student?.grupo ? (
                  <>
                    <p className="font-medium">{user.student.grupo.nombre}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {user.student.grupo.nivel} - {user.student.grupo.paralelo || 'Sin paralelo'}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">Curso no asignado aún</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardEstudiante;

