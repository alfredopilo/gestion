import prisma from '../config/database.js';
import { getCourseInstitutionFilter } from '../utils/institutionFilter.js';

/**
 * Reporte de calificaciones detallado
 */
export const getGradesReport = async (req, res, next) => {
  try {
    const { cursoId, materiaId, periodoId, fechaDesde, fechaHasta } = req.query;

    if (!cursoId) {
      return res.status(400).json({
        error: 'Debe proporcionar cursoId',
      });
    }

    // Verificar acceso al curso
    const courseFilter = await getCourseInstitutionFilter(req, prisma);
    const course = await prisma.course.findFirst({
      where: {
        id: cursoId,
        ...courseFilter,
      },
    });

    if (!course) {
      return res.status(403).json({
        error: 'No tienes acceso a este curso.',
      });
    }

    // Construir filtros
    const whereClause = {
      estudiante: {
        grupoId: cursoId,
      },
    };

    if (materiaId) {
      whereClause.materiaId = materiaId;
    }

    if (periodoId) {
      whereClause.subPeriodo = {
        periodoId: periodoId,
      };
    }

    if (fechaDesde || fechaHasta) {
      whereClause.fechaRegistro = {};
      if (fechaDesde) {
        whereClause.fechaRegistro.gte = new Date(fechaDesde);
      }
      if (fechaHasta) {
        whereClause.fechaRegistro.lte = new Date(fechaHasta);
      }
    }

    const grades = await prisma.grade.findMany({
      where: whereClause,
      include: {
        estudiante: {
          include: {
            user: {
              select: {
                nombre: true,
                apellido: true,
                numeroIdentificacion: true,
              },
            },
          },
        },
        materia: {
          select: {
            nombre: true,
          },
        },
        insumo: {
          select: {
            nombre: true,
            orden: true,
          },
        },
        subPeriodo: {
          include: {
            periodo: {
              select: {
                id: true,
                nombre: true,
                orden: true,
                ponderacion: true,
              },
            },
          },
        },
      },
      orderBy: [
        { estudiante: { user: { apellido: 'asc' } } },
        { materia: { nombre: 'asc' } },
        { fechaRegistro: 'desc' },
      ],
    });

    // Crear estructura de tabla cruzada
    const pivotData = {};
    const columnsMap = new Map(); // Usar Map para guardar información de orden
    
    grades.forEach(grade => {
      const estudianteId = grade.estudianteId;
      const materiaId = grade.materiaId;
      const estudianteNombre = `${grade.estudiante.user.nombre} ${grade.estudiante.user.apellido}`;
      const identificacion = grade.estudiante.user.numeroIdentificacion || '-';
      const materiaNombre = grade.materia.nombre;
      const periodoNombre = grade.subPeriodo?.periodo?.nombre || '-';
      const subPeriodoNombre = grade.subPeriodo?.nombre || '-';
      const insumoNombre = grade.insumo?.nombre || '-';
      
      // Obtener valores de orden (usar valores por defecto si son null)
      const periodoOrden = grade.subPeriodo?.periodo?.orden ?? 999;
      const subPeriodoOrden = grade.subPeriodo?.orden ?? 999;
      const insumoOrden = grade.insumo?.orden ?? 999;
      
      // Crear clave única para estudiante + materia
      const rowKey = `${estudianteId}_${materiaId}`;
      
      // Crear clave única para columna (periodo/subperíodo/insumo)
      const colKey = `${periodoNombre}|${subPeriodoNombre}|${insumoNombre}`;
      
      // Obtener ponderaciones
      const subPeriodoPonderacion = grade.subPeriodo?.ponderacion ?? 0;
      const periodoPonderacion = grade.subPeriodo?.periodo?.ponderacion ?? 0;
      
      // Guardar información de orden y ponderación para esta columna
      if (!columnsMap.has(colKey)) {
        columnsMap.set(colKey, {
          key: colKey,
          periodoOrden,
          subPeriodoOrden,
          insumoOrden,
          periodoNombre,
          subPeriodoNombre,
          insumoNombre,
          subPeriodoPonderacion,
          periodoPonderacion,
          subPeriodoId: grade.subPeriodo?.id,
          periodoId: grade.subPeriodo?.periodo?.id,
        });
      }
      
      if (!pivotData[rowKey]) {
        pivotData[rowKey] = {
          estudiante: estudianteNombre,
          identificacion: identificacion,
          materia: materiaNombre,
          estudianteId: estudianteId,
          materiaId: materiaId,
          calificaciones: {},
          // Estructuras para calcular promedios
          subPeriodoGrades: {}, // { subPeriodoId: [calificaciones] }
          periodoGrades: {}, // { periodoId: [calificaciones] }
        };
      }
      
      // Guardar calificación en la columna correspondiente
      pivotData[rowKey].calificaciones[colKey] = {
        calificacion: grade.calificacion,
        observaciones: grade.observaciones || '',
        fecha: grade.fechaRegistro.toISOString().split('T')[0],
      };
      
      // Acumular calificaciones por subperíodo y período para calcular promedios
      const subPeriodoId = grade.subPeriodo?.id;
      // Intentar obtener periodoId de diferentes formas
      const periodoId = grade.subPeriodo?.periodo?.id || grade.subPeriodo?.periodoId;
      
      if (subPeriodoId) {
        if (!pivotData[rowKey].subPeriodoGrades[subPeriodoId]) {
          pivotData[rowKey].subPeriodoGrades[subPeriodoId] = {
            nombre: subPeriodoNombre,
            ponderacion: subPeriodoPonderacion,
            periodoId: periodoId, // Guardar la relación con el período
            calificaciones: [],
          };
        }
        pivotData[rowKey].subPeriodoGrades[subPeriodoId].calificaciones.push(grade.calificacion);
      }
      
      if (periodoId) {
        if (!pivotData[rowKey].periodoGrades[periodoId]) {
          pivotData[rowKey].periodoGrades[periodoId] = {
            nombre: periodoNombre,
            ponderacion: periodoPonderacion,
            calificaciones: [],
          };
        }
        pivotData[rowKey].periodoGrades[periodoId].calificaciones.push(grade.calificacion);
      }
    });
    
    // Calcular promedios para cada fila
    Object.values(pivotData).forEach(row => {
      // Calcular promedios por subperíodo
      row.promediosSubPeriodo = {};
      Object.entries(row.subPeriodoGrades).forEach(([subPeriodoId, data]) => {
        if (data.calificaciones.length > 0) {
          const promedio = data.calificaciones.reduce((sum, cal) => sum + cal, 0) / data.calificaciones.length;
          const promedioPonderado = promedio * (data.ponderacion / 100);
          row.promediosSubPeriodo[subPeriodoId] = {
            promedio: Math.round(promedio * 100) / 100,
            promedioPonderado: Math.round(promedioPonderado * 100) / 100,
            nombre: data.nombre,
            ponderacion: data.ponderacion,
          };
        }
      });
      
      // Calcular promedios por período
      // El promedio del período es la SUMA de las ponderaciones de cada subperíodo
      row.promediosPeriodo = {};
      Object.entries(row.periodoGrades).forEach(([periodoId, data]) => {
        // Obtener todos los subperíodos que pertenecen a este período
        let sumaPromediosPonderados = 0;
        
        Object.entries(row.subPeriodoGrades).forEach(([subPeriodoId, subData]) => {
          // Verificar si este subperíodo pertenece al período actual usando la relación guardada
          if (subData.periodoId === periodoId) {
            // Buscar el promedio calculado para este subperíodo
            const subPromedio = row.promediosSubPeriodo[subPeriodoId];
            if (subPromedio) {
              // Sumar el promedio ponderado del subperíodo (ya está ponderado)
              sumaPromediosPonderados += subPromedio.promedioPonderado;
            }
          }
        });
        
        if (sumaPromediosPonderados > 0) {
          // El promedio del período es la suma de los promedios ponderados de los subperíodos
          const promedio = sumaPromediosPonderados;
          const promedioPonderado = promedio * (data.ponderacion / 100);
          row.promediosPeriodo[periodoId] = {
            promedio: Math.round(promedio * 100) / 100,
            promedioPonderado: Math.round(promedioPonderado * 100) / 100,
            nombre: data.nombre,
            ponderacion: data.ponderacion,
          };
        } else if (data.calificaciones.length > 0) {
          // Fallback: calcular promedio de todas las calificaciones si no hay subperíodos calculados
          const promedio = data.calificaciones.reduce((sum, cal) => sum + cal, 0) / data.calificaciones.length;
          const promedioPonderado = promedio * (data.ponderacion / 100);
          row.promediosPeriodo[periodoId] = {
            promedio: Math.round(promedio * 100) / 100,
            promedioPonderado: Math.round(promedioPonderado * 100) / 100,
            nombre: data.nombre,
            ponderacion: data.ponderacion,
          };
        }
      });
      
      // Calcular promedio general (suma de las ponderaciones de cada período)
      // El promedio final es la SUMA de los promedios ponderados de cada período
      const periodosCalculados = Object.values(row.promediosPeriodo);
      if (periodosCalculados.length > 0) {
        // Sumar los promedios ponderados de cada período (ya están ponderados)
        let sumaPonderada = 0;
        periodosCalculados.forEach(periodoData => {
          sumaPonderada += periodoData.promedioPonderado;
        });
        row.promedioGeneral = Math.round(sumaPonderada * 100) / 100;
      } else {
        row.promedioGeneral = null;
      }
    });
    
    // Convertir a array y ordenar
    const pivotRows = Object.values(pivotData).sort((a, b) => {
      if (a.estudiante !== b.estudiante) {
        return a.estudiante.localeCompare(b.estudiante);
      }
      return a.materia.localeCompare(b.materia);
    });
    
    // Ordenar columnas por orden: primero periodo, luego subperíodo, luego insumo
    const sortedColumnsData = Array.from(columnsMap.values()).sort((a, b) => {
      // Primero por orden del periodo
      if (a.periodoOrden !== b.periodoOrden) {
        return a.periodoOrden - b.periodoOrden;
      }
      // Luego por orden del subperíodo
      if (a.subPeriodoOrden !== b.subPeriodoOrden) {
        return a.subPeriodoOrden - b.subPeriodoOrden;
      }
      // Finalmente por orden del insumo
      if (a.insumoOrden !== b.insumoOrden) {
        return a.insumoOrden - b.insumoOrden;
      }
      // Si todos los órdenes son iguales, ordenar alfabéticamente
      return a.key.localeCompare(b.key);
    });

    const sortedColumns = sortedColumnsData.map(col => col.key);

    // Agrupar columnas por período y subperíodo para el frontend
    const columnsByPeriod = {};
    sortedColumnsData.forEach(col => {
      if (!columnsByPeriod[col.periodoNombre]) {
        columnsByPeriod[col.periodoNombre] = {
          periodoNombre: col.periodoNombre,
          periodoOrden: col.periodoOrden,
          periodoId: col.periodoId || null, // Asegurar que siempre tenga un valor (puede ser null)
          periodoPonderacion: col.periodoPonderacion,
          subPeriods: {},
        };
      }
      
      // Si el periodoId es null o undefined, intentar obtenerlo de otra columna del mismo período
      if (!columnsByPeriod[col.periodoNombre].periodoId && col.periodoId) {
        columnsByPeriod[col.periodoNombre].periodoId = col.periodoId;
      }
      
      // Agrupar por subperíodo dentro del período
      if (!columnsByPeriod[col.periodoNombre].subPeriods[col.subPeriodoNombre]) {
        columnsByPeriod[col.periodoNombre].subPeriods[col.subPeriodoNombre] = {
          subPeriodoNombre: col.subPeriodoNombre,
          subPeriodoOrden: col.subPeriodoOrden,
          subPeriodoId: col.subPeriodoId,
          subPeriodoPonderacion: col.subPeriodoPonderacion,
          columns: [],
        };
      }
      columnsByPeriod[col.periodoNombre].subPeriods[col.subPeriodoNombre].columns.push(col.key);
    });

    // Convertir a array y ordenar por orden del período
    const periodsGrouped = Object.values(columnsByPeriod).sort((a, b) => {
      return a.periodoOrden - b.periodoOrden;
    });

    // Convertir subperíodos a arrays ordenados dentro de cada período
    periodsGrouped.forEach(period => {
      period.subPeriods = Object.values(period.subPeriods).sort((a, b) => {
        return a.subPeriodoOrden - b.subPeriodoOrden;
      });
    });

    res.json({
      grades: pivotRows,
      columns: sortedColumns,
      periodsGrouped: periodsGrouped,
      total: pivotRows.length,
      curso: course.nombre,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reporte de promedios por estudiante y materia
 */
export const getAveragesReport = async (req, res, next) => {
  try {
    const { cursoId, materiaId, periodoId } = req.query;

    if (!cursoId) {
      return res.status(400).json({
        error: 'Debe proporcionar cursoId',
      });
    }

    // Verificar acceso al curso
    const courseFilter = await getCourseInstitutionFilter(req, prisma);
    const course = await prisma.course.findFirst({
      where: {
        id: cursoId,
        ...courseFilter,
      },
    });

    if (!course) {
      return res.status(403).json({
        error: 'No tienes acceso a este curso.',
      });
    }

    // Obtener estudiantes del curso
    const students = await prisma.student.findMany({
      where: {
        grupoId: cursoId,
      },
      include: {
        user: {
          select: {
            nombre: true,
            apellido: true,
            numeroIdentificacion: true,
          },
        },
      },
    });

    // Construir filtros para calificaciones
    const gradeWhereClause = {
      estudianteId: { in: students.map(s => s.id) },
    };

    if (materiaId) {
      gradeWhereClause.materiaId = materiaId;
    }

    if (periodoId) {
      gradeWhereClause.subPeriodo = {
        periodoId: periodoId,
      };
    }

    // Obtener todas las calificaciones
    const grades = await prisma.grade.findMany({
      where: gradeWhereClause,
      include: {
        materia: {
          select: {
            id: true,
            nombre: true,
          },
        },
        insumo: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
    });

    // Agrupar por estudiante y materia
    const averagesMap = {};
    students.forEach(student => {
      const studentGrades = grades.filter(g => g.estudianteId === student.id);
      const byMateria = {};

      studentGrades.forEach(grade => {
        const materiaId = grade.materiaId;
        if (!byMateria[materiaId]) {
          byMateria[materiaId] = {
            materia: grade.materia.nombre,
            calificaciones: [],
          };
        }
        byMateria[materiaId].calificaciones.push(grade.calificacion);
      });

      Object.keys(byMateria).forEach(materiaId => {
        const materiaData = byMateria[materiaId];
        const promedio = materiaData.calificaciones.length > 0
          ? Math.floor((materiaData.calificaciones.reduce((a, b) => a + b, 0) / materiaData.calificaciones.length) * 100) / 100
          : 0;

        const key = `${student.id}-${materiaId}`;
        averagesMap[key] = {
          estudiante: `${student.user.nombre} ${student.user.apellido}`,
          identificacion: student.user.numeroIdentificacion || '-',
          curso: course.nombre,
          materia: materiaData.materia,
          promedio: promedio,
          estado: promedio >= 7 ? 'Aprobado' : 'Reprobado',
        };
      });
    });

    const averages = Object.values(averagesMap);

    // Generar datos para gráfico
    const chartData = [
      { rango: '0-4.99', cantidad: averages.filter(a => a.promedio >= 0 && a.promedio < 5).length },
      { rango: '5-6.99', cantidad: averages.filter(a => a.promedio >= 5 && a.promedio < 7).length },
      { rango: '7-8.99', cantidad: averages.filter(a => a.promedio >= 7 && a.promedio < 9).length },
      { rango: '9-10', cantidad: averages.filter(a => a.promedio >= 9).length },
    ];

    res.json({
      averages,
      chartData,
      total: averages.length,
      curso: course.nombre,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reporte de asistencia
 */
export const getAttendanceReport = async (req, res, next) => {
  try {
    const { cursoId, fechaDesde, fechaHasta } = req.query;

    if (!cursoId) {
      return res.status(400).json({
        error: 'Debe proporcionar cursoId',
      });
    }

    // Verificar acceso al curso
    const courseFilter = await getCourseInstitutionFilter(req, prisma);
    const course = await prisma.course.findFirst({
      where: {
        id: cursoId,
        ...courseFilter,
      },
    });

    if (!course) {
      return res.status(403).json({
        error: 'No tienes acceso a este curso.',
      });
    }

    const whereClause = {
      estudiante: {
        grupoId: cursoId,
      },
    };

    if (fechaDesde || fechaHasta) {
      whereClause.fecha = {};
      if (fechaDesde) {
        whereClause.fecha.gte = new Date(fechaDesde);
      }
      if (fechaHasta) {
        whereClause.fecha.lte = new Date(fechaHasta);
      }
    }

    const attendance = await prisma.attendance.findMany({
      where: whereClause,
      include: {
        estudiante: {
          include: {
            user: {
              select: {
                nombre: true,
                apellido: true,
                numeroIdentificacion: true,
              },
            },
          },
        },
      },
      orderBy: [
        { estudiante: { user: { apellido: 'asc' } } },
        { fecha: 'desc' },
      ],
    });

    const formattedAttendance = attendance.map(att => ({
      estudiante: `${att.estudiante.user.nombre} ${att.estudiante.user.apellido}`,
      identificacion: att.estudiante.user.numeroIdentificacion || '-',
      fecha: att.fecha.toISOString().split('T')[0],
      estado: att.estado,
      justificacion: att.justificacion || '',
      observaciones: att.observaciones || '',
    }));

    res.json({
      attendance: formattedAttendance,
      total: formattedAttendance.length,
      curso: course.nombre,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reporte de rendimiento completo
 */
export const getPerformanceReport = async (req, res, next) => {
  try {
    const { cursoId, periodoId } = req.query;

    if (!cursoId) {
      return res.status(400).json({
        error: 'Debe proporcionar cursoId',
      });
    }

    // Verificar acceso al curso
    const courseFilter = await getCourseInstitutionFilter(req, prisma);
    const course = await prisma.course.findFirst({
      where: {
        id: cursoId,
        ...courseFilter,
      },
    });

    if (!course) {
      return res.status(403).json({
        error: 'No tienes acceso a este curso.',
      });
    }

    // Obtener estudiantes del curso
    const students = await prisma.student.findMany({
      where: {
        grupoId: cursoId,
      },
      include: {
        user: {
          select: {
            nombre: true,
            apellido: true,
            numeroIdentificacion: true,
          },
        },
      },
    });

    const performanceData = [];

    for (const student of students) {
      // Calcular promedio general
      const gradeWhereClause = {
        estudianteId: student.id,
      };

      if (periodoId) {
        gradeWhereClause.subPeriodo = {
          periodoId: periodoId,
        };
      }

      const grades = await prisma.grade.findMany({
        where: gradeWhereClause,
        select: {
          calificacion: true,
        },
      });

      const promedioGeneral = grades.length > 0
        ? Math.floor((grades.reduce((a, b) => a + b.calificacion, 0) / grades.length) * 100) / 100
        : 0;

      // Calcular porcentaje de asistencia
      const attendanceWhereClause = {
        estudianteId: student.id,
      };

      if (periodoId) {
        // Obtener fechas del período
        const period = await prisma.period.findUnique({
          where: { id: periodoId },
        });
        if (period) {
          attendanceWhereClause.fecha = {
            gte: period.fechaInicio || undefined,
            lte: period.fechaFin || undefined,
          };
        }
      }

      const attendanceRecords = await prisma.attendance.findMany({
        where: attendanceWhereClause,
        select: {
          estado: true,
        },
      });

      const totalDays = attendanceRecords.length;
      const presentDays = attendanceRecords.filter(a => a.estado === 'ASISTENCIA').length;
      const asistenciaPorcentaje = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

      // Determinar estado general
      let estado = 'Regular';
      if (promedioGeneral >= 9 && asistenciaPorcentaje >= 90) {
        estado = 'Excelente';
      } else if (promedioGeneral >= 7 && asistenciaPorcentaje >= 80) {
        estado = 'Bueno';
      } else if (promedioGeneral < 7 || asistenciaPorcentaje < 70) {
        estado = 'Necesita Mejora';
      }

      performanceData.push({
        estudiante: `${student.user.nombre} ${student.user.apellido}`,
        identificacion: student.user.numeroIdentificacion || '-',
        promedio: promedioGeneral,
        asistencia: asistenciaPorcentaje,
        estado: estado,
      });
    }

    // Generar datos para gráficos
    const estadosCount = {
      'Excelente': performanceData.filter(p => p.estado === 'Excelente').length,
      'Bueno': performanceData.filter(p => p.estado === 'Bueno').length,
      'Regular': performanceData.filter(p => p.estado === 'Regular').length,
      'Necesita Mejora': performanceData.filter(p => p.estado === 'Necesita Mejora').length,
    };

    const chartData = {
      estados: Object.keys(estadosCount).map(key => ({
        name: key,
        value: estadosCount[key],
      })),
      evolucion: [], // Se puede expandir con datos históricos
    };

    res.json({
      performance: performanceData,
      chartData,
      total: performanceData.length,
      curso: course.nombre,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Exportar reporte a PDF (placeholder - requiere librería de PDF)
 */
export const exportToPDF = async (req, res, next) => {
  try {
    // Por ahora retornamos un mensaje indicando que se implementará
    // En producción, usarías una librería como pdfkit o puppeteer
    res.status(501).json({
      error: 'Exportación a PDF próximamente disponible',
    });
  } catch (error) {
    next(error);
  }
};

