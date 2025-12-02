import { useState, useEffect } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';

const StudentReactivationModal = ({ student, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  // Si viene con reactivationMode definido, usar ese modo, sino por defecto 'reactivate'
  const initialMode = student?.reactivationMode || 'reactivate';
  const [mode, setMode] = useState(initialMode); // 'reactivate' o 'transfer'
  const [courses, setCourses] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [formData, setFormData] = useState({
    cursoId: '',
    nuevaInstitucionId: '',
    fechaInicio: new Date().toISOString().split('T')[0], // Fecha actual como valor por defecto
  });

  useEffect(() => {
    // Establecer el modo inicial desde el prop si existe
    if (student?.reactivationMode) {
      setMode(student.reactivationMode);
    }
  }, [student?.reactivationMode]);

  useEffect(() => {
    // Cargar datos según el modo actual
    if (mode === 'reactivate') {
      fetchCourses();
    } else {
      fetchInstitutions();
    }
  }, [mode]);

  // Cargar datos iniciales cuando se monta el componente
  useEffect(() => {
    if (initialMode === 'reactivate') {
      fetchCourses();
    } else {
      fetchInstitutions();
    }
  }, []);

  const fetchCourses = async () => {
    try {
      const response = await api.get('/courses?limit=100');
      setCourses(response.data.data || []);
    } catch (error) {
      console.error('Error al cargar cursos:', error);
      toast.error('Error al cargar cursos');
    }
  };

  const fetchInstitutions = async () => {
    try {
      const response = await api.get('/institutions/user-institutions');
      setInstitutions(response.data.data || []);
    } catch (error) {
      console.error('Error al cargar instituciones:', error);
      toast.error('Error al cargar instituciones');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      
      if (mode === 'reactivate') {
        if (!formData.cursoId) {
          toast.error('Debe seleccionar un curso');
          return;
        }
        if (!formData.fechaInicio) {
          toast.error('Debe seleccionar una fecha de reactivación');
          return;
        }
        await api.post(`/students/${student.id}/reactivate`, {
          cursoId: formData.cursoId,
          fechaInicio: formData.fechaInicio,
        });
        toast.success('Estudiante reactivado exitosamente');
      } else {
        if (!formData.nuevaInstitucionId) {
          toast.error('Debe seleccionar una institución');
          return;
        }
        await api.post(`/students/${student.id}/transfer`, {
          nuevaInstitucionId: formData.nuevaInstitucionId,
        });
        toast.success('Estudiante transferido exitosamente');
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error(`Error al ${mode === 'reactivate' ? 'reactivar' : 'transferir'} estudiante:`, error);
      toast.error(error.response?.data?.error || `Error al ${mode === 'reactivate' ? 'reactivar' : 'transferir'} estudiante`);
    } finally {
      setLoading(false);
    }
  };

  const fetchCoursesForInstitution = async (institucionId) => {
    if (!institucionId) {
      setCourses([]);
      setFormData({ ...formData, cursoId: '' });
      return;
    }

    try {
      // Pasar el institucionId como parámetro para obtener cursos de esa institución específica
      const response = await api.get(`/courses?institucionId=${institucionId}&limit=100`);
      setCourses(response.data.data || []);
    } catch (error) {
      console.error('Error al cargar cursos:', error);
      toast.error('Error al cargar cursos');
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {mode === 'transfer' ? 'Transferir Estudiante' : 'Reactivar Estudiante'}
        </h2>
        
        <div className="mb-4 p-3 bg-gray-50 rounded">
          <p className="text-sm text-gray-600">
            <strong>Estudiante:</strong> {student?.user?.nombre} {student?.user?.apellido}
          </p>
          {student?.user?.numeroIdentificacion && (
            <p className="text-sm text-gray-600">
              <strong>Identificación:</strong> {student.user.numeroIdentificacion}
            </p>
          )}
        </div>

        {/* Selector de modo */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tipo de Operación
          </label>
          <div className="flex flex-col space-y-2">
            <label className="flex items-center p-2 border rounded hover:bg-gray-50 cursor-pointer">
              <input
                type="radio"
                value="reactivate"
                checked={mode === 'reactivate'}
                onChange={(e) => {
                  setMode(e.target.value);
                  setFormData({ cursoId: '', nuevaInstitucionId: '', fechaInicio: mode === 'reactivate' ? new Date().toISOString().split('T')[0] : '' });
                }}
                className="mr-2"
              />
              <span className="flex-1">
                <strong>Segunda Matrícula</strong>
                <p className="text-xs text-gray-500">Reactivar en la misma institución con nueva matrícula</p>
              </span>
            </label>
            <label className="flex items-center p-2 border rounded hover:bg-gray-50 cursor-pointer">
              <input
                type="radio"
                value="transfer"
                checked={mode === 'transfer'}
                onChange={(e) => {
                  setMode(e.target.value);
                  setFormData({ cursoId: '', nuevaInstitucionId: '', fechaInicio: mode === 'reactivate' ? new Date().toISOString().split('T')[0] : '' });
                }}
                className="mr-2"
              />
              <span className="flex-1">
                <strong>Transferir a otra institución</strong>
                <p className="text-xs text-gray-500">Mover el estudiante a otra institución y copiar su ficha</p>
              </span>
            </label>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'transfer' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Nueva Institución <span className="text-red-500">*</span>
              </label>
              <select
                required={mode === 'transfer'}
                value={formData.nuevaInstitucionId}
                onChange={(e) => {
                  setFormData({ ...formData, nuevaInstitucionId: e.target.value });
                }}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">Seleccione una institución</option>
                {institutions.map((institution) => (
                  <option key={institution.id} value={institution.id}>
                    {institution.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          {mode === 'reactivate' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Curso <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.cursoId}
                onChange={(e) => setFormData({ ...formData, cursoId: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">Seleccione un curso</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.nombre} - {course.nivel} {course.paralelo ? `(${course.paralelo})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {mode === 'reactivate' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Fecha de Reactivación <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.fechaInicio}
                onChange={(e) => setFormData({ ...formData, fechaInicio: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                max={new Date().toISOString().split('T')[0]} // No permitir fechas futuras
              />
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="text-sm text-blue-800">
              {mode === 'reactivate' ? (
                <>
                  <strong>ℹ️ Información:</strong> Se creará una nueva matrícula para el estudiante 
                  en el curso seleccionado dentro de la misma institución.
                </>
              ) : (
                <>
                  <strong>ℹ️ Información:</strong> El estudiante será transferido a la nueva 
                  institución y se copiará su ficha completa. Se creará un nuevo registro de 
                  estudiante en la nueva institución sin curso asignado. Podrá ser asignado a un curso posteriormente.
                </>
              )}
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || (mode === 'reactivate' && (!formData.cursoId || !formData.fechaInicio)) || (mode === 'transfer' && !formData.nuevaInstitucionId)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Procesando...' : mode === 'reactivate' ? 'Reactivar' : 'Transferir'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StudentReactivationModal;

