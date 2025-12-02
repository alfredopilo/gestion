import { useState } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';

const DatabaseBackup = () => {
  const [generating, setGenerating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleDownloadBackup = async () => {
    try {
      setGenerating(true);
      
      const response = await api.get('/backup/download', {
        responseType: 'blob',
      });

      // Obtener el nombre del archivo del header Content-Disposition
      const contentDisposition = response.headers['content-disposition'];
      let fileName = 'backup_gestion_escolar.sql.gz';
      
      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (fileNameMatch && fileNameMatch[1]) {
          fileName = fileNameMatch[1].replace(/['"]/g, '');
        }
      }

      // Crear URL del blob y descargar
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Backup descargado exitosamente');
    } catch (error) {
      console.error('Error al generar backup:', error);
      
      // Intentar leer el mensaje de error del blob si existe
      if (error.response?.data instanceof Blob) {
        error.response.data.text().then(text => {
          try {
            const errorData = JSON.parse(text);
            toast.error(errorData.error || 'Error al generar backup');
          } catch {
            toast.error('Error al generar backup de la base de datos');
          }
        });
      } else {
        toast.error(error.response?.data?.error || 'Error al generar backup de la base de datos');
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validar formato del archivo
      const isValidFormat = file.name.endsWith('.sql.gz') || file.name.endsWith('.sql');
      if (isValidFormat) {
        setSelectedFile(file);
      } else {
        toast.error('El archivo debe ser un backup SQL (.sql o .sql.gz)');
        event.target.value = ''; // Limpiar el input
        setSelectedFile(null);
      }
    }
  };

  const handleRestoreBackup = async () => {
    if (!selectedFile) {
      toast.error('Por favor selecciona un archivo de backup');
      return;
    }

    // Confirmar antes de restaurar
    const confirmed = window.confirm(
      '⚠️ ADVERTENCIA: Restaurar un backup reemplazará TODOS los datos actuales de la base de datos.\n\n' +
      'Esta acción NO se puede deshacer. ¿Estás seguro de que deseas continuar?'
    );

    if (!confirmed) {
      return;
    }

    try {
      setRestoring(true);

      const formData = new FormData();
      formData.append('backup', selectedFile);

      await api.post('/backup/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success('Backup restaurado exitosamente');
      setSelectedFile(null);
      
      // Limpiar el input
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) {
        fileInput.value = '';
      }
    } catch (error) {
      console.error('Error al restaurar backup:', error);
      toast.error(error.response?.data?.error || 'Error al restaurar backup de la base de datos');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Respaldo de Base de Datos</h1>
        <p className="mt-2 text-sm text-gray-600">
          Genera y restaura respaldos completos de la base de datos del sistema
        </p>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="max-w-3xl">
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Información sobre el Backup</h2>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm text-blue-800 font-medium">¿Qué se incluye en el backup?</p>
                  <p className="text-sm text-blue-700 mt-1">
                    El backup incluye toda la estructura y datos de la base de datos PostgreSQL, 
                    incluyendo usuarios, estudiantes, cursos, calificaciones, pagos y todas las 
                    configuraciones del sistema.
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <div>
                  <p className="text-sm text-blue-800 font-medium">Formato del archivo</p>
                  <p className="text-sm text-blue-700 mt-1">
                    El archivo se descargará en formato SQL comprimido (.sql.gz), lo que reduce 
                    significativamente el tamaño del archivo. Puede ser restaurado usando herramientas 
                    estándar de PostgreSQL.
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-sm text-yellow-800 font-medium">Importante</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    La generación del backup puede tomar varios minutos dependiendo del tamaño de la 
                    base de datos. Por favor, mantén esta ventana abierta hasta que se complete la descarga.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Generar Backup</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Haz clic en el botón para generar y descargar el backup de la base de datos
                </p>
              </div>
              <button
                onClick={handleDownloadBackup}
                disabled={generating}
                className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center"
              >
                {generating ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generando...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Generar y Descargar Backup
                  </>
                )}
              </button>
            </div>
          </div>

          {generating && (
            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center">
                <svg className="animate-spin h-5 w-5 text-yellow-600 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    Generando backup de la base de datos...
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Por favor espera, esto puede tomar varios minutos. No cierres esta ventana.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sección de Restaurar Backup */}
      <div className="bg-white shadow rounded-lg p-6 mt-6">
        <div className="max-w-3xl">
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Restaurar Backup</h2>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-sm text-red-800 font-medium">⚠️ Advertencia Importante</p>
                  <p className="text-sm text-red-700 mt-1">
                    Restaurar un backup reemplazará TODOS los datos actuales de la base de datos. 
                    Esta acción NO se puede deshacer. Asegúrate de tener un backup actualizado antes de proceder.
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm text-red-800 font-medium">Formato del archivo</p>
                  <p className="text-sm text-red-700 mt-1">
                    Solo se aceptan archivos de backup en formato SQL (.sql) o SQL comprimido (.sql.gz). 
                    El proceso de restauración puede tomar varios minutos dependiendo del tamaño del archivo.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seleccionar archivo de backup
                </label>
                <div className="flex items-center space-x-4">
                  <input
                    type="file"
                    accept=".sql,.sql.gz"
                    onChange={handleFileChange}
                    disabled={restoring}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-md file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                {selectedFile && (
                  <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-green-800">Archivo seleccionado:</p>
                        <p className="text-sm text-green-700">{selectedFile.name}</p>
                        <p className="text-xs text-green-600 mt-1">
                          Tamaño: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end">
                <button
                  onClick={handleRestoreBackup}
                  disabled={!selectedFile || restoring}
                  className="px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center"
                >
                  {restoring ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Restaurando...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Restaurar Backup
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {restoring && (
            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center">
                <svg className="animate-spin h-5 w-5 text-yellow-600 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    Restaurando backup de la base de datos...
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Por favor espera, esto puede tomar varios minutos. No cierres esta ventana.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DatabaseBackup;

