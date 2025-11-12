import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

const DashboardAdmin = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalStudents: 0,
    totalCourses: 0,
    totalPayments: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [users, students, courses, payments] = await Promise.all([
        api.get('/users?limit=1'),
        api.get('/students?limit=1'),
        api.get('/courses?limit=1'),
        api.get('/payments?limit=1'),
      ]);

      setStats({
        totalUsers: users.data.pagination.total,
        totalStudents: students.data.pagination.total,
        totalCourses: courses.data.pagination.total,
        totalPayments: payments.data.pagination.total,
      });
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
    }
  };

  const statCards = [
    {
      name: 'Usuarios',
      value: stats.totalUsers,
      href: '/users',
      color: 'bg-blue-500',
      icon: '👥',
    },
    {
      name: 'Estudiantes',
      value: stats.totalStudents,
      href: '/students',
      color: 'bg-green-500',
      icon: '🎓',
    },
    {
      name: 'Cursos',
      value: stats.totalCourses,
      href: '/courses',
      color: 'bg-purple-500',
      icon: '📚',
    },
    {
      name: 'Pagos',
      value: stats.totalPayments,
      href: '/payments',
      color: 'bg-yellow-500',
      icon: '💵',
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Panel de Administración</h1>
        <p className="mt-2 text-gray-600">Gestión integral del sistema educativo</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Link
            key={stat.name}
            to={stat.href}
            className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className={`flex-shrink-0 ${stat.color} rounded-md p-3 text-white text-2xl`}>
                  {stat.icon}
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {stat.name}
                    </dt>
                    <dd className="text-2xl font-semibold text-gray-900">
                      {stat.value}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Accesos Rápidos</h3>
          <div className="space-y-3">
            <Link
              to="/students"
              className="block p-3 border border-gray-200 rounded-md hover:bg-gray-50"
            >
              Gestionar Estudiantes
            </Link>
            <Link
              to="/courses"
              className="block p-3 border border-gray-200 rounded-md hover:bg-gray-50"
            >
              Gestionar Cursos
            </Link>
            <Link
              to="/users"
              className="block p-3 border border-gray-200 rounded-md hover:bg-gray-50"
            >
              Gestionar Usuarios
            </Link>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Información del Sistema</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <p>Versión: 1.0.0</p>
            <p>Estado: Operativo</p>
            <p>Base de datos: PostgreSQL</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardAdmin;

