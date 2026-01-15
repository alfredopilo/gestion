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
          ...(institucionId && { institucionId })
        }
      }),
      
      // Contar estudiantes (a través de su user y institución)
      prisma.student.count({
        where: {
          ...(institucionId && { 
            user: {
              institucionId
            }
          })
        }
      }),
      
      // Contar cursos activos (a través del año lectivo y su institución)
      prisma.course.count({
        where: {
          ...(institucionId && { 
            anioLectivo: { 
              institucionId 
            } 
          })
        }
      }),
      
      // Contar pagos (a través del estudiante y su user e institución)
      prisma.payment.count({
        where: {
          ...(institucionId && { 
            estudiante: { 
              user: {
                institucionId
              }
            } 
          })
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
          ...(institucionId && { institucionId })
        }
      }),
      
      // Estudiantes (a través de su user e institución)
      prisma.student.count({
        where: {
          ...(institucionId && { 
            user: {
              institucionId
            }
          })
        }
      }),
      
      // Cursos (a través del año lectivo)
      prisma.course.count({
        where: {
          ...(institucionId && { 
            anioLectivo: { 
              institucionId 
            } 
          })
        }
      }),
      
      // Pagos totales (a través del estudiante y user)
      prisma.payment.count({
        where: {
          ...(institucionId && { 
            estudiante: { 
              user: {
                institucionId
              }
            } 
          })
        }
      }),
      
      // Últimos 5 estudiantes registrados
      prisma.student.findMany({
        where: {
          ...(institucionId && { 
            user: {
              institucionId
            }
          })
        },
        select: {
          id: true,
          createdAt: true,
          user: {
            select: {
              nombre: true,
              apellido: true
            }
          }
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
              user: {
                institucionId
              }
            } 
          })
        },
        _count: {
          id: true
        },
        _sum: {
          monto: true
        }
      })
    ]);

    // Procesar pagos por estado
    const paymentsByStatus = paymentSummary.reduce((acc, item) => {
      acc[item.estado] = {
        count: item._count.id,
        total: item._sum.monto || 0
      };
      return acc;
    }, {});

    // Formatear estudiantes recientes
    const formattedRecentStudents = recentStudents.map(student => ({
      id: student.id,
      nombre: student.user.nombre,
      apellido: student.user.apellido,
      createdAt: student.createdAt
    }));

    res.json({
      success: true,
      data: {
        totals: {
          users: usersCount,
          students: studentsCount,
          courses: coursesCount,
          payments: paymentsCount
        },
        recentStudents: formattedRecentStudents,
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
