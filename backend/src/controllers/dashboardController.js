import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Obtener estadísticas optimizadas para el dashboard
 * Usa COUNT(*) directamente en lugar de cargar registros completos
 */
export const getDashboardStats = async (req, res) => {
  try {
    const institucionId = req.institutionId;

    // Ejecutar todas las consultas en paralelo con COUNT optimizado
    const [usersCount, studentsCount, coursesCount, paymentsCount] = await Promise.all([
      // Contar usuarios de la institución
      prisma.user.count({
        where: {
          ...(institucionId && { institucionId }),
          deletedAt: null
        }
      }),
      
      // Contar estudiantes activos
      prisma.student.count({
        where: {
          ...(institucionId && { institucionId }),
          estado: 'ACTIVO',
          deletedAt: null
        }
      }),
      
      // Contar cursos activos (a través del año lectivo y su institución)
      prisma.course.count({
        where: {
          ...(institucionId && { 
            anioLectivo: { 
              institucionId 
            } 
          }),
          deletedAt: null
        }
      }),
      
      // Contar pagos (a través del estudiante y su institución)
      prisma.payment.count({
        where: {
          ...(institucionId && { 
            estudiante: { 
              institucionId 
            } 
          }),
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
    const institucionId = req.institutionId;

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
          ...(institucionId && { institucionId }),
          deletedAt: null
        }
      }),
      
      // Estudiantes por estado
      prisma.student.groupBy({
        by: ['estado'],
        where: {
          ...(institucionId && { institucionId }),
          deletedAt: null
        },
        _count: {
          id: true
        }
      }),
      
      // Cursos (a través del año lectivo)
      prisma.course.count({
        where: {
          ...(institucionId && { 
            anioLectivo: { 
              institucionId 
            } 
          }),
          deletedAt: null
        }
      }),
      
      // Pagos totales (a través del estudiante)
      prisma.payment.count({
        where: {
          ...(institucionId && { 
            estudiante: { 
              institucionId 
            } 
          }),
          deletedAt: null
        }
      }),
      
      // Últimos 5 estudiantes registrados
      prisma.student.findMany({
        where: {
          ...(institucionId && { institucionId }),
          deletedAt: null
        },
        select: {
          id: true,
          nombre: true,
          apellido: true,
          createdAt: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 5
      }),
      
      // Resumen de pagos
      prisma.payment.groupBy({
        by: ['estado'],
        where: {
          ...(institucionId && { 
            estudiante: { 
              institucionId 
            } 
          }),
          deletedAt: null
        },
        _count: {
          id: true
        },
        _sum: {
          monto: true
        }
      })
    ]);

    // Procesar estudiantes por estado
    const studentsByStatus = studentsCount.reduce((acc, item) => {
      acc[item.estado] = item._count.id;
      return acc;
    }, {});

    // Procesar pagos por estado
    const paymentsByStatus = paymentSummary.reduce((acc, item) => {
      acc[item.estado] = {
        count: item._count.id,
        total: item._sum.monto || 0
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
