import { useState, useEffect } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

const Subjects = () => {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    codigo: '',
    creditos: '',
    horas: '',
    cualitativa: false,
  });

  // Estados para importación
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState([]);
  const [importFileName, setImportFileName] = useState('');
  const [importSummary, setImportSummary] = useState(null);
  const [importError, setImportError] = useState('');
  const [importLoading, setImportLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await api.get('/subjects?limit=100');
      setSubjects(response.data.data || []);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        creditos: formData.creditos ? parseInt(formData.creditos) : undefined,
        horas: formData.horas ? parseInt(formData.horas) : undefined,
        cualitativa: !!formData.cualitativa,
      };

      if (editingSubject) {
        await api.put(`/subjects/${editingSubject.id}`, data);
        toast.success('Materia actualizada exitosamente');
      } else {
        await api.post('/subjects', data);
        toast.success('Materia creada exitosamente');
      }

      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al guardar materia');
    }
  };

  const handleEdit = (subject) => {
    setEditingSubject(subject);
    setFormData({
      nombre: subject.nombre || '',
      codigo: subject.codigo || '',
      creditos: subject.creditos?.toString() || '',
      horas: subject.horas?.toString() || '',
      cualitativa: subject.cualitativa ?? false,
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar esta materia?')) {
      return;
    }

    try {
      await api.delete(`/subjects/${id}`);
      toast.success('Materia eliminada exitosamente');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al eliminar materia');
    }
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      codigo: '',
      creditos: '',
      horas: '',
      cualitativa: false,
    });
    setEditingSubject(null);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  // Funciones para importación
  const resetImportState = () => {
    setImportPreview([]);
    setImportFileName('');
    setImportSummary(null);
    setImportError('');
    setImportLoading(false);
  };

  const handleOpenImportModal = () => {
    resetImportState();
    setShowImportModal(true);
  };

  const handleCloseImportModal = () => {
    resetImportState();
    setShowImportModal(false);
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/subjects/import-template', {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'plantilla_importacion_materias.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Plantilla descargada exitosamente');
    } catch (error) {
      console.error('Error al descargar plantilla:', error);
      toast.error('Error al descargar la plantilla');
    }
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setImportError('');
    try {
      // Leer el archivo Excel
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      
      // Obtener la primera hoja
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convertir la hoja a JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      if (jsonData.length < 2) {
        throw new Error('El archivo debe incluir encabezados y al menos una fila de datos.');
      }

      const headerMap = {
        nombre: 'nombre',
        codigo: 'codigo',
        creditos: 'creditos',
        horas: 'horas',
      };

      // Procesar headers
      const rawHeaders = jsonData[0].map(header => String(header).trim());
      const headers = rawHeaders.map(header => headerMap[header.toLowerCase()] ?? header);

      const requiredHeaders = ['nombre', 'codigo'];
      const missingHeaders = requiredHeaders.filter(required => !headers.includes(required));
      if (missingHeaders.length > 0) {
        throw new Error(`Faltan las columnas obligatorias: ${missingHeaders.join(', ')}`);
      }

      // Procesar filas de datos
      const parsedSubjects = [];
      for (let rowIndex = 1; rowIndex < jsonData.length; rowIndex += 1) {
        const row = jsonData[rowIndex];
        
        // Saltar filas vacías
        if (!row || row.every(cell => !cell || String(cell).trim() === '')) {
          continue;
        }

        const record = {};
        headers.forEach((header, columnIndex) => {
          if (!header) return;
          const value = row[columnIndex] !== undefined && row[columnIndex] !== null 
            ? String(row[columnIndex]).trim() 
            : '';
          if (value !== '') {
            record[header] = value;
          }
        });

        if (Object.keys(record).length > 0 && record.nombre && record.codigo) {
          parsedSubjects.push(record);
        }
      }

      if (parsedSubjects.length === 0) {
        throw new Error('No se encontraron registros válidos en el archivo.');
      }

      setImportPreview(parsedSubjects);
      setImportFileName(file.name);
      setImportSummary(null);
    } catch (error) {
      console.error('Error al procesar el archivo Excel:', error);
      setImportPreview([]);
      setImportFileName('');
      setImportSummary(null);
      setImportError(error.message || 'No se pudo procesar el archivo. Verifica el formato.');
    } finally {
      event.target.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (importPreview.length === 0) {
      toast.error('No hay datos para importar');
      return;
    }

    setImportLoading(true);
    setImportError('');

    try {
      // Crear un nuevo archivo Excel con los datos del preview
      const workbook = XLSX.utils.book_new();
      const headers = ['nombre', 'codigo', 'creditos', 'horas'];
      const data = [headers, ...importPreview.map(item => [
        item.nombre,
        item.codigo,
        item.creditos || '',
        item.horas || '',
      ])];
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Materias');
      
      // Convertir a blob
      const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      // Crear FormData
      const formData = new FormData();
      formData.append('file', blob, 'materias.xlsx');

      // Enviar al backend
      const response = await api.post('/subjects/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setImportSummary(response.data);
      setImportPreview([]);
      
      if (response.data.resumen.errores === 0) {
        toast.success('Importación completada exitosamente');
        fetchData(); // Refrescar la lista de materias
      } else {
        toast.success(`Importación completada con ${response.data.resumen.errores} error(es)`);
      }
    } catch (error) {
      console.error('Error al importar materias:', error);
      setImportError(error.response?.data?.error || 'Error al importar las materias');
      toast.error('Error al importar las materias');
    } finally {
      setImportLoading(false);
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Materias</h1>
        <div className="flex gap-2">
          <button
            onClick={handleDownloadTemplate}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Descargar Plantilla
          </button>
          <button
            onClick={handleOpenImportModal}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Importar Materias
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
          >
            Nueva Materia
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Nombre
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Código
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Asignaciones
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Créditos
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Horas
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Cualitativa
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {subjects.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-6 py-4 text-center text-gray-500">
                  No hay materias registradas
                </td>
              </tr>
            ) : (
              subjects.map((subject) => (
                <tr key={subject.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium">{subject.nombre}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{subject.codigo}</td>
                  <td className="px-6 py-4">
                    {subject.asignaciones && subject.asignaciones.length > 0 ? (
                      <div className="text-sm">
                        {subject.asignaciones.length} asignación(es)
                      </div>
                    ) : (
                      <span className="text-gray-400">Sin asignar</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{subject.creditos || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{subject.horas || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {subject.cualitativa ? 'Sí' : 'No'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleEdit(subject)}
                      className="text-primary-600 hover:text-primary-900 mr-4"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(subject.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingSubject ? 'Editar Materia' : 'Nueva Materia'}
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
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Código <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Créditos</label>
                <input
                  type="number"
                  min="1"
                  value={formData.creditos}
                  onChange={(e) => setFormData({ ...formData, creditos: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Horas</label>
                <input
                  type="number"
                  min="1"
                  value={formData.horas}
                  onChange={(e) => setFormData({ ...formData, horas: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="cualitativa"
                  checked={!!formData.cualitativa}
                  onChange={(e) => setFormData({ ...formData, cualitativa: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="cualitativa" className="ml-2 block text-sm text-gray-700">
                  Cualitativa
                </label>
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
                  {editingSubject ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Importación */}
      {showImportModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Importar Materias desde Excel</h2>
            
            {/* Sección de carga de archivo */}
            {!importSummary && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <label className="flex flex-col items-center cursor-pointer">
                    <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-sm text-gray-600">Haz clic para seleccionar un archivo Excel</span>
                    <span className="text-xs text-gray-500 mt-1">(.xlsx)</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleImportFile}
                      className="hidden"
                    />
                  </label>
                  {importFileName && (
                    <p className="mt-2 text-sm text-green-600 text-center">
                      Archivo seleccionado: {importFileName}
                    </p>
                  )}
                </div>

                {importError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {importError}
                  </div>
                )}

                {/* Preview de datos */}
                {importPreview.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Vista Previa ({importPreview.length} materias)</h3>
                    <div className="border rounded-lg overflow-hidden">
                      <div className="max-h-96 overflow-y-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Créditos</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Horas</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {importPreview.map((subject, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-sm">{index + 1}</td>
                                <td className="px-4 py-2 text-sm">{subject.nombre}</td>
                                <td className="px-4 py-2 text-sm">{subject.codigo}</td>
                                <td className="px-4 py-2 text-sm">{subject.creditos || '-'}</td>
                                <td className="px-4 py-2 text-sm">{subject.horas || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Resultados de la importación */}
            {importSummary && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-800 mb-2">Resumen de Importación</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Procesados</p>
                      <p className="text-xl font-bold text-gray-900">{importSummary.resumen.procesados}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Creados</p>
                      <p className="text-xl font-bold text-green-600">{importSummary.resumen.creados}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Actualizados</p>
                      <p className="text-xl font-bold text-blue-600">{importSummary.resumen.actualizados}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Errores</p>
                      <p className="text-xl font-bold text-red-600">{importSummary.resumen.errores}</p>
                    </div>
                  </div>
                </div>

                {/* Lista de errores */}
                {importSummary.errores && importSummary.errores.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h3 className="font-semibold text-red-800 mb-2">Errores Encontrados</h3>
                    <div className="max-h-64 overflow-y-auto">
                      <ul className="space-y-2">
                        {importSummary.errores.map((error, index) => (
                          <li key={index} className="text-sm text-red-700">
                            <span className="font-semibold">Fila {error.fila}:</span> {error.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Botones */}
            <div className="flex justify-end space-x-3 pt-4 border-t mt-4">
              <button
                type="button"
                onClick={handleCloseImportModal}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                {importSummary ? 'Cerrar' : 'Cancelar'}
              </button>
              {!importSummary && importPreview.length > 0 && (
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={importLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {importLoading && (
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {importLoading ? 'Importando...' : 'Confirmar Importación'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Subjects;

