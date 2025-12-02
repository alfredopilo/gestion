import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const SchoolPromotion = () => {
  const { selectedInstitutionId, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [activeSchoolYear, setActiveSchoolYear] = useState(null);
  const [nuevoAno, setNuevoAno] = useState('');
  const [preview, setPreview] = useState(null);
  const [studentDecisions, setStudentDecisions] = useState({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    if (selectedInstitutionId) {
      fetchActiveSchoolYear();
    }
  }, [selectedInstitutionId]);

  useEffect(() => {
    // Establecer año nuevo por defecto (año actual + 1)
    if (activeSchoolYear && !nuevoAno) {
      const anoActual = activeSchoolYear.ano || new Date().getFullYear();
      setNuevoAno((anoActual + 1).toString());
    }
  }, [activeSchoolYear, nuevoAno]);

  const fetchActiveSchoolYear = async () => {
    try {
      setLoading(true);
      const response = await api.get('/school-years/active');
      if (response.data) {
        setActiveSchoolYear(response.data);
      } else {
        toast.error('No hay un año lectivo activo');
      }
    } catch (error) {
      console.error('Error al cargar año lectivo activo:', error);
      toast.error('Error al cargar año lectivo activo');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePreview = async () => {
    if (!selectedInstitutionId || !nuevoAno) {
      toast.error('Debe seleccionar una institución e ingresar el año nuevo');
      return;
    }

    const nuevoAnoInt = parseInt(nuevoAno);
    if (isNaN(nuevoAnoInt)) {
      toast.error('El año debe ser un número válido');
      return;
    }

    try {
      setGeneratingPreview(true);
      const response = await api.get(
        `/promotion/preview/${selectedInstitutionId}?nuevoAno=${nuevoAnoInt}`
      );
      
      setPreview(response.data);
      initializeStudentDecisions(response.data);
      toast.success('Vista previa generada exitosamente');
    } catch (error) {
      console.error('Error al generar vista previa:', error);
      toast.error(error.response?.data?.error || 'Error al generar vista previa');
    } finally {
      setGeneratingPreview(false);
    }
  };

  const initializeStudentDecisions = (previewData) => {
    const decisions = {};
    
    // Inicializar decisiones para estudiantes que pasan (promover por defecto)
    previewData.estudiantesQuePasan.forEach(estudiante => {
      // Buscar el curso siguiente basado en cursoSiguienteNombre
      let cursoDefault = null;
      if (estudiante.cursoSiguienteNombre) {
        cursoDefault = previewData.cursosACopiar.find(c => 
          c.nombre === estudiante.cursoSiguienteNombre || 
          c.cursoSiguienteNombre === estudiante.cursoSiguienteNombre
        );
      }
      
      decisions[estudiante.studentId] = {
        accion: 'promover',
        nuevoCursoId: cursoDefault?.id || null,
      };
    });

    // Inicializar decisiones para estudiantes que no pasan (sin acción por defecto)
    previewData.estudiantesQueNoPasan.forEach(estudiante => {
      decisions[estudiante.studentId] = {
        accion: 'sin-asignar', // Por defecto no se asigna
        nuevoCursoId: null,
      };
    });

    setStudentDecisions(decisions);
  };

  const updateStudentDecision = (studentId, accion, nuevoCursoId = null) => {
    setStudentDecisions(prev => ({
      ...prev,
      [studentId]: {
        accion,
        nuevoCursoId,
      },
    }));
  };

  const handleExecutePromotion = async () => {
    if (!selectedInstitutionId || !nuevoAno || !preview) {
      toast.error('Debe generar la vista previa primero');
      return;
    }

    // Validar que todas las decisiones estén tomadas
    const allDecisions = [...preview.estudiantesQuePasan, ...preview.estudiantesQueNoPasan];
    const missingDecisions = allDecisions.filter(e => !studentDecisions[e.studentId]);
    
    if (missingDecisions.length > 0) {
      toast.error(`Faltan decisiones para ${missingDecisions.length} estudiante(s)`);
      return;
    }

    // Validar estudiantes que promueven necesitan curso destino
    const invalidPromotions = allDecisions.filter(e => {
      const decision = studentDecisions[e.studentId];
      return decision?.accion === 'promover' && !decision.nuevoCursoId;
    });

    if (invalidPromotions.length > 0) {
      toast.error(`${invalidPromotions.length} estudiante(s) promovido(s) sin curso destino asignado`);
      return;
    }

    setShowConfirmModal(true);
  };

  const confirmExecute = async () => {
    try {
      setExecuting(true);
      setShowConfirmModal(false);

      const estudiantesPromocion = Object.keys(studentDecisions).map(studentId => {
        const decision = studentDecisions[studentId];
        return {
          studentId,
          accion: decision.accion,
          cursoIdOriginal: decision.nuevoCursoId, // El ID del curso original que se copiará
        };
      });

      const response = await api.post('/promotion/execute', {
        institucionId: selectedInstitutionId,
        nuevoAno: parseInt(nuevoAno),
        estudiantesPromocion,
      });

      toast.success('Promoción escolar ejecutada exitosamente');
      
      // Limpiar estado
      setPreview(null);
      setStudentDecisions({});
      setNuevoAno('');
      
      // Recargar año lectivo activo
      await fetchActiveSchoolYear();

      // Mostrar resumen
      if (response.data?.resumen) {
        toast.success(
          `Promoción completada: ${response.data.resumen.estudiantesPromovidos} promovidos, ` +
          `${response.data.resumen.estudiantesRepetidores} repetidores, ` +
          `${response.data.resumen.estudiantesSinAsignar} sin asignar`
        );
      }
    } catch (error) {
      console.error('Error al ejecutar promoción:', error);
      toast.error(error.response?.data?.error || 'Error al ejecutar promoción escolar');
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!activeSchoolYear) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            No hay un año lectivo activo para esta institución. Debe crear y activar un año lectivo primero.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Promoción Escolar Global</h1>
        <p className="mt-2 text-sm text-gray-600">
          Realiza la promoción completa de la institución al siguiente año lectivo
        </p>
      </div>

      {/* Información del año actual */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-blue-900">
              Año Lectivo Actual: {activeSchoolYear.nombre}
            </h3>
            <p className="text-sm text-blue-700">
              Fechas: {format(new Date(activeSchoolYear.fechaInicio), 'dd/MM/yyyy')} - {format(new Date(activeSchoolYear.fechaFin), 'dd/MM/yyyy')}
            </p>
          </div>
        </div>
      </div>

      {/* Formulario para generar vista previa */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Configuración de Promoción</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Año Nuevo
            </label>
            <input
              type="number"
              value={nuevoAno}
              onChange={(e) => setNuevoAno(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              placeholder="Ej: 2026"
              min={activeSchoolYear.ano + 1}
            />
            <p className="mt-1 text-xs text-gray-500">
              El nuevo año lectivo será: {nuevoAno ? `${nuevoAno}-${parseInt(nuevoAno) + 1}` : '-'}
            </p>
          </div>
          <div className="md:col-span-2 flex items-end">
            <button
              onClick={handleGeneratePreview}
              disabled={!nuevoAno || generatingPreview}
              className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generatingPreview ? 'Generando...' : 'Generar Vista Previa'}
            </button>
          </div>
        </div>
      </div>

      {/* Vista Previa */}
      {preview && (
        <div className="space-y-6">
          {/* Resumen General */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Resumen de la Promoción</h2>
            <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600">{preview.resumen.totalCursos}</div>
                <div className="text-sm text-gray-600">Cursos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600">{preview.resumen.totalMaterias}</div>
                <div className="text-sm text-gray-600">Materias</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600">{preview.resumen.totalEscalas || 0}</div>
                <div className="text-sm text-gray-600">Escalas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600">{preview.resumen.totalPeriodos}</div>
                <div className="text-sm text-gray-600">Períodos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{preview.resumen.estudiantesQuePasan}</div>
                <div className="text-sm text-gray-600">Pasan</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{preview.resumen.estudiantesQueNoPasan}</div>
                <div className="text-sm text-gray-600">No Pasan</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">{preview.resumen.totalEstudiantes}</div>
                <div className="text-sm text-gray-600">Total</div>
              </div>
            </div>
          </div>

          {/* Estudiantes que Pasan */}
          {preview.estudiantesQuePasan.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-green-700">
                Estudiantes que Pasan ({preview.estudiantesQuePasan.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estudiante</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Curso Actual</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Promedio</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acción</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Curso Destino</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {preview.estudiantesQuePasan.map((estudiante) => {
                      const decision = studentDecisions[estudiante.studentId];
                      const nuevoCurso = decision?.nuevoCursoId
                        ? preview.cursosACopiar.find(c => {
                            // Buscar el curso en los cursos nuevos (no copiados aún, pero sabemos cuál será)
                            return c.nombre === estudiante.cursoSiguienteNombre || c.cursoSiguienteNombre;
                          })
                        : null;
                      
                      return (
                        <tr key={estudiante.studentId} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {estudiante.studentNombre}
                            </div>
                            <div className="text-sm text-gray-500">
                              {estudiante.studentNumeroIdentificacion}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {estudiante.cursoNombre}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-semibold text-green-600">
                              {estudiante.promedioGeneral.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select
                              value={decision?.accion || 'promover'}
                              onChange={(e) => {
                                const accion = e.target.value;
                                if (accion === 'promover') {
                                  // Buscar curso siguiente automáticamente
                                  const cursoSiguiente = preview.cursosACopiar.find(c => 
                                    c.nombre.includes(estudiante.cursoNivel) && 
                                    estudiante.cursoSiguienteNombre && 
                                    c.nombre === estudiante.cursoSiguienteNombre
                                  );
                                  updateStudentDecision(estudiante.studentId, accion, cursoSiguiente?.id || null);
                                } else {
                                  updateStudentDecision(estudiante.studentId, accion);
                                }
                              }}
                              className="text-sm border border-gray-300 rounded-md px-2 py-1"
                            >
                              <option value="promover">Promover</option>
                              <option value="repetir">Repetir</option>
                              <option value="sin-asignar">Sin Asignar</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {decision?.accion === 'promover' || decision?.accion === 'repetir' ? (
                              <select
                                value={decision?.nuevoCursoId || ''}
                                onChange={(e) => updateStudentDecision(estudiante.studentId, decision?.accion || 'promover', e.target.value)}
                                className="text-sm border border-gray-300 rounded-md px-2 py-1 w-full"
                              >
                                <option value="">Seleccionar curso...</option>
                                {preview.cursosACopiar.map(curso => (
                                  <option key={curso.id} value={curso.id}>
                                    {curso.nombre} {curso.nivel} {curso.paralelo ? `"${curso.paralelo}"` : ''}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Estudiantes que NO Pasan */}
          {preview.estudiantesQueNoPasan.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-red-700">
                Estudiantes que NO Pasan ({preview.estudiantesQueNoPasan.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estudiante</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Curso Actual</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Promedio</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Materias No Aprobadas</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acción</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Curso Destino</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {preview.estudiantesQueNoPasan.map((estudiante) => {
                      const decision = studentDecisions[estudiante.studentId];
                      const materiasNoAprobadas = estudiante.materias.filter(m => !m.aprobado);
                      
                      return (
                        <tr key={estudiante.studentId} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {estudiante.studentNombre}
                            </div>
                            <div className="text-sm text-gray-500">
                              {estudiante.studentNumeroIdentificacion}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {estudiante.cursoNombre}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-semibold text-red-600">
                              {estudiante.promedioGeneral.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">
                              {materiasNoAprobadas.length > 0 ? (
                                <div className="space-y-1">
                                  {materiasNoAprobadas.map((materia, idx) => (
                                    <div key={idx} className="text-xs px-2 py-1 rounded bg-red-100 text-red-800 inline-block mr-1">
                                      {materia.materiaNombre}: {materia.promedio.toFixed(2)}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select
                              value={decision?.accion || 'sin-asignar'}
                              onChange={(e) => {
                                const accion = e.target.value;
                                if (accion === 'repetir' || accion === 'promover') {
                                  // Si repite, usar el mismo curso por defecto
                                  const cursoActual = preview.cursosACopiar.find(c => c.id === estudiante.cursoId);
                                  updateStudentDecision(estudiante.studentId, accion, cursoActual?.id || null);
                                } else {
                                  updateStudentDecision(estudiante.studentId, accion);
                                }
                              }}
                              className="text-sm border border-gray-300 rounded-md px-2 py-1"
                            >
                              <option value="repetir">Repetir Curso</option>
                              <option value="promover">Promover a Otro Curso</option>
                              <option value="sin-asignar">Sin Asignar</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {decision?.accion === 'promover' || decision?.accion === 'repetir' ? (
                              <select
                                value={decision?.nuevoCursoId || ''}
                                onChange={(e) => updateStudentDecision(estudiante.studentId, decision?.accion || 'repetir', e.target.value)}
                                className="text-sm border border-gray-300 rounded-md px-2 py-1 w-full"
                              >
                                <option value="">Seleccionar curso...</option>
                                {preview.cursosACopiar.map(curso => (
                                  <option key={curso.id} value={curso.id}>
                                    {curso.nombre} {curso.paralelo || ''}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Cursos a Copiar */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Cursos a Copiar ({preview.cursosACopiar.length})</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Curso</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nivel</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacidad</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estudiantes</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Siguiente Curso</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {preview.cursosACopiar.map((curso) => (
                    <tr key={curso.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {curso.nombre}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {curso.nivel} {curso.paralelo || ''}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {curso.capacidad || 30}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {curso.totalEstudiantes}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {curso.cursoSiguienteNombre || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Materias a Copiar */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Materias a Copiar ({preview.materiasACopiar.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {preview.materiasACopiar.map((materia) => (
                <div key={materia.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="font-medium text-gray-900">{materia.nombre}</div>
                  <div className="text-sm text-gray-500">{materia.codigo}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Escalas de Calificación a Copiar */}
          {preview.escalasACopiar && preview.escalasACopiar.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Escalas de Calificación a Copiar ({preview.escalasACopiar.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {preview.escalasACopiar.map((escala) => (
                  <div key={escala.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="font-medium text-gray-900 mb-2">{escala.nombre}</div>
                    <div className="text-sm text-gray-600 mb-2">{escala.totalDetalles} niveles de calificación</div>
                    <div className="space-y-1">
                      {escala.detalles.map((detalle, idx) => (
                        <div key={idx} className="flex justify-between text-xs text-gray-600">
                          <span>{detalle.titulo}</span>
                          <span className="font-medium">{detalle.valor.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Períodos a Copiar */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Períodos a Copiar ({preview.periodosACopiar.length})</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Período</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fechas Originales</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nuevas Fechas</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subperíodos</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {preview.periodosACopiar.map((periodo) => (
                    <tr key={periodo.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {periodo.nombre}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(periodo.fechaInicio), 'dd/MM/yyyy')} - {format(new Date(periodo.fechaFin), 'dd/MM/yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">
                        {format(new Date(periodo.nuevaFechaInicio), 'dd/MM/yyyy')} - {format(new Date(periodo.nuevaFechaFin), 'dd/MM/yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {periodo.esSupletorio ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                            Supletorio
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                            Regular
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {periodo.totalSubPeriodos}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Botón de Ejecutar */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">¿Todo listo?</h3>
                <p className="text-sm text-gray-600">
                  Revisa todas las decisiones y luego ejecuta la promoción escolar
                </p>
              </div>
              <button
                onClick={handleExecutePromotion}
                disabled={executing}
                className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                {executing ? 'Ejecutando...' : 'Ejecutar Promoción Escolar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Confirmar Promoción Escolar
              </h3>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-800">
                  <strong>¿Está seguro de ejecutar la promoción escolar?</strong>
                </p>
                <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside space-y-1">
                  <li>Se creará el nuevo año lectivo: {preview?.nuevoAnoLectivo?.nombre}</li>
                  <li>Se copiarán {preview?.resumen?.totalCursos} cursos</li>
                  <li>Se copiarán {preview?.resumen?.totalMaterias} materias</li>
                  {preview?.resumen?.totalEscalas > 0 && (
                    <li>Se copiarán {preview?.resumen?.totalEscalas} escalas de calificación</li>
                  )}
                  <li>Se copiarán {preview?.resumen?.totalPeriodos} períodos</li>
                  <li>Se promoverán los estudiantes según las decisiones configuradas</li>
                </ul>
                <p className="mt-3 text-sm font-semibold text-yellow-900">
                  Esta acción no se puede deshacer. Todos los datos históricos se mantendrán intactos.
                </p>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={executing}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmExecute}
                  disabled={executing}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {executing ? 'Ejecutando...' : 'Confirmar y Ejecutar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchoolPromotion;

