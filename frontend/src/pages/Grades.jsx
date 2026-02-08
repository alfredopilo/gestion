import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const Grades = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);

  // Vista resumen: se activa si GET /grades/summary responde OK (el backend decide por rol)
  const [summaryViewAvailable, setSummaryViewAvailable] = useState(false);
  const [summaryData, setSummaryData] = useState([]);
  const [periodos, setPeriodos] = useState([]);
  const [periodoActivo, setPeriodoActivo] = useState(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(true);

  const isStudent = user?.rol === 'ESTUDIANTE' && user?.student?.id;

  useEffect(() => {
    if (isStudent) {
      fetchStudentGrades();
      return;
    }
    fetchSummaryOrGrades();
  }, [isStudent]);

  // Al cambiar el período, recargar resumen (solo si ya tenemos acceso a la vista resumen)
  useEffect(() => {
    if (isStudent || !summaryViewAvailable) return;
    const params = selectedPeriodId ? { periodId: selectedPeriodId } : {};
    setSummaryLoading(true);
    api
      .get('/grades/summary', { params })
      .then((response) => {
        setSummaryData(response.data.data || []);
        setPeriodos(response.data.periodos || []);
        setPeriodoActivo(response.data.periodoActivo || null);
      })
      .catch((err) => console.error('Error al cargar resumen:', err))
      .finally(() => setSummaryLoading(false));
  }, [selectedPeriodId]);

  const fetchSummaryOrGrades = async () => {
    setSummaryLoading(true);
    setLoading(true);
    try {
      const params = selectedPeriodId ? { periodId: selectedPeriodId } : {};
      const response = await api.get('/grades/summary', { params });
      setSummaryData(response.data.data || []);
      setPeriodos(response.data.periodos || []);
      setPeriodoActivo(response.data.periodoActivo || null);
      setSummaryViewAvailable(true);
    } catch (error) {
      console.error('Error al cargar resumen de calificaciones:', error);
      setSummaryViewAvailable(false);
      try {
        const res = await api.get('/grades');
        setGrades(res.data.data || []);
      } catch (e) {
        console.error('Error al cargar calificaciones:', e);
      }
    } finally {
      setSummaryLoading(false);
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    if (!summaryViewAvailable) return;
    setSummaryLoading(true);
    try {
      const params = selectedPeriodId ? { periodId: selectedPeriodId } : {};
      const response = await api.get('/grades/summary', { params });
      setSummaryData(response.data.data || []);
      setPeriodos(response.data.periodos || []);
      setPeriodoActivo(response.data.periodoActivo || null);
    } catch (error) {
      console.error('Error al cargar resumen:', error);
    } finally {
      setSummaryLoading(false);
    }
  };

  const fetchStudentGrades = async () => {
    try {
      const response = await api.get(`/grades/student/${user.student.id}`);
      setGrades(response.data.resumenPorMateria || []);
    } catch (error) {
      console.error('Error al cargar calificaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEstadoLabel = (item) => {
    if (item.totalEstudiantes === 0) return 'Sin estudiantes';
    if (item.conCalificacion === 0) return 'Sin cargar';
    if (item.conCalificacion >= item.totalEstudiantes) return 'Completo';
    return 'Pendiente';
  };

  const getEstadoClass = (item) => {
    const estado = getEstadoLabel(item);
    if (estado === 'Completo') return 'bg-green-100 text-green-800';
    if (estado === 'Pendiente') return 'bg-amber-100 text-amber-800';
    return 'bg-gray-100 text-gray-700';
  };

  const formatFecha = (isoString) => {
    if (!isoString) return null;
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const buildGradeEntryUrl = (item) => {
    const params = new URLSearchParams();
    if (item.cursoId) params.set('courseId', item.cursoId);
    if (item.materiaId) params.set('subjectId', item.materiaId);
    if (selectedPeriodId) params.set('periodId', selectedPeriodId);
    const q = params.toString();
    return `/grade-entry${q ? `?${q}` : ''}`;
  };

  if (isStudent) {
    if (loading) return <div>Cargando...</div>;
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
              {grades.map((item, index) => {
                const materia = item.materia || item;
                const calificaciones = item.calificaciones || [];
                return (
                  <div
                    key={`${materia.id || item.materia?.id || 'materia'}-${index}`}
                    className="border-b pb-4"
                  >
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
  }

  if (summaryViewAvailable) {
    return (
      <div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-gray-900">Calificaciones</h1>
          <Link
            to="/grade-scales"
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Configurar escalas de calificación
          </Link>
        </div>

        {periodoActivo && (
          <div className="mb-4 p-4 bg-primary-50 border border-primary-200 rounded-lg">
            <p className="text-primary-800">
              <span className="font-semibold">Período activo:</span> {periodoActivo.nombre}. Recordar cargar calificaciones.
            </p>
          </div>
        )}

        {periodos.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Período</label>
            <select
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 max-w-xs"
            >
              <option value="">Todos / activo</option>
              {periodos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} {p.activo ? '(Activo)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="bg-white shadow rounded-lg p-6">
          {summaryLoading ? (
            <p className="text-gray-500">Cargando...</p>
          ) : summaryData.length === 0 ? (
            <p className="text-gray-500">No hay asignaciones de materia-curso para el período seleccionado.</p>
          ) : (
            <div className="space-y-4">
              {summaryData.map((item) => (
                <div
                  key={`${item.cursoId}-${item.materiaId}`}
                  className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {item.materiaNombre} – {item.cursoNombre}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {item.conCalificacion} / {item.totalEstudiantes} estudiantes con calificación
                        {item.promedioGrupo != null && (
                          <span className="ml-2 font-medium text-gray-800">
                            · Promedio grupo: {Number(item.promedioGrupo).toFixed(2)}
                          </span>
                        )}
                      </p>
                      {item.ultimaActualizacion && (
                        <p className="text-xs text-gray-500 mt-1">
                          Última actualización: {formatFecha(item.ultimaActualizacion)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getEstadoClass(item)}`}>
                        {getEstadoLabel(item)}
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate(buildGradeEntryUrl(item))}
                        className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700"
                      >
                        Ingresar calificaciones
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fallback: sin acceso a resumen (ej. representante) o error al cargar resumen
  if (loading && !summaryViewAvailable) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Calificaciones</h1>
        </div>
        <div className="bg-white shadow rounded-lg p-6">
          <p className="text-gray-500">Cargando...</p>
        </div>
      </div>
    );
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
            {grades.map((item, index) => {
              const materia = item.materia || item;
              const calificaciones = item.calificaciones || [];
              return (
                <div
                  key={`${materia.id || item.materia?.id || 'materia'}-${index}`}
                  className="border-b pb-4"
                >
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
