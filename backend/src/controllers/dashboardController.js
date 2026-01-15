import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Obtener estadísticas optimizadas para el dashboard
 * Usa COUNT(*) directamente en lugar de cargar registros completos
 */
export const getDashboardStats = async (req, res) => {
  try {
    const institutionId = req.institutionId;

    // Ejecutar todas las consultas en paralelo con COUNT optimizado
    const [usersCount, studentsCount, coursesCount, paymentsCount] = await Promise.all([
      // Contar usuarios de la institución
      prisma.user.count({
        where: {
          ...(institutionId && { institutionId }),
          deletedAt: null
        }
      }),
      
      // Contar estudiantes activos
      prisma.student.count({
        where: {
          ...(institutionId && { institutionId }),
          status: 'ACTIVO',
          deletedAt: null
        }
      }),
      
      // Contar cursos activos
      prisma.course.count({
        where: {
          ...(institutionId && { institutionId }),
          deletedAt: null
        }
      }),
      
      // Contar pagos
      prisma.payment.count({
        where: {
          ...(institutionId && { student: { institutionId } }),
          deletedAt: null
        }
      })
    ]);

    res.json({
      success: true,
      data: {
        totalUsers: usersCount,
        totalStudents: studentsCount,
        totalCourses: coursesCount,
        totalPayments: paymentsCount
      }
    });

  } catch (error) {
    console.error('Error al obtener estadísticas del dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas del dashboard',
      error: error.message
    });
  }
};

/**
 * Obtener estadísticas detalladas con más información
 * (para futura expansión del dashboard)
 */
export const getDashboardDetailedStats = async (req, res) => {
  try {
    const institutionId = req.institutionId;

    // Ejecutar consultas en paralelo
    const [
      usersCount,
      studentsCount,
      coursesCount,
      paymentsCount,
      recentStudents,
      paymentSummary
    ] = await Promise.all([
      // Usuarios
      prisma.user.count({
        where: {
          ...(institutionId && { institutionId }),
          deletedAt: null
        }
      }),
      
      // Estudiantes por estado
      prisma.student.groupBy({
        by: ['status'],
        where: {
          ...(institutionId && { institutionId }),
          deletedAt: null
        },
        _count: {
          id: true
        }
      }),
      
      // Cursos
      prisma.course.count({
        where: {
          ...(institutionId && { institutionId }),
          deletedAt: null
        }
      }),
      
      // Pagos totales
      prisma.payment.count({
        where: {
          ...(institutionId && { student: { institutionId } }),
          deletedAt: null
        }
      }),
      
      // Últimos 5 estudiantes registrados
      prisma.student.findMany({
        where: {
          ...(institutionId && { institutionId }),
          deletedAt: null
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          createdAt: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 5
      }),
      
      // Resumen de pagos
      prisma.payment.groupBy({
        by: ['status'],
        where: {
          ...(institutionId && { student: { institutionId } }),
          deletedAt: null
        },
        _count: {
          id: true
        },
        _sum: {
          amount: true
        }
      })
    ]);

    // Procesar estudiantes por estado
    const studentsByStatus = studentsCount.reduce((acc, item) => {
      acc[item.status] = item._count.id;
      return acc;
    }, {});

    // Procesar pagos por estado
    const paymentsByStatus = paymentSummary.reduce((acc, item) => {
      acc[item.status] = {
        count: item._count.id,
        total: item._sum.amount || 0
      };
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        totals: {
          users: usersCount,
          students: studentsByStatus.ACTIVO || 0,
          courses: coursesCount,
          payments: paymentsCount
        },
        studentsByStatus,
        recentStudents,
        paymentsByStatus
      }
    });

  } catch (error) {
    console.error('Error al obtener estadísticas detalladas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas detalladas',
      error: error.message
    });
  }
};
