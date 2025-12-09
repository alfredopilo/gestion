import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import toast from 'react-hot-toast';

const StudentDetailRepresentante = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('resumen');
  const [student, setStudent] = useState(null);
  const [insumos, setInsumos] = useState([]);
  const [grades, setGrades] = useState([]);
  const [reportCard, setReportCard] = useState(null);
  const [gradeReport, setGradeReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [insumosLoading, setInsumosLoading] = useState(false);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [reportCardLoading, setReportCardLoading] = useState(false);
  const [gradeReportLoading, setGradeReportLoading] = useState(false);

  useEffect(() => {
    fetchStudentSummary();
  }, [studentId]);

  useEffect(() => {
    if (activeTab === 'deberes') {
      fetchInsumos();
    } else if (activeTab === 'calificaciones') {
      fetchGrades();
    } else if (activeTab === 'boletin') {
      fetchReportCard();
    } else if (activeTab === 'reporte') {
      fetchGradeReport();
    }
  }, [activeTab, studentId]);

  const fetchStudentSummary = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/representantes/students/${studentId}/summary`);
      setStudent(response.data);
    } catch (error) {
      console.error('Error al cargar estudiante:', error);
      toast.error('Error al cargar información del estudiante');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchInsumos = async () => {
    try {
      setInsumosLoading(true);
      const response = await api.get(`/representantes/students/${studentId}/insumos`);
      setInsumos(response.data.data || []);
    } catch (error) {
      console.error('Error al cargar deberes:', error);
      toast.error('Error al cargar los deberes');
    } finally {
      setInsumosLoading(false);
    }
  };

  const fetchGrades = async () => {
    try {
      setGradesLoading(true);
      const response = await api.get(`/representantes/students/${studentId}/grades`);
      setGrades(response.data.data || []);
    } catch (error) {
      console.error('Error al cargar calificaciones:', error);
      toast.error('Error al cargar las calificaciones');
    } finally {
      setGradesLoading(false);
    }
  };

  const fetchReportCard = async () => {
    try {
      setReportCardLoading(true);
      const response = await api.get(`/representantes/students/${studentId}/report-card`);
      setReportCard(response.data);
    } catch (error) {
      console.error('Error al cargar boletín:', error);
      toast.error('Error al cargar el boletín de calificaciones');
    } finally {
      setReportCardLoading(false);
    }
  };

  const fetchGradeReport = async () => {
    try {
      setGradeReportLoading(true);
      const response = await api.get(`/representantes/students/${studentId}/grade-report`);
      setGradeReport(response.data);
    } catch (error) {
      console.error('Error al cargar reporte:', error);
      toast.error('Error al cargar el reporte de calificaciones');
    } finally {
      setGradeReportLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const getEstadoBadge = (estado) => {
    const badges = {
      pendiente: 'bg-yellow-100 text-yellow-800',
      asignado: 'bg-blue-100 text-blue-800',
      calificado: 'bg-green-100 text-green-800',
      vencido: 'bg-red-100 text-red-800',
    };
    return badges[estado] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">No se pudo cargar la información del estudiante.</p>
        </div>
      </div>
    );
  }

  const studentData = student.student;

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-blue-600 hover:text-blue-800 mb-4 flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver al dashboard
        </button>
        <h1 className="text-3xl font-bold text-gray-900">
          {studentData.user.nombre} {studentData.user.apellido}
        </h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {['resumen', 'deberes', 'calificaciones', 'boletin', 'reporte'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab === 'resumen' && 'Resumen'}
              {tab === 'deberes' && 'Deberes'}
              {tab === 'calificaciones' && 'Calificaciones'}
              {tab === 'boletin' && 'Boletín'}
              {tab === 'reporte' && 'Reporte'}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'resumen' && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Información del Estudiante</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Información Personal</h3>
                <dl className="space-y-2">
                  <div>
                    <dt className="text-sm text-gray-600">Nombre completo</dt>
                    <dd className="text-base font-medium">
                      {studentData.user.nombre} {studentData.user.apellido}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-600">Email</dt>
                    <dd className="text-base">{studentData.user.email || 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-600">Teléfono</dt>
                    <dd className="text-base">{studentData.user.telefono || 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-600">Número de identificación</dt>
                    <dd className="text-base">{studentData.user.numeroIdentificacion || 'N/A'}</dd>
                  </div>
                </dl>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Información Académica</h3>
                <dl className="space-y-2">
                  {studentData.enrollments?.[0] && (
                    <>
                      <div>
                        <dt className="text-sm text-gray-600">Curso</dt>
                        <dd className="text-base font-medium">
                          {studentData.enrollments[0].curso?.nombre || 'N/A'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-600">Año Lectivo</dt>
                        <dd className="text-base">
                          {studentData.enrollments[0].anioLectivo?.nombre || 'N/A'}
                        </dd>
                      </div>
                    </>
                  )}
                  {studentData.grupo && (
                    <div>
                      <dt className="text-sm text-gray-600">Grupo</dt>
                      <dd className="text-base">{studentData.grupo.nombre}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Estadísticas</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Total de Deberes</p>
                  <p className="text-2xl font-bold text-blue-600">{student.estadisticas.insumosTotal}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Total de Calificaciones</p>
                  <p className="text-2xl font-bold text-green-600">
                    {student.estadisticas.calificacionesTotal}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'deberes' && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Deberes y Tareas</h2>
            {insumosLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : insumos.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No hay deberes asignados</p>
            ) : (
              <div className="space-y-4">
                {insumos.map((insumo) => (
                  <div
                    key={insumo.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">{insumo.nombre}</h3>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getEstadoBadge(
                              insumo.estado
                            )}`}
                          >
                            {insumo.estado}
                          </span>
                        </div>
                        {insumo.descripcion && (
                          <p className="text-gray-600 mb-3">{insumo.descripcion}</p>
                        )}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Materia:</span>
                            <p className="font-medium">{insumo.materia.nombre}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Curso:</span>
                            <p className="font-medium">{insumo.curso.nombre}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Fecha asignación:</span>
                            <p className="font-medium">{formatDate(insumo.fechaDeber)}</p>
                          </div>
                          {insumo.fechaEntrega && (
                            <div>
                              <span className="text-gray-500">Fecha entrega:</span>
                              <p className="font-medium">{formatDate(insumo.fechaEntrega)}</p>
                            </div>
                          )}
                        </div>
                        {insumo.calificacion && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-sm">
                              <span className="text-gray-500">Calificación:</span>{' '}
                              <span className="font-semibold text-green-600">
                                {insumo.calificacion.calificacion}
                              </span>
                            </p>
                            {insumo.calificacion.observaciones && (
                              <p className="text-sm text-gray-600 mt-1">
                                {insumo.calificacion.observaciones}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'calificaciones' && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Calificaciones</h2>
            {gradesLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : grades.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No hay calificaciones registradas</p>
            ) : (
              <div className="space-y-6">
                {grades.map((materiaData) => (
                  <div key={materiaData.materia.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">{materiaData.materia.nombre}</h3>
                      {materiaData.promedio !== null && (
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Promedio</p>
                          <p className="text-xl font-bold text-blue-600">
                            {materiaData.promedio.toFixed(2)}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      {materiaData.calificaciones.map((grade) => (
                        <div
                          key={grade.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded"
                        >
                          <div className="flex-1">
                            <p className="font-medium">
                              {grade.insumo?.nombre || grade.parcial || 'Calificación general'}
                            </p>
                            {grade.subPeriodo && (
                              <p className="text-sm text-gray-600">
                                {grade.subPeriodo.nombre} - {grade.subPeriodo.periodo.nombre}
                              </p>
                            )}
                            {grade.descripcion && (
                              <p className="text-sm text-gray-500 mt-1">{grade.descripcion}</p>
                            )}
                            {grade.observaciones && (
                              <p className="text-sm text-gray-600 mt-1 italic">
                                {grade.observaciones}
                              </p>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <p
                              className={`text-xl font-bold ${
                                grade.calificacion >= 7
                                  ? 'text-green-600'
                                  : grade.calificacion >= 5
                                  ? 'text-yellow-600'
                                  : 'text-red-600'
                              }`}
                            >
                              {grade.calificacion}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDate(grade.fechaRegistro)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'boletin' && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Boletín de Calificaciones</h2>
            {reportCardLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : !reportCard ? (
              <p className="text-gray-500 text-center py-8">No se pudo cargar el boletín</p>
            ) : (
              <div className="space-y-6">
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold">
                    {reportCard.estudiante.nombre} {reportCard.estudiante.apellido}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {reportCard.curso.nombre} - {reportCard.curso.periodo}
                  </p>
                </div>

                {reportCard.materias.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No hay materias registradas</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Materia
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Promedio
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Equivalente
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {reportCard.materias.map((materiaData) => (
                          <tr key={materiaData.materia.id}>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {materiaData.materia.nombre}
                              </div>
                              <div className="text-xs text-gray-500">
                                {materiaData.materia.codigo}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              {materiaData.promedioGeneral !== null ? (
                                <span
                                  className={`text-lg font-bold ${
                                    materiaData.promedioGeneral >= 7
                                      ? 'text-green-600'
                                      : materiaData.promedioGeneral >= 5
                                      ? 'text-yellow-600'
                                      : 'text-red-600'
                                  }`}
                                >
                                  {materiaData.promedioGeneral.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              {materiaData.equivalenteGeneral ? (
                                <span className="text-sm font-medium text-gray-700">
                                  {materiaData.equivalenteGeneral}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {reportCard.promedioGeneral !== null && (
                        <tfoot className="bg-gray-50">
                          <tr>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                              Promedio General
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="text-xl font-bold text-blue-600">
                                {reportCard.promedioGeneral.toFixed(2)}
                              </span>
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'reporte' && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Reporte de Calificaciones</h2>
            {gradeReportLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : !gradeReport ? (
              <p className="text-gray-500 text-center py-8">No se pudo cargar el reporte</p>
            ) : (
              <div className="space-y-6">
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold">
                    {gradeReport.estudiante.nombre} {gradeReport.estudiante.apellido}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {gradeReport.curso?.nombre || 'Sin curso asignado'}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Total de calificaciones: {gradeReport.totalCalificaciones}
                  </p>
                </div>

                {gradeReport.resumenPorMateria.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No hay calificaciones registradas</p>
                ) : (
                  <div className="space-y-6">
                    {gradeReport.resumenPorMateria.map((materiaData) => (
                      <div
                        key={materiaData.materia.id}
                        className="border border-gray-200 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-semibold">{materiaData.materia.nombre}</h3>
                            <p className="text-sm text-gray-500">{materiaData.materia.codigo}</p>
                          </div>
                          {materiaData.promedio !== undefined && (
                            <div className="text-right">
                              <p className="text-sm text-gray-500">Promedio</p>
                              <p className="text-xl font-bold text-blue-600">
                                {materiaData.promedio.toFixed(2)}
                              </p>
                              <p className="text-xs text-gray-500">
                                {materiaData.total} calificación(es)
                              </p>
                            </div>
                          )}
                        </div>

                        {materiaData.grades.length > 0 && (
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                    Fecha
                                  </th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                    Período
                                  </th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                    Descripción
                                  </th>
                                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                                    Calificación
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {materiaData.grades.map((grade) => (
                                  <tr key={grade.id}>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600">
                                      {formatDate(grade.fechaRegistro || grade.createdAt)}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600">
                                      {grade.subPeriodo
                                        ? `${grade.subPeriodo.nombre} - ${grade.subPeriodo.periodo?.nombre || ''}`
                                        : '-'}
                                    </td>
                                    <td className="px-3 py-2 text-sm text-gray-600">
                                      {grade.insumo?.nombre || grade.descripcion || grade.parcial || '-'}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-center">
                                      <span
                                        className={`text-lg font-bold ${
                                          grade.calificacion >= 7
                                            ? 'text-green-600'
                                            : grade.calificacion >= 5
                                            ? 'text-yellow-600'
                                            : 'text-red-600'
                                        }`}
                                      >
                                        {grade.calificacion}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDetailRepresentante;

