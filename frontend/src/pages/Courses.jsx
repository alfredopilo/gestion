import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

const Courses = () => {
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState([]);
  const [importFileName, setImportFileName] = useState('');
  const [importSummary, setImportSummary] = useState(null);
  const [importError, setImportError] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    nivel: '',
    paralelo: '',
    docenteId: '',
    capacidad: 30,
    cursoSiguienteId: '',
    sortOrder: 0,
    ultimoCurso: false,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [coursesRes, teachersRes] = await Promise.all([
        api.get('/courses?limit=100'),
        api.get('/teachers?limit=100'),
      ]);

      setCourses(coursesRes.data.data || []);
      
      // Filtrar solo profesores activos
      const activeTeachers = (teachersRes.data.data || []).filter(
        t => t.user && t.user.estado === 'ACTIVO'
      );
      setTeachers(activeTeachers);
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
        paralelo: formData.paralelo || null,
        docenteId: formData.docenteId || null,
        capacidad: formData.capacidad ? parseInt(formData.capacidad) : null,
        cursoSiguienteId: formData.cursoSiguienteId || null,
        sortOrder: formData.sortOrder !== '' && formData.sortOrder !== null
          ? parseInt(formData.sortOrder, 10)
          : 0,
      };

      if (editingCourse) {
        await api.put(`/courses/${editingCourse.id}`, data);
        toast.success('Curso actualizado exitosamente');
      } else {
        await api.post('/courses', data);
        toast.success('Curso creado exitosamente');
      }

      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error al guardar curso:', error);
      toast.error(error.response?.data?.error || 'Error al guardar curso');
    }
  };

  const handleEdit = (course) => {
    setEditingCourse(course);
    setFormData({
      nombre: course.nombre || '',
      nivel: course.nivel || '',
      paralelo: course.paralelo || '',
      docenteId: course.docenteId || '',
      capacidad: course.capacidad || 30,
      cursoSiguienteId: course.cursoSiguienteId || '',
      sortOrder: typeof course.sortOrder === 'number' ? course.sortOrder : 0,
      ultimoCurso: course.ultimoCurso ?? false,
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este curso? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await api.delete(`/courses/${id}`);
      toast.success('Curso eliminado exitosamente');
      fetchData();
    } catch (error) {
      console.error('Error al eliminar curso:', error);
      toast.error(error.response?.data?.error || 'Error al eliminar curso');
    }
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      nivel: '',
      paralelo: '',
      docenteId: '',
      capacidad: 30,
      cursoSiguienteId: '',
      sortOrder: 0,
      ultimoCurso: false,
    });
    setEditingCourse(null);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

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
      const response = await api.get('/courses/import-template-courses', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'plantilla_importacion_cursos.xlsx');
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
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      if (jsonData.length < 2) {
        throw new Error('El archivo debe incluir encabezados y al menos una fila de datos.');
      }

      const headerMap = {
        nombre: 'nombre',
        nivel: 'nivel',
        paralelo: 'paralelo',
        capacidad: 'capacidad',
        sortorder: 'sortOrder',
        'sort order': 'sortOrder',
        orden: 'sortOrder',
        'orden de listado': 'sortOrder',
      };

      const rawHeaders = jsonData[0].map(header => String(header).trim());
      const headers = rawHeaders.map(header => headerMap[header.toLowerCase()] ?? header);

      const requiredHeaders = ['nombre', 'nivel'];
      const missingHeaders = requiredHeaders.filter(required => !headers.includes(required));
      if (missingHeaders.length > 0) {
        throw new Error(`Faltan las columnas obligatorias: ${missingHeaders.join(', ')}`);
      }

      const parsedCourses = [];
      for (let rowIndex = 1; rowIndex < jsonData.length; rowIndex += 1) {
        const row = jsonData[rowIndex];

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

        if (Object.keys(record).length > 0 && record.nombre && record.nivel) {
          parsedCourses.push(record);
        }
      }

      if (parsedCourses.length === 0) {
        throw new Error('No se encontraron registros válidos en el archivo.');
      }

      setImportPreview(parsedCourses);
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
      const workbook = XLSX.utils.book_new();
      const headers = ['nombre', 'nivel', 'paralelo', 'capacidad', 'sortOrder'];
      const data = [headers, ...importPreview.map(item => [
        item.nombre,
        item.nivel,
        item.paralelo || '',
        item.capacidad || '',
        item.sortOrder || '',
      ])];
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Cursos');

      const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const formData = new FormData();
      formData.append('file', blob, 'cursos.xlsx');

      const response = await api.post('/courses/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setImportSummary(response.data);
      setImportPreview([]);

      if (response.data.resumen.errores === 0) {
        toast.success('Importación completada exitosamente');
        fetchData();
      } else {
        toast.success(`Importación completada con ${response.data.resumen.errores} error(es)`);
      }
    } catch (error) {
      console.error('Error al importar cursos:', error);
      setImportError(error.response?.data?.error || 'Error al importar los cursos');
      toast.error('Error al importar los cursos');
    } finally {
      setImportLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        <span className="ml-4 text-gray-600">Cargando cursos...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Gestión de Cursos</h1>
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
            Importar Cursos
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
          >
            Nuevo Curso
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orden</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nivel</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paralelo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Año Escolar</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Docente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estudiantes</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacidad</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {courses.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-4 text-center text-gray-500">
                    No hay cursos registrados
                  </td>
                </tr>
              ) : (
                courses.map((course) => (
                  <tr key={course.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {course.sortOrder ?? 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={`/courses/${course.id}`}
                        className="text-primary-600 hover:text-primary-900 font-medium"
                      >
                        {course.nombre}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{course.nivel}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{course.paralelo || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {course.anioLectivo?.nombre || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {course.docente?.user 
                        ? `${course.docente.user.nombre} ${course.docente.user.apellido}`
                        : '-'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {course.cursoSiguiente ? (
                        <span className="text-blue-600">
                          {course.cursoSiguiente.nombre}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        (course._count?.estudiantes || 0) >= (course.capacidad || 30)
                          ? 'bg-red-100 text-red-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {course._count?.estudiantes || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{course.capacidad || 30}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEdit(course)}
                        className="text-primary-600 hover:text-primary-900 mr-4"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(course.id)}
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
      </div>

      {/* Modal para crear/editar curso */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingCourse ? 'Editar Curso' : 'Nuevo Curso'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                    placeholder="Ej: Primero de Bachillerato"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Nivel <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nivel}
                    onChange={(e) => setFormData({ ...formData, nivel: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Ej: Bachillerato, Primaria"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Paralelo
                  </label>
                  <input
                    type="text"
                    value={formData.paralelo}
                    onChange={(e) => setFormData({ ...formData, paralelo: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Ej: A, B, C"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Capacidad
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.capacidad}
                    onChange={(e) => setFormData({ ...formData, capacidad: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Orden de listado
                  </label>
                  <input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Docente Tutor (Opcional)
                  </label>
                  <select
                    value={formData.docenteId}
                    onChange={(e) => setFormData({ ...formData, docenteId: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Sin docente tutor</option>
                    {teachers.map(teacher => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.user?.nombre} {teacher.user?.apellido} - {teacher.user?.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Siguiente Grado (Opcional)
                </label>
                <select
                  value={formData.cursoSiguienteId}
                  onChange={(e) => setFormData({ ...formData, cursoSiguienteId: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">Sin siguiente grado</option>
                  {courses
                    .filter(c => !editingCourse || c.id !== editingCourse.id) // Excluir el curso actual
                    .map(course => (
                      <option key={course.id} value={course.id}>
                        {course.nombre} ({course.nivel} {course.paralelo || ''}) - {course.anioLectivo?.nombre || ''}
                      </option>
                    ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Curso al que promocionarán los estudiantes al finalizar el año escolar
                </p>
              </div>

              <div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.ultimoCurso}
                    onChange={(e) => setFormData({ ...formData, ultimoCurso: e.target.checked })}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Último curso</span>
                </label>
                <p className="mt-1 text-xs text-gray-500">
                  Si está activo, los estudiantes de este curso no se promocionan al siguiente periodo; es su último grado y los datos quedan como históricos.
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
                  {editingCourse ? 'Actualizar' : 'Crear Curso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Importar Cursos desde Excel</h2>

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

                {importPreview.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Vista Previa ({importPreview.length} cursos)</h3>
                    <div className="border rounded-lg overflow-hidden">
                      <div className="max-h-96 overflow-y-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nivel</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Paralelo</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Capacidad</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Orden</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {importPreview.map((course, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-sm">{index + 1}</td>
                                <td className="px-4 py-2 text-sm">{course.nombre}</td>
                                <td className="px-4 py-2 text-sm">{course.nivel}</td>
                                <td className="px-4 py-2 text-sm">{course.paralelo || '-'}</td>
                                <td className="px-4 py-2 text-sm">{course.capacidad || '-'}</td>
                                <td className="px-4 py-2 text-sm">{course.sortOrder || '-'}</td>
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

export default Courses;

