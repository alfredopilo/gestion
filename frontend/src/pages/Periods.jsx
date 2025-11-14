import { useState, useEffect } from 'react';
import React from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';

const Periods = () => {
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSubPeriodModal, setShowSubPeriodModal] = useState(false);
  const [showInsumoModal, setShowInsumoModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState(null);
  const [editingSubPeriod, setEditingSubPeriod] = useState(null);
  const [editingInsumo, setEditingInsumo] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [selectedSubPeriod, setSelectedSubPeriod] = useState(null);
  const [insumos, setInsumos] = useState([]);
  const [formData, setFormData] = useState({
    nombre: '',
    fechaInicio: '',
    fechaFin: '',
    calificacionMinima: 7.0,
    ponderacion: 50.0,
    activo: true,
    orden: 1,
  });
  const [subPeriodFormData, setSubPeriodFormData] = useState({
    nombre: '',
    ponderacion: 0,
    orden: 1,
    fechaInicio: '',
    fechaFin: '',
  });
  const [insumoFormData, setInsumoFormData] = useState({
    nombre: '',
    descripcion: '',
    activo: true,
    orden: 1,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await api.get('/periods');
      setPeriods(response.data.data || []);
    } catch (error) {
      console.error('Error al cargar períodos:', error);
      toast.error('Error al cargar períodos');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        nombre: formData.nombre,
        fechaInicio: formData.fechaInicio,
        fechaFin: formData.fechaFin,
        calificacionMinima: parseFloat(formData.calificacionMinima),
        ponderacion: parseFloat(formData.ponderacion),
        orden: parseInt(formData.orden),
        activo: formData.activo,
        // No enviar anioEscolar ni anioLectivoId, el backend lo obtendrá automáticamente
      };

      // Convertir fechas a formato ISO datetime si tienen valor
      if (data.fechaInicio) {
        const fechaInicio = new Date(data.fechaInicio);
        fechaInicio.setHours(0, 0, 0, 0);
        data.fechaInicio = fechaInicio.toISOString();
      }
      if (data.fechaFin) {
        const fechaFin = new Date(data.fechaFin);
        fechaFin.setHours(23, 59, 59, 999);
        data.fechaFin = fechaFin.toISOString();
      }

      if (editingPeriod) {
        await api.put(`/periods/${editingPeriod.id}`, data);
        toast.success('Período actualizado exitosamente');
      } else {
        await api.post('/periods', data);
        toast.success('Período creado exitosamente');
      }

      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error detallado:', error.response?.data);
      toast.error(error.response?.data?.error || 'Error al guardar período');
    }
  };

  const handleSubPeriodSubmit = async (e) => {
    e.preventDefault();
    try {
      // Preparar los datos según si es creación o actualización
      let data = {
        nombre: subPeriodFormData.nombre,
        ponderacion: parseFloat(subPeriodFormData.ponderacion),
        orden: parseInt(subPeriodFormData.orden),
      };

      // Solo agregar fechas si tienen valor (no vacías) y convertirlas a formato ISO
      if (subPeriodFormData.fechaInicio) {
        // Convertir fecha YYYY-MM-DD a ISO datetime
        const fechaInicio = new Date(subPeriodFormData.fechaInicio);
        fechaInicio.setHours(0, 0, 0, 0); // Asegurar que sea inicio del día
        data.fechaInicio = fechaInicio.toISOString();
      }
      if (subPeriodFormData.fechaFin) {
        // Convertir fecha YYYY-MM-DD a ISO datetime
        const fechaFin = new Date(subPeriodFormData.fechaFin);
        fechaFin.setHours(23, 59, 59, 999); // Asegurar que sea fin del día
        data.fechaFin = fechaFin.toISOString();
      }

      if (editingSubPeriod) {
        // Al actualizar, NO enviar periodoId
        await api.put(`/sub-periods/${editingSubPeriod.id}`, data);
        toast.success('Subperíodo actualizado exitosamente');
      } else {
        // Al crear, sí incluir periodoId
        data.periodoId = selectedPeriod.id;
        await api.post('/sub-periods', data);
        toast.success('Subperíodo creado exitosamente');
      }

      setShowSubPeriodModal(false);
      resetSubPeriodForm();
      fetchData();
    } catch (error) {
      console.error('Error al guardar subperíodo:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.details || 'Error al guardar subperíodo';
      toast.error(errorMessage);
    }
  };

  const handleEdit = (period) => {
    setEditingPeriod(period);
    setFormData({
      nombre: period.nombre || '',
      fechaInicio: period.fechaInicio ? new Date(period.fechaInicio).toISOString().split('T')[0] : '',
      fechaFin: period.fechaFin ? new Date(period.fechaFin).toISOString().split('T')[0] : '',
      calificacionMinima: period.calificacionMinima || 7.0,
      ponderacion: period.ponderacion || 50.0,
      activo: period.activo ?? true,
      orden: period.orden || 1,
    });
    setShowModal(true);
  };

  const handleEditSubPeriod = (subPeriod, period) => {
    setEditingSubPeriod(subPeriod);
    setSelectedPeriod(period);
    setSubPeriodFormData({
      nombre: subPeriod.nombre || '',
      ponderacion: subPeriod.ponderacion || 0,
      orden: subPeriod.orden || 1,
      fechaInicio: subPeriod.fechaInicio ? new Date(subPeriod.fechaInicio).toISOString().split('T')[0] : '',
      fechaFin: subPeriod.fechaFin ? new Date(subPeriod.fechaFin).toISOString().split('T')[0] : '',
    });
    setShowSubPeriodModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este período?')) {
      return;
    }

    try {
      await api.delete(`/periods/${id}`);
      toast.success('Período eliminado exitosamente');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al eliminar período');
    }
  };

  const handleDeleteSubPeriod = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este subperíodo?')) {
      return;
    }

    try {
      await api.delete(`/sub-periods/${id}`);
      toast.success('Subperíodo eliminado exitosamente');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al eliminar subperíodo');
    }
  };

  const handleSetActive = async (id) => {
    try {
      await api.put(`/periods/${id}/activate`);
      toast.success('Período activo actualizado exitosamente');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al activar período');
    }
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      fechaInicio: '',
      fechaFin: '',
      calificacionMinima: 7.0,
      ponderacion: 50.0,
      activo: true,
      orden: 1,
    });
    setEditingPeriod(null);
  };

  const resetSubPeriodForm = () => {
    setSubPeriodFormData({
      nombre: '',
      ponderacion: 0,
      orden: 1,
      fechaInicio: '',
      fechaFin: '',
    });
    setEditingSubPeriod(null);
    setSelectedPeriod(null);
  };

  const openSubPeriodModal = (period) => {
    // Resetear el formulario pero mantener el período seleccionado
    setSubPeriodFormData({
      nombre: '',
      ponderacion: 0,
      orden: (period.subPeriodos?.length || 0) + 1, // Orden automático basado en la cantidad existente
      fechaInicio: '',
      fechaFin: '',
    });
    setEditingSubPeriod(null);
    setSelectedPeriod(period); // Establecer el período después de resetear
    setShowSubPeriodModal(true);
  };

  const fetchInsumos = async (subPeriodoId) => {
    try {
      const response = await api.get(`/insumos?subPeriodoId=${subPeriodoId}`);
      const insumosList = response.data.data || [];
      setInsumos(insumosList);
      return insumosList;
    } catch (error) {
      console.error('Error al cargar insumos:', error);
      toast.error('Error al cargar insumos');
      return [];
    }
  };

  const openInsumoModal = async (subPeriod, period) => {
    setSelectedSubPeriod(subPeriod);
    setSelectedPeriod(period);
    const insumosData = await fetchInsumos(subPeriod.id);
    const insumosList = insumosData || [];
    setInsumoFormData({
      nombre: '',
      descripcion: '',
      activo: true,
      orden: (insumosList.length || 0) + 1,
    });
    setEditingInsumo(null);
    setShowInsumoModal(true);
  };

  const handleInsumoSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSubPeriod) return;

    try {
      const data = {
        subPeriodoId: selectedSubPeriod.id,
        nombre: insumoFormData.nombre.trim(),
        descripcion: insumoFormData.descripcion.trim() || null,
        activo: insumoFormData.activo,
        orden: parseInt(insumoFormData.orden) || undefined,
      };

      if (editingInsumo && editingInsumo.id !== 'new') {
        await api.put(`/insumos/${editingInsumo.id}`, data);
        toast.success('Insumo actualizado exitosamente');
      } else {
        await api.post('/insumos', data);
        toast.success('Insumo creado exitosamente');
      }

      setShowInsumoModal(false);
      resetInsumoForm();
      await fetchInsumos(selectedSubPeriod.id);
      fetchData(); // Refrescar períodos para actualizar la vista
    } catch (error) {
      console.error('Error al guardar insumo:', error);
      toast.error(error.response?.data?.error || 'Error al guardar insumo');
    }
  };

  const handleEditInsumo = (insumo) => {
    setEditingInsumo(insumo);
    setInsumoFormData({
      nombre: insumo.nombre || '',
      descripcion: insumo.descripcion || '',
      activo: insumo.activo ?? true,
      orden: insumo.orden || 1,
    });
  };

  const handleDeleteInsumo = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este insumo?')) {
      return;
    }

    try {
      await api.delete(`/insumos/${id}`);
      toast.success('Insumo eliminado exitosamente');
      await fetchInsumos(selectedSubPeriod.id);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al eliminar insumo');
    }
  };

  const resetInsumoForm = () => {
    setInsumoFormData({
      nombre: '',
      descripcion: '',
      activo: true,
      orden: 1,
    });
    setEditingInsumo(null);
    setSelectedSubPeriod(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        <span className="ml-4 text-gray-600">Cargando períodos...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Gestión de Períodos Académicos</h1>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
        >
          Nuevo Período
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Año Escolar</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fechas</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Calif. Mín.</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ponderación</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subperíodos</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {periods.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-6 py-4 text-center text-gray-500">
                  No hay períodos registrados
                </td>
              </tr>
            ) : (
              periods.map((period) => {
                const sumaPonderacionSub = period.subPeriodos?.reduce((sum, sp) => sum + sp.ponderacion, 0) || 0;
                return (
                  <React.Fragment key={period.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-medium">{period.anioEscolar || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{period.nombre}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(period.fechaInicio).toLocaleDateString('es-ES')} - {new Date(period.fechaFin).toLocaleDateString('es-ES')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{period.calificacionMinima || 7.0}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{period.ponderacion || 0}%</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => openSubPeriodModal(period)}
                          className="text-primary-600 hover:text-primary-900 text-sm"
                        >
                          {period.subPeriodos?.length || 0} subperíodos
                          {sumaPonderacionSub !== 100 && sumaPonderacionSub > 0 && (
                            <span className="ml-1 text-red-500" title={`Suma: ${sumaPonderacionSub.toFixed(2)}%`}>⚠</span>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {period.activo ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Activo</span>
                        ) : (
                          <button
                            onClick={() => handleSetActive(period.id)}
                            className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 hover:bg-gray-200"
                          >
                            Activar
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleEdit(period)}
                          className="text-primary-600 hover:text-primary-900 mr-4"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(period.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                    <tr key={`${period.id}-subperiods`} className="bg-gray-50">
                      <td colSpan="8" className="px-6 py-3">
                        <div className="ml-8">
                          <div className="flex justify-between items-center mb-2">
                            <h4 className="text-sm font-semibold">Subperíodos:</h4>
                            <button
                              onClick={() => openSubPeriodModal(period)}
                              className="text-xs bg-primary-600 text-white px-3 py-1 rounded hover:bg-primary-700"
                            >
                              + Agregar Subperíodo
                            </button>
                          </div>
                          {period.subPeriodos && period.subPeriodos.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              {period.subPeriodos.map((sp) => (
                                <div key={sp.id} className="bg-white p-2 rounded border text-sm">
                                  <div className="font-medium">{sp.nombre}</div>
                                  <div className="text-xs text-gray-500">Ponderación: {sp.ponderacion}%</div>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    <button
                                      onClick={() => handleEditSubPeriod(sp, period)}
                                      className="text-xs text-primary-600 hover:text-primary-900"
                                    >
                                      Editar
                                    </button>
                                    <button
                                      onClick={() => openInsumoModal(sp, period)}
                                      className="text-xs text-blue-600 hover:text-blue-900"
                                    >
                                      Insumos
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSubPeriod(sp.id)}
                                      className="text-xs text-red-600 hover:text-red-900"
                                    >
                                      Eliminar
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">No hay subperíodos configurados</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Período */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingPeriod ? 'Editar Período' : 'Nuevo Período'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Ej: Primer Quimestre"
                />
                <p className="mt-1 text-xs text-gray-500">
                  El período se asociará automáticamente al año escolar activo
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Fecha Inicio <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.fechaInicio}
                    onChange={(e) => setFormData({ ...formData, fechaInicio: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Fecha Fin <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.fechaFin}
                    onChange={(e) => setFormData({ ...formData, fechaFin: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Calificación Mínima <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="10"
                    step="0.01"
                    value={formData.calificacionMinima}
                    onChange={(e) => setFormData({ ...formData, calificacionMinima: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Ponderación (%) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.ponderacion}
                    onChange={(e) => setFormData({ ...formData, ponderacion: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Orden
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.orden}
                    onChange={(e) => setFormData({ ...formData, orden: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Período activo</span>
                </label>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                >
                  {editingPeriod ? 'Actualizar' : 'Crear Período'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Subperíodo */}
      {showSubPeriodModal && selectedPeriod && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingSubPeriod ? 'Editar Subperíodo' : 'Nuevo Subperíodo'}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Período: <strong>{selectedPeriod.nombre}</strong>
            </p>
            <form onSubmit={handleSubPeriodSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={subPeriodFormData.nombre}
                  onChange={(e) => setSubPeriodFormData({ ...subPeriodFormData, nombre: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Ej: Primer Parcial"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Ponderación (%) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    step="0.01"
                    value={subPeriodFormData.ponderacion}
                    onChange={(e) => setSubPeriodFormData({ ...subPeriodFormData, ponderacion: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Suma actual: {selectedPeriod.subPeriodos?.reduce((sum, sp) => sum + (sp.id === editingSubPeriod?.id ? 0 : sp.ponderacion), 0).toFixed(2) || 0}%
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Orden <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={subPeriodFormData.orden}
                    onChange={(e) => setSubPeriodFormData({ ...subPeriodFormData, orden: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Fecha Inicio</label>
                  <input
                    type="date"
                    value={subPeriodFormData.fechaInicio}
                    onChange={(e) => setSubPeriodFormData({ ...subPeriodFormData, fechaInicio: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Fecha Fin</label>
                  <input
                    type="date"
                    value={subPeriodFormData.fechaFin}
                    onChange={(e) => setSubPeriodFormData({ ...subPeriodFormData, fechaFin: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowSubPeriodModal(false);
                    resetSubPeriodForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                >
                  {editingSubPeriod ? 'Actualizar' : 'Crear Subperíodo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Insumos */}
      {showInsumoModal && selectedSubPeriod && selectedPeriod && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              Gestión de Insumos
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Subperíodo: <strong>{selectedSubPeriod.nombre}</strong> - Período: <strong>{selectedPeriod.nombre}</strong>
            </p>

            {/* Lista de Insumos */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold">Insumos</h3>
                <button
                  onClick={() => {
                    resetInsumoForm();
                    setEditingInsumo({ id: 'new' }); // Usar un objeto temporal para mostrar el formulario
                  }}
                  className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                >
                  + Nuevo Insumo
                </button>
              </div>
              {insumos.length === 0 ? (
                <p className="text-sm text-gray-500">No hay insumos configurados</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {insumos.map((insumo) => (
                    <div key={insumo.id} className="bg-gray-50 p-3 rounded border text-sm">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium">{insumo.nombre}</div>
                          {insumo.descripcion && (
                            <div className="text-xs text-gray-500 mt-1">{insumo.descripcion}</div>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded ${insumo.activo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                              {insumo.activo ? 'Activo' : 'Inactivo'}
                            </span>
                            {insumo.orden && (
                              <span className="text-xs text-gray-500">Orden: {insumo.orden}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <button
                            onClick={() => handleEditInsumo(insumo)}
                            className="text-xs text-primary-600 hover:text-primary-900"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeleteInsumo(insumo.id)}
                            className="text-xs text-red-600 hover:text-red-900"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Formulario de Insumo */}
            {editingInsumo && (
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-4">
                  {editingInsumo.id === 'new' ? 'Nuevo Insumo' : 'Editar Insumo'}
                </h3>
                <form onSubmit={handleInsumoSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Nombre <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={insumoFormData.nombre}
                      onChange={(e) => setInsumoFormData({ ...insumoFormData, nombre: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      placeholder="Ej: Tarea, Examen, Proyecto"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Descripción
                    </label>
                    <textarea
                      value={insumoFormData.descripcion}
                      onChange={(e) => setInsumoFormData({ ...insumoFormData, descripcion: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      rows="3"
                      placeholder="Descripción del insumo (opcional)"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Orden
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={insumoFormData.orden}
                        onChange={(e) => setInsumoFormData({ ...insumoFormData, orden: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={insumoFormData.activo}
                          onChange={(e) => setInsumoFormData({ ...insumoFormData, activo: e.target.checked })}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">Activo</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        resetInsumoForm();
                        setEditingInsumo(null);
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      {editingInsumo?.id === 'new' ? 'Ocultar' : 'Cancelar'}
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                    >
                      {editingInsumo?.id === 'new' ? 'Crear Insumo' : 'Actualizar'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="flex justify-end mt-4 pt-4 border-t">
              <button
                onClick={() => {
                  setShowInsumoModal(false);
                  resetInsumoForm();
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Periods;

