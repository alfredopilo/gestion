import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const Grades = () => {
  const { user } = useAuth();
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGrades();
  }, []);

  const fetchGrades = async () => {
    try {
      let response;
      if (user?.rol === 'ESTUDIANTE' && user?.student?.id) {
        response = await api.get(`/grades/student/${user.student.id}`);
        setGrades(response.data.resumenPorMateria || []);
      } else {
        response = await api.get('/grades');
        setGrades(response.data.data || []);
      }
    } catch (error) {
      console.error('Error al cargar calificaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Cargando...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Calificaciones</h1>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        {grades.length === 0 ? (
          <p className="text-gray-500">No hay calificaciones registradas</p>
        ) : (
          <div className="space-y-6">
            {grades.map((item) => {
              const materia = item.materia || item;
              const calificaciones = item.calificaciones || [];
              
              return (
                <div key={materia.id || item.materia?.id} className="border-b pb-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold">{materia.nombre || item.materia?.nombre}</h3>
                    {item.promedio !== undefined && (
                      <span className="text-xl font-bold text-primary-600">
                        Promedio: {item.promedio.toFixed(2)}
                      </span>
                    )}
                  </div>
                  {calificaciones.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                      {calificaciones.map((cal) => (
                        <div key={cal.id} className="text-center">
                          <div className="text-sm text-gray-600">{cal.parcial}</div>
                          <div className="text-lg font-semibold">{cal.calificacion.toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Grades;

