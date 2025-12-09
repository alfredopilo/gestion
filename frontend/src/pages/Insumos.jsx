import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const Insumos = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [subPeriods, setSubPeriods] = useState([]);
  const [insumos, setInsumos] = useState([]);
  
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [selectedSubPeriod, setSelectedSubPeriod] = useState(null);
  
  const [showModal, setShowModal] = useState(false);
  const [editingInsumo, setEditingInsumo] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    fechaDeber: '',
    fechaEntrega: '',
    activo: true,
    recibirTarea: false,
    orden: '',
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      fetchSubjects();
    } else {
      setSubjects([]);
      setSelectedSubject(null);
    }
  }, [selectedCourse]);

  useEffect(() => {
    if (selectedPeriod) {
      fetchSubPeriods();
    } else {
      setSubPeriods([]);
      setSelectedSubPeriod(null);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    // Solo cargar insumos si todos los filtros están seleccionados
    if (selectedCourse && selectedSubject && selectedPeriod && selectedSubPeriod) {
      fetchInsumos();
    } else {
      setInsumos([]);
    }
  }, [selectedCourse, selectedSubject, selectedPeriod, selectedSubPeriod]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      
      // Si es docente, obtener sus asignaciones
      if (user?.rol === 'PROFESOR') {
        const assignmentsRes = await api.get('/teachers/my-assignments');
        const assignments = assignmentsRes.data.data || [];
        
        // Convertir asignaciones a formato de cursos y materias
        const coursesList = assignments.map(a => ({
          id: a.curso.id,
          nombre: a.curso.nombre,
          nivel: a.curso.nivel,
          paralelo: a.curso.paralelo,
          materias: a.materias,
        }));
        
        setCourses(coursesList);
      } else {
        // Si es admin/secretaria, obtener todos los cursos
        const coursesRes = await api.get('/courses?limit=100');
        setCourses(coursesRes.data.data || []);
      }
      
      // Obtener períodos
      const periodsRes = await api.get('/periods');
      const allPeriods = periodsRes.data.data || [];
      setPeriods(allPeriods);
      
      // Encontrar período activo
      const active = allPeriods.find(p => p.activo) || allPeriods[0];
      if (active) {
        setSelectedPeriod(active);
        fetchSubPeriods(active.id);
      }
    } catch (error) {
      console.error('Error al cargar datos iniciales:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjects = async () => {
    if (!selectedCourse) return;
    
    try {
      if (user?.rol === 'PROFESOR') {
        // Si es docente, usar las materias del curso seleccionado
        const course = courses.find(c => c.id === selectedCourse.id);
        if (course && course.materias) {
          setSubjects(course.materias);
        } else {
          setSubjects([]);
        }
      } else {
        // Si es admin/secretaria, obtener materias del curso
        const response = await api.get(`/assignments?cursoId=${selectedCourse.id}`);
        const assignments = response.data.data || [];
        const subjectsList = assignments.map(a => a.materia).filter(Boolean);
        setSubjects(subjectsList);
      }
    } catch (error) {
      console.error('Error al cargar materias:', error);
      toast.error('Error al cargar materias');
      setSubjects([]);
    }
  };

  const fetchSubPeriods = async (periodId) => {
    // Si no se pasa periodId, usar el período seleccionado
    const idToUse = periodId || selectedPeriod?.id;
    if (!idToUse) {
      setSubPeriods([]);
      return;
    }
    
    try {
      const response = await api.get(`/sub-periods?periodoId=${idToUse}`);
      const subPeriodsList = response.data.data || [];
      setSubPeriods(subPeriodsList.sort((a, b) => (a.orden || 0) - (b.orden || 0)));
      // Solo seleccionar automáticamente si no hay uno seleccionado
      if (subPeriodsList.length > 0 && !selectedSubPeriod) {
        setSelectedSubPeriod(subPeriodsList[0]);
      }
    } catch (error) {
      console.error('Error al cargar subperíodos:', error);
      toast.error('Error al cargar subperíodos');
    }
  };

  const fetchInsumos = async () => {
    // Validar que todos los filtros estén seleccionados
    if (!selectedCourse || !selectedSubject || !selectedPeriod || !selectedSubPeriod) {
      setInsumos([]);
      return;
    }
    
    try {
      // Filtrar por curso, materia y subperíodo
      const response = await api.get(
        `/insumos?cursoId=${selectedCourse.id}&materiaId=${selectedSubject.id}&subPeriodoId=${selectedSubPeriod.id}`
      );
      const insumosData = response.data.data || [];
      console.log('Insumos recibidos:', insumosData);
      // Verificar que las fechas estén presentes
      insumosData.forEach(insumo => {
        console.log(`Insumo ${insumo.nombre}:`, {
          fechaDeber: insumo.fechaDeber,
          fechaEntrega: insumo.fechaEntrega,
          tipoFechaDeber: typeof insumo.fechaDeber,
          tipoFechaEntrega: typeof insumo.fechaEntrega
        });
      });
      setInsumos(insumosData);
    } catch (error) {
      console.error('Error al cargar insumos:', error);
      toast.error('Error al cargar insumos');
    }
  };

  const handleOpenModal = () => {
    setEditingInsumo(null);
    setFormData({
      nombre: '',
      descripcion: '',
      fechaDeber: '',
      fechaEntrega: '',
      activo: true,
      recibirTarea: false,
      orden: '',
    });
    setShowModal(true);
  };

  const handleEditInsumo = (insumo) => {
    setEditingInsumo(insumo);
    // Formatear fechas para el input type="date" (YYYY-MM-DD)
    // Manejar zona horaria correctamente
    const formatDateForInput = (dateString) => {
      if (!dateString) return '';
      try {
        const date = new Date(dateString);
        // Verificar que la fecha es válida
        if (isNaN(date.getTime())) return '';
        // Usar fecha local para evitar problemas de zona horaria
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      } catch (error) {
        console.error('Error al formatear fecha:', error);
        return '';
      }
    };
    
    setFormData({
      nombre: insumo.nombre,
      descripcion: insumo.descripcion || '',
      fechaDeber: formatDateForInput(insumo.fechaDeber),
      fechaEntrega: formatDateForInput(insumo.fechaEntrega),
      activo: insumo.activo,
      recibirTarea: insumo.recibirTarea || false,
      orden: insumo.orden || '',
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingInsumo(null);
    setFormData({
      nombre: '',
      descripcion: '',
      fechaDeber: '',
      fechaEntrega: '',
      activo: true,
      recibirTarea: false,
      orden: '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validar que todos los filtros estén seleccionados
    if (!selectedCourse) {
      toast.error('Debe seleccionar un curso');
      return;
    }
    if (!selectedSubject) {
      toast.error('Debe seleccionar una materia');
      return;
    }
    if (!selectedPeriod) {
      toast.error('Debe seleccionar un período');
      return;
    }
    if (!selectedSubPeriod) {
      toast.error('Debe seleccionar un subperíodo');
      return;
    }

    try {
      // Validar que fechaDeber esté presente
      if (!formData.fechaDeber) {
        toast.error('La fecha del insumo es obligatoria');
        return;
      }

      // Convertir fechas a formato ISO para el backend
      const formatDateForBackend = (dateString) => {
        if (!dateString) return null;
        try {
          // Si ya está en formato ISO, retornarlo
          if (dateString.includes('T')) return dateString;
          // Si es formato YYYY-MM-DD, crear fecha y convertir a ISO
          // Usar hora local para evitar problemas de zona horaria
          const date = new Date(dateString + 'T00:00:00');
          if (isNaN(date.getTime())) {
            throw new Error('Fecha inválida');
          }
          return date.toISOString();
        } catch (error) {
          console.error('Error al formatear fecha para backend:', error);
          return null;
        }
      };

      // Preparar datos según si es creación o actualización
      let data;
      if (editingInsumo) {
        // Al actualizar, no enviar cursoId, materiaId ni subPeriodoId (no se pueden cambiar)
        data = {
          nombre: formData.nombre,
          descripcion: formData.descripcion,
          fechaDeber: formatDateForBackend(formData.fechaDeber),
          fechaEntrega: formData.fechaEntrega ? formatDateForBackend(formData.fechaEntrega) : null,
          activo: formData.activo,
          recibirTarea: formData.recibirTarea,
          orden: formData.orden ? parseInt(formData.orden) : undefined,
        };
      } else {
        // Al crear, incluir todos los campos
        data = {
          ...formData,
          cursoId: selectedCourse.id,
          materiaId: selectedSubject.id,
          subPeriodoId: selectedSubPeriod.id,
          fechaDeber: formatDateForBackend(formData.fechaDeber),
          fechaEntrega: formData.fechaEntrega ? formatDateForBackend(formData.fechaEntrega) : null,
          recibirTarea: formData.recibirTarea,
          orden: formData.orden ? parseInt(formData.orden) : undefined,
        };
      }

      let response;
      if (editingInsumo) {
        response = await api.put(`/insumos/${editingInsumo.id}`, data);
        toast.success('Insumo actualizado exitosamente');
      } else {
        response = await api.post('/insumos', data);
        toast.success('Insumo creado exitosamente');
      }

      handleCloseModal();
      // Recargar insumos después de guardar
      await fetchInsumos();
    } catch (error) {
      console.error('Error al guardar insumo:', error);
      toast.error(error.response?.data?.error || 'Error al guardar insumo');
    }
  };

  const handleDeleteInsumo = async (insumoId) => {
    if (!window.confirm('¿Estás seguro de eliminar este insumo?')) return;

    try {
      await api.delete(`/insumos/${insumoId}`);
      toast.success('Insumo eliminado exitosamente');
      fetchInsumos();
    } catch (error) {
      console.error('Error al eliminar insumo:', error);
      toast.error(error.response?.data?.error || 'Error al eliminar insumo');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        <span className="ml-4 text-gray-600">Cargando...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Insumos</h1>

      {/* Filtros */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Curso <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedCourse?.id || ''}
              onChange={(e) => {
                const course = courses.find(c => c.id === e.target.value);
                setSelectedCourse(course || null);
                setSelectedSubject(null);
                // No limpiar período ni subperíodo al cambiar curso
                // Solo limpiar materia porque depende del curso
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            >
              <option value="">Seleccionar curso</option>
              {courses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.nombre} - {course.nivel} {course.paralelo || ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Materia <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedSubject?.id || ''}
              onChange={(e) => {
                const subject = subjects.find(s => s.id === e.target.value);
                setSelectedSubject(subject || null);
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              disabled={!selectedCourse}
              required
            >
              <option value="">Seleccionar materia</option>
              {subjects.map(subject => (
                <option key={subject.id} value={subject.id}>
                  {subject.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Período <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedPeriod?.id || ''}
              onChange={(e) => {
                const period = periods.find(p => p.id === e.target.value);
                setSelectedPeriod(period || null);
                setSelectedSubPeriod(null);
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            >
              <option value="">Seleccionar período</option>
              {periods.map(period => (
                <option key={period.id} value={period.id}>
                  {period.nombre} {period.activo && '(Activo)'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subperíodo <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedSubPeriod?.id || ''}
              onChange={(e) => {
                const subPeriod = subPeriods.find(sp => sp.id === e.target.value);
                setSelectedSubPeriod(subPeriod || null);
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              disabled={!selectedPeriod}
              required
            >
              <option value="">Seleccionar subperíodo</option>
              {subPeriods.map(subPeriod => (
                <option key={subPeriod.id} value={subPeriod.id}>
                  {subPeriod.nombre} ({subPeriod.ponderacion}%)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Mensaje cuando faltan selecciones */}
      {(!selectedCourse || !selectedSubject || !selectedPeriod || !selectedSubPeriod) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800">
            <strong>Seleccione todos los filtros:</strong> Curso, Materia, Período y Subperíodo para ver y gestionar los insumos.
          </p>
        </div>
      )}

      {/* Lista de Insumos */}
      {selectedCourse && selectedSubject && selectedPeriod && selectedSubPeriod && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">
                Insumos: {selectedSubPeriod.nombre}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Curso: {selectedCourse.nombre} | Materia: {selectedSubject.nombre} | Período: {selectedPeriod.nombre}
              </p>
            </div>
            {(user?.rol === 'ADMIN' || user?.rol === 'SECRETARIA' || user?.rol === 'PROFESOR') && (
              <button
                onClick={handleOpenModal}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
              >
                + Nuevo Insumo
              </button>
            )}
          </div>

          {insumos.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No hay insumos registrados para este subperíodo
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orden</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Insumo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Entrega</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {insumos.map(insumo => {
                    const formatDate = (dateValue) => {
                      // Manejar diferentes tipos de entrada
                      if (!dateValue) return '-';
                      
                      try {
                        let date;
                        // Si ya es un objeto Date
                        if (dateValue instanceof Date) {
                          date = dateValue;
                        } 
                        // Si es un string o número
                        else {
                          date = new Date(dateValue);
                        }
                        
                        // Verificar que la fecha es válida
                        if (isNaN(date.getTime())) {
                          console.warn('Fecha inválida:', dateValue);
                          return '-';
                        }
                        
                        // Formatear la fecha
                        const formatted = date.toLocaleDateString('es-ES', { 
                          year: 'numeric', 
                          month: '2-digit', 
                          day: '2-digit' 
                        });
                        
                        return formatted;
                      } catch (error) {
                        console.error('Error al formatear fecha para mostrar:', error, 'Valor:', dateValue);
                        return '-';
                      }
                    };
                    
                    return (
                      <tr key={insumo.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {insumo.orden || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{insumo.nombre}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-500">{insumo.descripcion || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(insumo.fechaDeber)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(insumo.fechaEntrega)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            insumo.activo 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {insumo.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {(user?.rol === 'ADMIN' || user?.rol === 'SECRETARIA' || user?.rol === 'PROFESOR') && (
                          <>
                            <button
                              onClick={() => handleEditInsumo(insumo)}
                              className="text-primary-600 hover:text-primary-900 mr-4"
                            >
                              Editar
                            </button>
                            {user?.rol === 'ADMIN' && (
                              <button
                                onClick={() => handleDeleteInsumo(insumo.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Eliminar
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal para crear/editar insumo */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">
              {editingInsumo ? 'Editar Insumo' : 'Nuevo Insumo'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Ej: Tarea, Examen, Proyecto"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción
                </label>
                <textarea
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows="3"
                  placeholder="Descripción del insumo..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha Insumo <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.fechaDeber}
                  onChange={(e) => setFormData({ ...formData, fechaDeber: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de Entrega <span className="text-gray-500">(opcional)</span>
                </label>
                <input
                  type="date"
                  value={formData.fechaEntrega}
                  onChange={(e) => setFormData({ ...formData, fechaEntrega: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Orden
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.orden}
                  onChange={(e) => setFormData({ ...formData, orden: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Orden de visualización"
                />
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Activo</span>
                </label>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.recibirTarea}
                    onChange={(e) => setFormData({ ...formData, recibirTarea: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Recibir tarea</span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  Los estudiantes recibirán una notificación cuando esta opción esté activa
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
                  {editingInsumo ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Insumos;

