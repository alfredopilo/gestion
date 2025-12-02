import { useState } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';

const StudentWithdrawalModal = ({ student, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    motivo: '',
    observaciones: '',
    fechaRetiro: new Date().toISOString().split('T')[0], // Fecha actual como valor por defecto
  });

  const motivos = [
    { value: 'Nunca asistió', label: 'Nunca asistió' },
    { value: 'Solo un día', label: 'Solo asistió un día' },
    { value: 'Cambio de institución', label: 'Cambio de institución' },
    { value: 'Problemas familiares', label: 'Problemas familiares' },
    { value: 'Problemas económicos', label: 'Problemas económicos' },
    { value: 'Otro', label: 'Otro' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.motivo) {
      toast.error('Debe seleccionar un motivo de retiro');
      return;
    }

    if (!formData.fechaRetiro) {
      toast.error('Debe seleccionar una fecha de retiro');
      return;
    }

    try {
      setLoading(true);
      await api.post(`/students/${student.id}/withdraw`, formData);
      toast.success('Estudiante retirado exitosamente');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error al retirar estudiante:', error);
      toast.error(error.response?.data?.error || 'Error al retirar estudiante');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Retirar Estudiante</h2>
        
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Fecha de Retiro <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={formData.fechaRetiro}
              onChange={(e) => setFormData({ ...formData, fechaRetiro: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              max={new Date().toISOString().split('T')[0]} // No permitir fechas futuras
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Motivo de Retiro <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.motivo}
              onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Seleccione un motivo</option>
              {motivos.map((motivo) => (
                <option key={motivo.value} value={motivo.value}>
                  {motivo.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Observaciones
            </label>
            <textarea
              value={formData.observaciones}
              onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
              rows={4}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Detalles adicionales sobre el retiro..."
            />
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
            <p className="text-sm text-yellow-800">
              <strong>⚠️ Advertencia:</strong> El estudiante será marcado como retirado y solo 
              estará disponible para consultas. Para reactivarlo, deberá crear una nueva matrícula 
              o transferirlo a otra institución.
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
              disabled={loading || !formData.motivo || !formData.fechaRetiro}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Procesando...' : 'Confirmar Retiro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StudentWithdrawalModal;

