import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const Payments = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      let response;
      if (user?.rol === 'ESTUDIANTE' && user?.student?.id) {
        response = await api.get(`/payments/student/${user.student.id}`);
        setPayments(response.data.pagos || []);
      } else {
        response = await api.get('/payments');
        setPayments(response.data.data || []);
      }
    } catch (error) {
      console.error('Error al cargar pagos:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEstadoColor = (estado) => {
    const colors = {
      PAGADO: 'bg-green-100 text-green-800',
      PENDIENTE: 'bg-yellow-100 text-yellow-800',
      VENCIDO: 'bg-red-100 text-red-800',
      CANCELADO: 'bg-gray-100 text-gray-800',
    };
    return colors[estado] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return <div>Cargando...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Pagos</h1>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {user?.rol !== 'ESTUDIANTE' && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Estudiante
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Concepto
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Monto
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Fecha Pago
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Estado
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {payments.map((payment) => (
              <tr key={payment.id}>
                {user?.rol !== 'ESTUDIANTE' && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    {payment.estudiante?.user?.nombre} {payment.estudiante?.user?.apellido}
                  </td>
                )}
                <td className="px-6 py-4 whitespace-nowrap">{payment.concepto}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  ${payment.monto.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {payment.fechaPago
                    ? new Date(payment.fechaPago).toLocaleDateString('es-ES')
                    : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getEstadoColor(payment.estado)}`}>
                    {payment.estado}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Payments;

