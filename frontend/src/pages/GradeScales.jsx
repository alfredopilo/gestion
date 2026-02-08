import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

const GradeScales = () => {
  const { user, selectedInstitutionId } = useAuth();
  const [gradeScales, setGradeScales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingScale, setEditingScale] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    detalles: [],
  });
  const [generatorData, setGeneratorData] = useState({
    valorMinimo: 0,
    valorMaximo: 10,
    incremento: 0.1,
  });
  const fileInputRef = useRef(null);
  const [expandedScaleId, setExpandedScaleId] = useState(null);

  useEffect(() => {
    fetchGradeScales();
  }, [selectedInstitutionId]);

  const fetchGradeScales = async () => {
    try {
      setLoading(true);
      // Cerrar cualquier tarjeta expandida al recargar
      setExpandedScaleId(null);
      const response = await api.get('/grade-scales');
      setGradeScales(response.data.data || []);
    } catch (error) {
      console.error('Error al cargar escalas:', error);
      toast.error('Error al cargar escalas de calificación');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (scale = null) => {
    if (scale) {
      setEditingScale(scale);
      setFormData({
        nombre: scale.nombre,
        detalles: scale.detalles.map(d => ({ titulo: d.titulo, valor: d.valor, orden: d.orden })),
      });
    } else {
      setEditingScale(null);
      setFormData({
        nombre: '',
        detalles: [],
      });
    }
    setGeneratorData({
      valorMinimo: 0,
      valorMaximo: 10,
      incremento: 0.1,
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingScale(null);
    setFormData({
      nombre: '',
      detalles: [],
    });
  };

  const generateValues = () => {
    const { valorMinimo, valorMaximo, incremento } = generatorData;
    
    if (valorMinimo >= valorMaximo) {
      toast.error('El valor mínimo debe ser menor que el valor máximo');
      return;
    }

    if (incremento <= 0) {
      toast.error('El incremento debe ser mayor que 0');
      return;
    }

    const detalles = [];
    let valor = parseFloat(valorMinimo);
    let orden = 0;

    while (valor <= valorMaximo) {
      detalles.push({
        titulo: valor.toFixed(incremento === 0.01 ? 2 : 1),
        valor: parseFloat(valor.toFixed(incremento === 0.01 ? 2 : 1)),
        orden: orden++,
      });
      valor += incremento;
      // Evitar problemas de precisión de punto flotante
      valor = parseFloat(valor.toFixed(incremento === 0.01 ? 2 : 1));
    }

    setFormData({
      ...formData,
      detalles,
    });
    toast.success(`${detalles.length} valores generados exitosamente`);
  };

  const handleAddDetail = () => {
    setFormData({
      ...formData,
      detalles: [
        ...formData.detalles,
        {
          titulo: '',
          valor: 0,
          orden: formData.detalles.length,
        },
      ],
    });
  };

  const handleRemoveDetail = (index) => {
    const newDetalles = formData.detalles.filter((_, i) => i !== index);
    // Reordenar
    newDetalles.forEach((detalle, i) => {
      detalle.orden = i;
    });
    setFormData({
      ...formData,
      detalles: newDetalles,
    });
  };

  const handleDetailChange = (index, field, value) => {
    const newDetalles = [...formData.detalles];
    newDetalles[index] = {
      ...newDetalles[index],
      [field]: field === 'valor' ? parseFloat(value) || 0 : value,
    };
    setFormData({
      ...formData,
      detalles: newDetalles,
    });
  };

  const handleMoveDetail = (index, direction) => {
    const newDetalles = [...formData.detalles];
    if (direction === 'up' && index > 0) {
      [newDetalles[index - 1], newDetalles[index]] = [newDetalles[index], newDetalles[index - 1]];
      newDetalles[index - 1].orden = index - 1;
      newDetalles[index].orden = index;
    } else if (direction === 'down' && index < newDetalles.length - 1) {
      [newDetalles[index], newDetalles[index + 1]] = [newDetalles[index + 1], newDetalles[index]];
      newDetalles[index].orden = index;
      newDetalles[index + 1].orden = index + 1;
    }
    setFormData({
      ...formData,
      detalles: newDetalles,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.nombre.trim()) {
      toast.error('El nombre de la escala es requerido');
      return;
    }

    if (formData.detalles.length === 0) {
      toast.error('Debe agregar al menos un detalle a la escala');
      return;
    }

    try {
      if (editingScale) {
        await api.put(`/grade-scales/${editingScale.id}`, formData);
        toast.success('Escala actualizada exitosamente');
      } else {
        await api.post('/grade-scales', formData);
        toast.success('Escala creada exitosamente');
      }
      handleCloseModal();
      fetchGradeScales();
    } catch (error) {
      console.error('Error al guardar escala:', error);
      toast.error(error.response?.data?.error || 'Error al guardar escala');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar esta escala de calificación?')) {
      return;
    }

    try {
      await api.delete(`/grade-scales/${id}`);
      toast.success('Escala eliminada exitosamente');
      fetchGradeScales();
    } catch (error) {
      console.error('Error al eliminar escala:', error);
      toast.error(error.response?.data?.error || 'Error al eliminar escala');
    }
  };

  const downloadTemplate = () => {
    const headers = ['Título', 'Valor'];
    const exampleData = [
      ['Excelente', '10'],
      ['Muy Bueno', '8.5'],
      ['Bueno', '7'],
      ['Regular', '5'],
      ['Insuficiente', '3'],
    ];
    const data = [headers, ...exampleData];
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    worksheet['!cols'] = [{ wch: 20 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Detalles');
    XLSX.writeFile(workbook, 'plantilla_importacion_detalles_escala.xlsx');
    toast.success('Plantilla descargada');
  };

  const handleFileImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (fileExtension !== 'xlsx' && fileExtension !== 'xls') {
      toast.error('Formato no soportado. Use un archivo Excel (.xlsx o .xls).');
      event.target.value = '';
      return;
    }

    try {
      let detalles = [];
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      const startIndex = data[0] && (data[0][0]?.toString().toLowerCase().includes('título') || data[0][0]?.toString().toLowerCase().includes('titulo')) ? 1 : 0;

      for (let i = startIndex; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length < 2) continue;

        const titulo = row[0]?.toString().trim();
        const valor = parseFloat(row[1]);

        if (titulo && !isNaN(valor)) {
          detalles.push({
            titulo,
            valor,
            orden: detalles.length,
          });
        }
      }

      if (detalles.length === 0) {
        toast.error('No se encontraron datos válidos en el archivo');
        return;
      }

      // Validar que no haya valores duplicados
      const valoresUnicos = new Set(detalles.map(d => d.valor));
      if (valoresUnicos.size !== detalles.length) {
        toast.error('Se encontraron valores duplicados. Se mantendrán todos los detalles.');
      }

      // Ordenar por valor
      detalles.sort((a, b) => a.valor - b.valor);
      detalles.forEach((detalle, index) => {
        detalle.orden = index;
      });

      // Agregar o reemplazar detalles
      const confirmReplace = formData.detalles.length > 0 
        ? window.confirm(`¿Desea reemplazar los ${formData.detalles.length} detalles existentes con los ${detalles.length} nuevos?`)
        : true;

      if (confirmReplace) {
        setFormData({
          ...formData,
          detalles,
        });
        toast.success(`${detalles.length} detalles importados exitosamente`);
      } else {
        // Agregar a los existentes
        const maxOrden = formData.detalles.length > 0 
          ? Math.max(...formData.detalles.map(d => d.orden)) + 1 
          : 0;
        detalles.forEach((detalle, index) => {
          detalle.orden = maxOrden + index;
        });
        setFormData({
          ...formData,
          detalles: [...formData.detalles, ...detalles],
        });
        toast.success(`${detalles.length} detalles agregados exitosamente`);
      }

      // Limpiar el input de archivo
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error al procesar archivo:', error);
      toast.error('Error al procesar el archivo. Verifique el formato.');
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Escalas de Calificación</h1>
          <p className="text-gray-600">Gestiona las escalas de calificación para evaluar a los estudiantes</p>
        </div>
        {(user?.rol === 'ADMIN' || user?.rol === 'SECRETARIA') && (
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva Escala
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-500">Cargando escalas...</p>
        </div>
      ) : gradeScales.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-lg shadow">
          <p className="text-gray-500">No hay escalas de calificación registradas</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {gradeScales.map((scale) => {
            const isExpanded = expandedScaleId === scale.id;
            return (
              <div 
                key={scale.id} 
                className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-200 hover:shadow-xl transition-shadow duration-200"
              >
                {/* Header de la tarjeta */}
                <div 
                  className="p-5 bg-gradient-to-r from-primary-500 to-primary-600 cursor-pointer"
                  onClick={() => {
                    // Si esta tarjeta ya está expandida, contraerla
                    if (isExpanded) {
                      setExpandedScaleId(null);
                    } else {
                      // Expandir solo esta tarjeta (esto automáticamente contrae cualquier otra)
                      setExpandedScaleId(scale.id);
                    }
                  }}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white mb-1">{scale.nombre}</h3>
                      <p className="text-primary-100 text-sm">
                        {scale.detalles.length} {scale.detalles.length === 1 ? 'valor' : 'valores'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {(user?.rol === 'ADMIN' || user?.rol === 'SECRETARIA') && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenModal(scale);
                            }}
                            className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg text-white transition-colors"
                            title="Editar"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(scale.id);
                            }}
                            className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg text-white transition-colors"
                            title="Eliminar"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Si esta tarjeta ya está expandida, contraerla
                          if (isExpanded) {
                            setExpandedScaleId(null);
                          } else {
                            // Expandir solo esta tarjeta (esto automáticamente contrae cualquier otra)
                            setExpandedScaleId(scale.id);
                          }
                        }}
                        className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg text-white transition-all"
                        title={isExpanded ? "Contraer" : "Expandir"}
                      >
                        <svg 
                          className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Contenido expandible */}
                {isExpanded && (
                  <div className="p-5 border-t border-gray-200">
                    <div className="mb-3">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Detalles de la Escala</h4>
                    </div>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {scale.detalles.length === 0 ? (
                        <p className="text-gray-500 text-sm text-center py-4">
                          No hay detalles en esta escala
                        </p>
                      ) : (
                        scale.detalles.map((detalle, idx) => (
                          <div 
                            key={detalle.id || idx} 
                            className="flex justify-between items-center p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg hover:from-gray-100 hover:to-gray-200 transition-colors border border-gray-200"
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                                {idx + 1}
                              </div>
                              <span className="font-medium text-gray-800 flex-1">{detalle.titulo}</span>
                            </div>
                            <div className="ml-4">
                              <span className="px-3 py-1 bg-primary-100 text-primary-800 font-bold rounded-lg text-sm">
                                {detalle.valor.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    {scale.detalles.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Rango:</span>
                          <span className="font-semibold text-gray-800">
                            {Math.min(...scale.detalles.map(d => d.valor)).toFixed(2)} - {Math.max(...scale.detalles.map(d => d.valor)).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">
                {editingScale ? 'Editar Escala' : 'Nueva Escala'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de la Escala <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                  placeholder="Ej: Escala 0-10"
                />
              </div>

              {/* Generador de valores */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Generar Valores</h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={downloadTemplate}
                      className="px-3 py-1 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Descargar Plantilla
                    </button>
                    <label className="px-3 py-1 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 flex items-center gap-1 cursor-pointer">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Importar Detalles
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                        onChange={handleFileImport}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Valor Mínimo
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={generatorData.valorMinimo}
                      onChange={(e) => setGeneratorData({ ...generatorData, valorMinimo: parseFloat(e.target.value) || 0 })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Valor Máximo
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={generatorData.valorMaximo}
                      onChange={(e) => setGeneratorData({ ...generatorData, valorMaximo: parseFloat(e.target.value) || 10 })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Incremento
                    </label>
                    <select
                      value={generatorData.incremento}
                      onChange={(e) => setGeneratorData({ ...generatorData, incremento: parseFloat(e.target.value) })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value={0.1}>0.1</option>
                      <option value={0.01}>0.01</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={generateValues}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      Generar Valores
                    </button>
                  </div>
                </div>
              </div>

              {/* Lista de detalles */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Detalles de la Escala
                  </label>
                  <button
                    type="button"
                    onClick={handleAddDetail}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                  >
                    Agregar Detalle
                  </button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-md p-2">
                  {formData.detalles.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">
                      No hay detalles. Use el generador de valores o agregue manualmente.
                    </p>
                  ) : (
                    formData.detalles.map((detalle, index) => (
                      <div key={index} className="flex gap-2 items-center p-2 bg-gray-50 rounded">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={detalle.titulo}
                            onChange={(e) => handleDetailChange(index, 'titulo', e.target.value)}
                            className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                            placeholder="Título"
                          />
                          <input
                            type="number"
                            step="0.01"
                            value={detalle.valor}
                            onChange={(e) => handleDetailChange(index, 'valor', e.target.value)}
                            className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                            placeholder="Valor"
                          />
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleMoveDetail(index, 'up')}
                            disabled={index === 0}
                            className="text-gray-600 hover:text-gray-800 disabled:text-gray-300"
                            title="Mover arriba"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveDetail(index, 'down')}
                            disabled={index === formData.detalles.length - 1}
                            className="text-gray-600 hover:text-gray-800 disabled:text-gray-300"
                            title="Mover abajo"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveDetail(index)}
                            className="text-red-600 hover:text-red-800"
                            title="Eliminar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                >
                  {editingScale ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GradeScales;

