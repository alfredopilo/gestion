import { useState, useEffect, useRef } from 'react';
import React from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';

const Periods = () => {
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSubPeriodModal, setShowSubPeriodModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState(null);
  const [editingSubPeriod, setEditingSubPeriod] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    fechaInicio: '',
    fechaFin: '',
    calificacionMinima: 7.0,
    ponderacion: 50.0,
    activo: true,
    esSupletorio: false,
    orden: 1,
  });
  const [subPeriodFormData, setSubPeriodFormData] = useState({
    nombre: '',
    ponderacion: 0,
    orden: 1,
    fechaInicio: '',
    fechaFin: '',
  });
  const fileInputRef = useRef(null);

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
        esSupletorio: formData.esSupletorio,
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
      esSupletorio: period.esSupletorio ?? false,
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

  const handleExportPeriod = async (periodId, periodName) => {
    try {
      const response = await api.get(`/periods/${periodId}/export`);
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = (periodName || 'periodo').replace(/[^a-zA-Z0-9]/g, '-');
      link.download = `periodo-${safeName}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Período exportado exitosamente');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al exportar período');
    }
  };

  const handleExportConfiguration = async () => {
    try {
      const response = await api.get('/periods/export-config');
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `configuracion-periodos-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Configuración exportada exitosamente');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al exportar configuración');
    }
  };

  const handleImportPeriod = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast.error('Por favor selecciona un archivo JSON');
      return;
    }

    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);

      const hasSinglePeriod = jsonData.version && jsonData.period;
      const hasMultiplePeriods = jsonData.version && Array.isArray(jsonData.periods) && jsonData.periods.length > 0;
      if (!hasSinglePeriod && !hasMultiplePeriods) {
        toast.error('El archivo no tiene la estructura esperada de importación');
        return;
      }

      const res = await api.post('/periods/import', jsonData);
      toast.success(res.data?.message || 'Período(s) importado(s) exitosamente');
      fetchData();
    } catch (error) {
      if (error instanceof SyntaxError) {
        toast.error('El archivo no contiene JSON válido');
        return;
      }
      const msg = error.response?.data?.error || 'Error al importar período';
      const details = error.response?.data?.details;
      toast.error(details ? `${msg}: ${JSON.stringify(details)}` : msg);
    } finally {
      e.target.value = '';
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
      esSupletorio: false,
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
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={handleExportConfiguration}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
          >
            Exportar Configuración
          </button>
          <button
            onClick={handleImportPeriod}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Importar Período
          </button>
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
                        <div className="flex flex-col gap-1">
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
                          {period.esSupletorio && (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">Supletorio</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleExportPeriod(period.id, period.nombre)}
                          className="text-green-600 hover:text-green-900 mr-4"
                        >
                          Exportar
                        </button>
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
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.esSupletorio}
                    onChange={(e) => setFormData({ ...formData, esSupletorio: e.target.checked })}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Es Supletorio</span>
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

    </div>
  );
};

export default Periods;

