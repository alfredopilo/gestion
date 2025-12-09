import { useState, useEffect } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

const AssociateStudents = () => {
  const [students, setStudents] = useState([]);
  const [representantes, setRepresentantes] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedRepresentante, setSelectedRepresentante] = useState(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [representanteSearch, setRepresentanteSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [associating, setAssociating] = useState(false);
  
  // Estados para carga masiva
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkPreview, setBulkPreview] = useState([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkResults, setBulkResults] = useState(null);

  useEffect(() => {
    if (studentSearch.length >= 2) {
      const timeoutId = setTimeout(() => {
        searchStudents();
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setStudents([]);
    }
  }, [studentSearch]);

  useEffect(() => {
    if (representanteSearch.length >= 2) {
      const timeoutId = setTimeout(() => {
        searchRepresentantes();
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setRepresentantes([]);
    }
  }, [representanteSearch]);

  const searchStudents = async () => {
    try {
      setLoading(true);
      const response = await api.get('/representantes/search-students', {
        params: { query: studentSearch },
      });
      setStudents(response.data.data || []);
    } catch (error) {
      console.error('Error al buscar estudiantes:', error);
      toast.error('Error al buscar estudiantes');
    } finally {
      setLoading(false);
    }
  };

  const searchRepresentantes = async () => {
    try {
      setLoading(true);
      const response = await api.get('/representantes/search-representantes', {
        params: { query: representanteSearch },
      });
      setRepresentantes(response.data.data || []);
    } catch (error) {
      console.error('Error al buscar representantes:', error);
      toast.error('Error al buscar representantes');
    } finally {
      setLoading(false);
    }
  };

  const handleAssociate = async () => {
    if (!selectedStudent || !selectedRepresentante) {
      toast.error('Debe seleccionar un estudiante y un representante');
      return;
    }

    try {
      setAssociating(true);
      await api.post(`/representantes/students/${selectedStudent.id}/associate`, {
        representanteId: selectedRepresentante.id,
      });
      toast.success(
        `Estudiante ${selectedStudent.user.nombre} ${selectedStudent.user.apellido} asociado exitosamente con ${selectedRepresentante.user.nombre} ${selectedRepresentante.user.apellido}`
      );
      // Limpiar selecciones
      setSelectedStudent(null);
      setSelectedRepresentante(null);
      setStudentSearch('');
      setRepresentanteSearch('');
      setStudents([]);
      setRepresentantes([]);
    } catch (error) {
      console.error('Error al asociar:', error);
      toast.error(error.response?.data?.error || 'Error al asociar estudiante con representante');
    } finally {
      setAssociating(false);
    }
  };

  const handleDisassociate = async (studentId) => {
    if (!window.confirm('¿Está seguro de desasociar este estudiante del representante?')) {
      return;
    }

    try {
      await api.delete(`/representantes/students/${studentId}/associate`);
      toast.success('Estudiante desasociado exitosamente');
      // Refrescar búsqueda si el estudiante seleccionado fue desasociado
      if (selectedStudent?.id === studentId) {
        setSelectedStudent(null);
        setStudentSearch('');
        setStudents([]);
      }
    } catch (error) {
      console.error('Error al desasociar:', error);
      toast.error(error.response?.data?.error || 'Error al desasociar estudiante');
    }
  };

  // Funciones para carga masiva
  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/representantes/bulk-template', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'plantilla_asociaciones.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Plantilla descargada exitosamente');
    } catch (error) {
      console.error('Error al descargar plantilla:', error);
      toast.error('Error al descargar la plantilla');
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setBulkFile(file);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        // Transformar los datos para que coincidan con el formato esperado
        const formattedData = jsonData.map((row, index) => ({
          linea: index + 2,
          cedulaEstudiante: row.cedula_estudiante || row.cedulaEstudiante || '',
          cedulaRepresentante: row.cedula_representante || row.cedulaRepresentante || '',
        }));
        
        setBulkPreview(formattedData);
        setBulkResults(null);
      } catch (error) {
        console.error('Error al leer archivo:', error);
        toast.error('Error al procesar el archivo Excel');
        setBulkPreview([]);
      }
    };
    
    reader.readAsArrayBuffer(file);
  };

  const handleBulkProcess = async () => {
    if (bulkPreview.length === 0) {
      toast.error('No hay datos para procesar');
      return;
    }

    setBulkProcessing(true);
    try {
      const response = await api.post('/representantes/bulk-associate', {
        asociaciones: bulkPreview.map(item => ({
          cedulaEstudiante: item.cedulaEstudiante,
          cedulaRepresentante: item.cedulaRepresentante,
        })),
      });
      
      setBulkResults(response.data);
      toast.success(
        `Procesamiento completado: ${response.data.resumen.exitosos} exitosos, ${response.data.resumen.errores} errores`
      );
    } catch (error) {
      console.error('Error al procesar carga masiva:', error);
      toast.error(error.response?.data?.error || 'Error al procesar la carga masiva');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleCloseBulkModal = () => {
    setShowBulkModal(false);
    setBulkFile(null);
    setBulkPreview([]);
    setBulkResults(null);
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Asociar Padres con Estudiantes</h1>
            <p className="mt-2 text-gray-600">
              Busque y asocie estudiantes con sus representantes (padres)
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Descargar Plantilla
            </button>
            <button
              onClick={() => setShowBulkModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Carga Masiva
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Búsqueda de Estudiantes */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Buscar Estudiante</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre, apellido, cédula o email
            </label>
            <input
              type="text"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Buscar estudiante..."
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {loading && students.length === 0 && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          )}

          {students.length > 0 && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {students.map((student) => (
                <div
                  key={student.id}
                  onClick={() => setSelectedStudent(student)}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedStudent?.id === student.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">
                        {student.user.nombre} {student.user.apellido}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {student.user.numeroIdentificacion}
                      </p>
                      {student.grupo && (
                        <p className="text-sm text-gray-500">{student.grupo.nombre}</p>
                      )}
                      {student.representante && (
                        <p className="text-sm text-blue-600 mt-1">
                          Representante: {student.representante.user.nombre}{' '}
                          {student.representante.user.apellido}
                        </p>
                      )}
                    </div>
                    {selectedStudent?.id === student.id && (
                      <svg
                        className="w-5 h-5 text-blue-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {studentSearch.length >= 2 && !loading && students.length === 0 && (
            <p className="text-gray-500 text-center py-4">No se encontraron estudiantes</p>
          )}
        </div>

        {/* Búsqueda de Representantes */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Buscar Representante</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre, apellido, cédula o email
            </label>
            <input
              type="text"
              value={representanteSearch}
              onChange={(e) => setRepresentanteSearch(e.target.value)}
              placeholder="Buscar representante..."
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {loading && representantes.length === 0 && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          )}

          {representantes.length > 0 && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {representantes.map((representante) => (
                <div
                  key={representante.id}
                  onClick={() => setSelectedRepresentante(representante)}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedRepresentante?.id === representante.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">
                        {representante.user.nombre} {representante.user.apellido}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {representante.user.numeroIdentificacion}
                      </p>
                      {representante.user.email && (
                        <p className="text-sm text-gray-500">{representante.user.email}</p>
                      )}
                      {representante.students.length > 0 && (
                        <p className="text-sm text-gray-500 mt-1">
                          {representante.students.length} estudiante(s) asociado(s)
                        </p>
                      )}
                    </div>
                    {selectedRepresentante?.id === representante.id && (
                      <svg
                        className="w-5 h-5 text-blue-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {representanteSearch.length >= 2 && !loading && representantes.length === 0 && (
            <p className="text-gray-500 text-center py-4">No se encontraron representantes</p>
          )}
        </div>
      </div>

      {/* Resumen de Selección y Botón de Asociar */}
      {(selectedStudent || selectedRepresentante) && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Resumen de Asociación</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Estudiante Seleccionado</h3>
              {selectedStudent ? (
                <div>
                  <p className="font-semibold">
                    {selectedStudent.user.nombre} {selectedStudent.user.apellido}
                  </p>
                  <p className="text-sm text-gray-600">
                    {selectedStudent.user.numeroIdentificacion}
                  </p>
                  {selectedStudent.representante && (
                    <div className="mt-2">
                      <p className="text-sm text-orange-600">
                        Ya tiene representante: {selectedStudent.representante.user.nombre}{' '}
                        {selectedStudent.representante.user.apellido}
                      </p>
                      <button
                        onClick={() => handleDisassociate(selectedStudent.id)}
                        className="mt-2 text-sm text-red-600 hover:text-red-800"
                      >
                        Desasociar
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-400">No seleccionado</p>
              )}
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Representante Seleccionado</h3>
              {selectedRepresentante ? (
                <div>
                  <p className="font-semibold">
                    {selectedRepresentante.user.nombre} {selectedRepresentante.user.apellido}
                  </p>
                  <p className="text-sm text-gray-600">
                    {selectedRepresentante.user.numeroIdentificacion}
                  </p>
                  {selectedRepresentante.students.length > 0 && (
                    <p className="text-sm text-gray-500 mt-2">
                      {selectedRepresentante.students.length} estudiante(s) asociado(s)
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-gray-400">No seleccionado</p>
              )}
            </div>
          </div>
          <button
            onClick={handleAssociate}
            disabled={!selectedStudent || !selectedRepresentante || associating}
            className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {associating ? 'Asociando...' : 'Asociar Estudiante con Representante'}
          </button>
        </div>
      )}

      {/* Instrucciones */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Instrucciones</h3>
        <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
          <li>Busque un estudiante escribiendo al menos 2 caracteres en el campo de búsqueda</li>
          <li>Busque un representante escribiendo al menos 2 caracteres en el campo de búsqueda</li>
          <li>Seleccione un estudiante y un representante haciendo clic en ellos</li>
          <li>Haga clic en "Asociar Estudiante con Representante" para crear la asociación</li>
          <li>Si un estudiante ya tiene un representante, puede desasociarlo antes de asociarlo con otro</li>
        </ul>
      </div>

      {/* Modal de Carga Masiva */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Carga Masiva de Asociaciones</h2>
              <button
                onClick={handleCloseBulkModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Instrucciones */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-blue-900 mb-2">Instrucciones</h3>
                <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
                  <li>Descargue la plantilla Excel usando el botón "Descargar Plantilla"</li>
                  <li>Complete la plantilla con las cédulas de estudiantes y representantes</li>
                  <li>Cargue el archivo completado usando el botón "Seleccionar Archivo"</li>
                  <li>Revise la vista previa de los datos</li>
                  <li>Haga clic en "Procesar Asociaciones" para ejecutar la carga</li>
                </ol>
              </div>

              {/* File Upload */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seleccionar archivo Excel
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              {/* Preview */}
              {bulkPreview.length > 0 && !bulkResults && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3">Vista Previa ({bulkPreview.length} registros)</h3>
                  <div className="overflow-x-auto max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Línea</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cédula Estudiante</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cédula Representante</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {bulkPreview.map((item, index) => (
                          <tr key={index}>
                            <td className="px-4 py-3 text-sm text-gray-900">{item.linea}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{item.cedulaEstudiante}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{item.cedulaRepresentante}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Results */}
              {bulkResults && (
                <div className="space-y-6">
                  {/* Resumen */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-3">Resumen del Procesamiento</h3>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">{bulkResults.resumen.total}</div>
                        <div className="text-sm text-gray-600">Total</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{bulkResults.resumen.exitosos}</div>
                        <div className="text-sm text-gray-600">Exitosos</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{bulkResults.resumen.errores}</div>
                        <div className="text-sm text-gray-600">Errores</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-600">{bulkResults.resumen.omitidos}</div>
                        <div className="text-sm text-gray-600">Omitidos</div>
                      </div>
                    </div>
                  </div>

                  {/* Exitosos */}
                  {bulkResults.detalles.exitosos.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 text-green-700">
                        Asociaciones Exitosas ({bulkResults.detalles.exitosos.length})
                      </h3>
                      <div className="overflow-x-auto max-h-48 overflow-y-auto border border-green-200 rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-green-50 sticky top-0">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Línea</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estudiante</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Representante</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Anterior</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {bulkResults.detalles.exitosos.map((item, index) => (
                              <tr key={index}>
                                <td className="px-4 py-2 text-sm">{item.linea}</td>
                                <td className="px-4 py-2 text-sm">{item.estudiante}</td>
                                <td className="px-4 py-2 text-sm">{item.representante}</td>
                                <td className="px-4 py-2 text-sm text-gray-500">{item.representanteAnterior}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Errores */}
                  {bulkResults.detalles.errores.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 text-red-700">
                        Errores ({bulkResults.detalles.errores.length})
                      </h3>
                      <div className="overflow-x-auto max-h-48 overflow-y-auto border border-red-200 rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-red-50 sticky top-0">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Línea</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cédula Est.</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cédula Rep.</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Error</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {bulkResults.detalles.errores.map((item, index) => (
                              <tr key={index}>
                                <td className="px-4 py-2 text-sm">{item.linea}</td>
                                <td className="px-4 py-2 text-sm">{item.cedulaEstudiante}</td>
                                <td className="px-4 py-2 text-sm">{item.cedulaRepresentante}</td>
                                <td className="px-4 py-2 text-sm text-red-600">{item.error}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Omitidos */}
                  {bulkResults.detalles.omitidos.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 text-yellow-700">
                        Omitidos ({bulkResults.detalles.omitidos.length})
                      </h3>
                      <div className="overflow-x-auto max-h-48 overflow-y-auto border border-yellow-200 rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-yellow-50 sticky top-0">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Línea</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estudiante</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Representante</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Razón</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {bulkResults.detalles.omitidos.map((item, index) => (
                              <tr key={index}>
                                <td className="px-4 py-2 text-sm">{item.linea}</td>
                                <td className="px-4 py-2 text-sm">{item.estudiante}</td>
                                <td className="px-4 py-2 text-sm">{item.representante}</td>
                                <td className="px-4 py-2 text-sm text-yellow-600">{item.razon}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={handleCloseBulkModal}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cerrar
              </button>
              {bulkPreview.length > 0 && !bulkResults && (
                <button
                  onClick={handleBulkProcess}
                  disabled={bulkProcessing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {bulkProcessing ? 'Procesando...' : 'Procesar Asociaciones'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssociateStudents;

