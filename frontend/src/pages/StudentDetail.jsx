import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const StudentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudent();
  }, [id]);

  const fetchStudent = async () => {
    try {
      const response = await api.get(`/students/${id}`);
      setStudent(response.data);
      console.log('Estudiante cargado:', response.data);
    } catch (error) {
      console.error('Error al cargar estudiante:', error);
      toast.error('Error al cargar información del estudiante');
      navigate('/students');
    } finally {
      setLoading(false);
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

  if (!student) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Estudiante no encontrado</p>
        <button
          onClick={() => navigate('/students')}
          className="mt-4 text-primary-600 hover:text-primary-700"
        >
          Volver a estudiantes
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/students')}
            className="text-primary-600 hover:text-primary-700 mb-2"
          >
            ← Volver a estudiantes
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            {student.user?.nombre} {student.user?.apellido}
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Información Personal */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Información Personal</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-gray-900">{student.user?.email || '-'}</p>
              </div>
              {student.user?.telefono && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                  <p className="mt-1 text-gray-900">{student.user.telefono}</p>
                </div>
              )}
              {student.user?.direccion && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Dirección</label>
                  <p className="mt-1 text-gray-900">{student.user.direccion}</p>
                </div>
              )}
              {student.matricula && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Matrícula</label>
                  <p className="mt-1 text-gray-900">{student.matricula}</p>
                </div>
              )}
              {student.fechaNacimiento && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Fecha de Nacimiento</label>
                  <p className="mt-1 text-gray-900">
                    {new Date(student.fechaNacimiento).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Información del Grupo */}
          {student.grupo && (
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Grupo</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre</label>
                  <p className="mt-1 text-gray-900">{student.grupo.nombre}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nivel</label>
                  <p className="mt-1 text-gray-900">{student.grupo.nivel}</p>
                </div>
                {student.grupo.paralelo && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Paralelo</label>
                    <p className="mt-1 text-gray-900">{student.grupo.paralelo}</p>
                  </div>
                )}
                {student.grupo.docente && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Docente</label>
                    <p className="mt-1 text-gray-900">
                      {student.grupo.docente.user?.nombre} {student.grupo.docente.user?.apellido}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Representante */}
          {student.representante && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Representante</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre</label>
                  <p className="mt-1 text-gray-900">
                    {student.representante.user?.nombre} {student.representante.user?.apellido}
                  </p>
                </div>
                {student.representante.user?.email && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="mt-1 text-gray-900">{student.representante.user.email}</p>
                  </div>
                )}
                {student.representante.user?.telefono && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                    <p className="mt-1 text-gray-900">{student.representante.user.telefono}</p>
                  </div>
                )}
                {student.representante.parentesco && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Parentesco</label>
                    <p className="mt-1 text-gray-900">{student.representante.parentesco}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Calificaciones y Asistencias */}
        <div className="lg:col-span-2">
          {/* Calificaciones */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Calificaciones</h2>
            {student.calificaciones && student.calificaciones.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Materia
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Calificación
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Fecha
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Observaciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {student.calificaciones.map((calificacion) => (
                      <tr key={calificacion.id}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {calificacion.materia?.nombre || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-semibold">
                          {calificacion.calificacion || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {calificacion.fechaRegistro
                            ? format(new Date(calificacion.fechaRegistro), 'dd/MM/yyyy')
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {calificacion.observaciones || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">No hay calificaciones registradas</p>
            )}
          </div>

          {/* Asistencias */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Últimas Asistencias</h2>
            {student.asistencias && student.asistencias.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Fecha
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Observaciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {student.asistencias.map((asistencia) => (
                      <tr key={asistencia.id}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {asistencia.fecha
                            ? format(new Date(asistencia.fecha), 'dd/MM/yyyy')
                            : '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              asistencia.estado === 'ASISTENCIA'
                                ? 'bg-green-100 text-green-800'
                                : asistencia.estado === 'FALTA'
                                ? 'bg-red-100 text-red-800'
                                : asistencia.estado === 'JUSTIFICADA'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {asistencia.estado}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {asistencia.observaciones || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">No hay asistencias registradas</p>
            )}
          </div>

          {/* Pagos */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Pagos</h2>
            {student.pagos && student.pagos.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Concepto
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Monto
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Fecha
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {student.pagos.map((pago) => (
                      <tr key={pago.id}>
                        <td className="px-4 py-3 whitespace-nowrap">{pago.concepto || '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          ${pago.monto ? pago.monto.toFixed(2) : '0.00'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              pago.estado === 'PAGADO'
                                ? 'bg-green-100 text-green-800'
                                : pago.estado === 'PENDIENTE'
                                ? 'bg-yellow-100 text-yellow-800'
                                : pago.estado === 'VENCIDO'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {pago.estado}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {pago.createdAt
                            ? format(new Date(pago.createdAt), 'dd/MM/yyyy')
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">No hay pagos registrados</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDetail;

