import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

const DashboardRepresentante = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      // En una implementación real, filtrar por representanteId
      const response = await api.get('/students');
      setStudents(response.data.data || []);
    } catch (error) {
      console.error('Error al cargar estudiantes:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Panel del Representante</h1>
        <p className="mt-2 text-gray-600">Bienvenido, {user?.nombre} {user?.apellido}</p>
      </div>

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <div>
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Estudiantes a mi Cargo</h2>
            {students.length === 0 ? (
              <p className="text-gray-500">No hay estudiantes asignados</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {students.map((student) => (
                  <Link
                    key={student.id}
                    to={`/students/${student.id}`}
                    className="block p-4 border border-gray-200 rounded-md hover:bg-gray-50"
                  >
                    <h3 className="font-medium">
                      {student.user.nombre} {student.user.apellido}
                    </h3>
                    {student.grupo && (
                      <p className="text-sm text-gray-600 mt-1">
                        {student.grupo.nombre}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardRepresentante;

