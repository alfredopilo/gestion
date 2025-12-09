import { useState, useEffect } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';

const AssociateStudents = () => {
  const [students, setStudents] = useState([]);
  const [representantes, setRepresentantes] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedRepresentante, setSelectedRepresentante] = useState(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [representanteSearch, setRepresentanteSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [associating, setAssociating] = useState(false);

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

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Asociar Padres con Estudiantes</h1>
        <p className="mt-2 text-gray-600">
          Busque y asocie estudiantes con sus representantes (padres)
        </p>
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
    </div>
  );
};

export default AssociateStudents;

