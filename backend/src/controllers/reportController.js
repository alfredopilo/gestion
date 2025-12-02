import prisma from '../config/database.js';
import { getCourseInstitutionFilter } from '../utils/institutionFilter.js';

/**
 * Reporte de calificaciones detallado
 */
export const getGradesReport = async (req, res, next) => {
  try {
    const { cursoId, materiaId, periodoId, fechaDesde, fechaHasta, docenteId } = req.query;

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

    // Si es PROFESOR y no se proporciona docenteId, usar su propio ID
    let finalDocenteId = docenteId;
    if (!finalDocenteId && req.user?.rol === 'PROFESOR') {
      const teacher = await prisma.teacher.findUnique({
        where: { userId: req.user.id },
        select: { id: true },
      });
      if (teacher) {
        finalDocenteId = teacher.id;
      }
    }

    // Si hay docenteId, filtrar por las materias asignadas a ese docente en el curso
    let materiaIdsFilter = null;
    if (finalDocenteId) {
      const assignments = await prisma.courseSubjectAssignment.findMany({
        where: {
          cursoId: cursoId,
          docenteId: finalDocenteId,
        },
        select: { materiaId: true },
      });
      const assignedMateriaIds = assignments.map(a => a.materiaId);
      
      if (assignedMateriaIds.length === 0) {
        // Si el docente no tiene asignaciones en este curso, devolver vacío
        return res.json({
          grades: [],
          periodsGrouped: [],
          total: 0,
          curso: course.nombre,
        });
      }
      
      materiaIdsFilter = assignedMateriaIds;
    }

    // Construir filtros
    const whereClause = {
      estudiante: {
        grupoId: cursoId,
      },
    };

    if (materiaId) {
      whereClause.materiaId = materiaId;
      // Si hay filtro de docente, verificar que la materia esté asignada al docente
      if (materiaIdsFilter && !materiaIdsFilter.includes(materiaId)) {
        return res.json({
          grades: [],
          periodsGrouped: [],
          total: 0,
          curso: course.nombre,
        });
      }
    } else if (materiaIdsFilter) {
      // Si hay filtro de docente pero no materia específica, filtrar por todas las materias del docente
      whereClause.materiaId = { in: materiaIdsFilter };
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
            subPeriodo: {
              select: {
                id: true,
                nombre: true,
                orden: true,
                ponderacion: true,
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
        { estudiante: { user: { nombre: 'asc' } } },
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
      const estudianteNombre = `${grade.estudiante.user.apellido} ${grade.estudiante.user.nombre}`;
      const identificacion = grade.estudiante.user.numeroIdentificacion || '-';
      const materiaNombre = grade.materia.nombre;
      const insumoNombre = grade.insumo?.nombre || '-';
      
      // Obtener información del subperíodo y período (usando fallback desde el insumo)
      const insumoSubPeriodo = grade.insumo?.subPeriodo || null;
      const usedSubPeriodo = grade.subPeriodo || insumoSubPeriodo || null;
      const usedPeriodo = usedSubPeriodo?.periodo || grade.subPeriodo?.periodo || insumoSubPeriodo?.periodo || null;
      
      const periodoNombre = usedPeriodo?.nombre || null;
      const subPeriodoNombre = usedSubPeriodo?.nombre || null;
      
      // Si falta información esencial (período, subperíodo o insumo), omitir esta columna
      if (!periodoNombre || !subPeriodoNombre || !insumoNombre || insumoNombre === '-') {
        return;
      }
      
      // Obtener valores de orden (usar valores por defecto si son null)
      const periodoOrden = usedPeriodo?.orden ?? 999;
      const subPeriodoOrden = usedSubPeriodo?.orden ?? 999;
      const insumoOrden = grade.insumo?.orden ?? 999;
      
      // Crear clave única para estudiante + materia
      const rowKey = `${estudianteId}_${materiaId}`;
      
      // Crear clave única para columna (periodo/subperíodo/insumo)
      const colKey = `${periodoNombre}|${subPeriodoNombre}|${insumoNombre}`;
      
      // Obtener ponderaciones
      const subPeriodoPonderacion = usedSubPeriodo?.ponderacion ?? 0;
      const periodoPonderacion = usedPeriodo?.ponderacion ?? 0;
      
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
          subPeriodoId: usedSubPeriodo?.id,
          periodoId: usedPeriodo?.id,
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
      const subPeriodoId = usedSubPeriodo?.id;
      // Intentar obtener periodoId de diferentes formas
      const periodoId = usedPeriodo?.id || usedSubPeriodo?.periodoId;
      
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
    
    // Convertir a array y ordenar por apellido y luego nombre
    const pivotRows = Object.values(pivotData).sort((a, b) => {
      // El formato es "Apellido Nombre", extraer apellido (primera palabra) y nombre (resto)
      const partesA = (a.estudiante || '').trim().split(/\s+/);
      const partesB = (b.estudiante || '').trim().split(/\s+/);
      
      const apellidoA = partesA.length > 0 ? partesA[0] : '';
      const apellidoB = partesB.length > 0 ? partesB[0] : '';
      
      // Comparar por apellido primero
      const comparacionApellido = apellidoA.toLowerCase().localeCompare(apellidoB.toLowerCase());
      if (comparacionApellido !== 0) {
        return comparacionApellido;
      }
      
      // Si los apellidos son iguales, comparar por nombre completo (resto de palabras)
      const nombreA = partesA.slice(1).join(' ').toLowerCase();
      const nombreB = partesB.slice(1).join(' ').toLowerCase();
      const comparacionNombre = nombreA.localeCompare(nombreB);
      if (comparacionNombre !== 0) {
        return comparacionNombre;
      }
      
      // Si todo es igual, ordenar por materia
      return a.materia.localeCompare(b.materia);
    });
    
    // Filtrar columnas: solo incluir aquellas que tienen al menos una calificación
    const columnsWithData = Array.from(columnsMap.keys()).filter(colKey => {
      return pivotRows.some(row => row.calificaciones[colKey]);
    });
    
    // Ordenar columnas por orden: primero periodo, luego subperíodo, luego insumo
    // Solo incluir columnas que tienen datos
    const sortedColumnsData = columnsWithData
      .map(colKey => columnsMap.get(colKey))
      .filter(col => col !== undefined)
      .sort((a, b) => {
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
      // Usar subPeriodoId como clave única para evitar duplicados, o el nombre si no hay ID
      const subPeriodKey = col.subPeriodoId || col.subPeriodoNombre;
      
      if (!columnsByPeriod[col.periodoNombre].subPeriods[subPeriodKey]) {
        columnsByPeriod[col.periodoNombre].subPeriods[subPeriodKey] = {
          subPeriodoNombre: col.subPeriodoNombre,
          subPeriodoOrden: col.subPeriodoOrden,
          subPeriodoId: col.subPeriodoId,
          subPeriodoPonderacion: col.subPeriodoPonderacion,
          columns: [],
        };
      }
      // Solo agregar la columna si no está ya incluida
      if (!columnsByPeriod[col.periodoNombre].subPeriods[subPeriodKey].columns.includes(col.key)) {
        columnsByPeriod[col.periodoNombre].subPeriods[subPeriodKey].columns.push(col.key);
      }
    });

    // Convertir a array y ordenar por orden del período
    const periodsGrouped = Object.values(columnsByPeriod).sort((a, b) => {
      return a.periodoOrden - b.periodoOrden;
    });

    // Convertir subperíodos a arrays ordenados dentro de cada período
    // Ya están filtrados porque solo incluimos columnas con datos
    periodsGrouped.forEach(period => {
      period.subPeriods = Object.values(period.subPeriods)
        .filter(subPeriod => subPeriod.columns.length > 0) // Eliminar subperíodos sin columnas con datos
        .sort((a, b) => {
          return a.subPeriodoOrden - b.subPeriodoOrden;
        });
    });
    
    // Filtrar períodos que no tienen subperíodos con datos
    const filteredPeriodsGrouped = periodsGrouped.filter(period => 
      period.subPeriods && period.subPeriods.length > 0
    );

    res.json({
      grades: pivotRows,
      periodsGrouped: filteredPeriodsGrouped,
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
    const { cursoId, materiaId, periodoId, fechaDesde, fechaHasta, docenteId } = req.query;

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

    // Si es PROFESOR y no se proporciona docenteId, usar su propio ID
    let finalDocenteId = docenteId;
    if (!finalDocenteId && req.user?.rol === 'PROFESOR') {
      const teacher = await prisma.teacher.findUnique({
        where: { userId: req.user.id },
        select: { id: true },
      });
      if (teacher) {
        finalDocenteId = teacher.id;
      }
    }

    // Si hay docenteId, filtrar por las materias asignadas a ese docente en el curso
    let materiaIdsFilter = null;
    if (finalDocenteId) {
      const assignments = await prisma.courseSubjectAssignment.findMany({
        where: {
          cursoId: cursoId,
          docenteId: finalDocenteId,
        },
        select: { materiaId: true },
      });
      const assignedMateriaIds = assignments.map(a => a.materiaId);
      
      if (assignedMateriaIds.length === 0) {
        // Si el docente no tiene asignaciones en este curso, devolver vacío
        return res.json({
          averages: [],
          periodsGrouped: [],
          chartData: [],
          total: 0,
          curso: course.nombre,
        });
      }
      
      materiaIdsFilter = assignedMateriaIds;
    }

    // Construir filtros
    const whereClause = {
      estudiante: {
        grupoId: cursoId,
      },
    };

    if (materiaId) {
      whereClause.materiaId = materiaId;
      // Si hay filtro de docente, verificar que la materia esté asignada al docente
      if (materiaIdsFilter && !materiaIdsFilter.includes(materiaId)) {
        return res.json({
          averages: [],
          periodsGrouped: [],
          chartData: [],
          total: 0,
          curso: course.nombre,
        });
      }
    } else if (materiaIdsFilter) {
      // Si hay filtro de docente pero no materia específica, filtrar por todas las materias del docente
      whereClause.materiaId = { in: materiaIdsFilter };
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

    // Obtener todas las calificaciones con relaciones necesarias
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
            id: true,
            nombre: true,
          },
        },
        insumo: {
          select: {
            id: true,
            nombre: true,
            subPeriodo: {
              select: {
                id: true,
                nombre: true,
                orden: true,
                ponderacion: true,
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
        },
        subPeriodo: {
          select: {
            id: true,
            nombre: true,
            orden: true,
            ponderacion: true,
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
        { estudiante: { user: { nombre: 'asc' } } },
        { materia: { nombre: 'asc' } },
        { fechaRegistro: 'desc' },
      ],
    });

    // Crear estructura de datos similar a getGradesReport pero sin insumos
    const pivotData = {};
    
    grades.forEach(grade => {
      const estudianteId = grade.estudianteId;
      const materiaId = grade.materiaId;
      const estudianteNombre = `${grade.estudiante.user.apellido} ${grade.estudiante.user.nombre}`;
      const identificacion = grade.estudiante.user.numeroIdentificacion || '-';
      const materiaNombre = grade.materia.nombre;
      
      // Obtener información del subperíodo y período
      const usedSubPeriodo = grade.subPeriodo || grade.insumo?.subPeriodo;
      const usedPeriodo = usedSubPeriodo?.periodo;
      
      const periodoNombre = usedPeriodo?.nombre;
      const subPeriodoNombre = usedSubPeriodo?.nombre;
      
      // Si falta información esencial, omitir
      if (!periodoNombre || !subPeriodoNombre) {
        return;
      }
      
      // Crear clave única para estudiante + materia
      const rowKey = `${estudianteId}_${materiaId}`;
      
      if (!pivotData[rowKey]) {
        pivotData[rowKey] = {
          estudiante: estudianteNombre,
          identificacion: identificacion,
          materia: materiaNombre,
          estudianteId: estudianteId,
          materiaId: materiaId,
          // Estructuras para calcular promedios
          subPeriodoGrades: {}, // { subPeriodoId: [calificaciones] }
          periodoGrades: {}, // { periodoId: [calificaciones] }
        };
      }
      
      // Acumular calificaciones por subperíodo y período para calcular promedios
      const subPeriodoId = usedSubPeriodo?.id;
      const periodoId = usedPeriodo?.id;
      
      if (subPeriodoId) {
        if (!pivotData[rowKey].subPeriodoGrades[subPeriodoId]) {
          pivotData[rowKey].subPeriodoGrades[subPeriodoId] = [];
        }
        pivotData[rowKey].subPeriodoGrades[subPeriodoId].push(grade.calificacion);
      }
      
      if (periodoId) {
        if (!pivotData[rowKey].periodoGrades[periodoId]) {
          pivotData[rowKey].periodoGrades[periodoId] = [];
        }
        pivotData[rowKey].periodoGrades[periodoId].push(grade.calificacion);
      }
    });

    // Calcular promedios y crear estructura final
    const averages = [];
    const subPeriodsMap = new Map();
    const periodsMap = new Map();

    Object.values(pivotData).forEach(row => {
      const promediosSubPeriodo = {};
      const promediosPeriodo = {};
      
      // Calcular promedios por subperíodo
      Object.keys(row.subPeriodoGrades).forEach(subPeriodoId => {
        const calificaciones = row.subPeriodoGrades[subPeriodoId];
        if (calificaciones.length > 0) {
          const promedio = calificaciones.reduce((a, b) => a + b, 0) / calificaciones.length;
          const promedioTruncado = Math.floor(promedio * 100) / 100;
          
          // Obtener información del subperíodo para ponderación
          const grade = grades.find(g => {
            const subPeriodo = g.subPeriodo || g.insumo?.subPeriodo;
            return subPeriodo?.id === subPeriodoId;
          });
          
          const subPeriodo = grade?.subPeriodo || grade?.insumo?.subPeriodo;
          const periodo = subPeriodo?.periodo;
          
          if (subPeriodo) {
            const ponderacion = subPeriodo.ponderacion || 0;
            const promedioPonderado = promedioTruncado * (ponderacion / 100);
            
            promediosSubPeriodo[subPeriodoId] = {
              promedio: promedioTruncado,
              promedioPonderado: Math.floor(promedioPonderado * 100) / 100,
              subPeriodoNombre: subPeriodo.nombre,
              subPeriodoOrden: subPeriodo.orden ?? 999,
            };
            
            // Guardar información del subperíodo para estructura de períodos
            if (!subPeriodsMap.has(subPeriodoId)) {
              subPeriodsMap.set(subPeriodoId, {
                subPeriodoId,
                subPeriodoNombre: subPeriodo.nombre,
                subPeriodoOrden: subPeriodo.orden ?? 999,
                subPeriodoPonderacion: ponderacion,
                periodoId: periodo?.id,
                periodoNombre: periodo?.nombre,
                periodoOrden: periodo?.orden ?? 999,
                periodoPonderacion: periodo?.ponderacion ?? 0,
              });
            }
          }
        }
      });
      
      // Calcular promedios por período
      Object.keys(row.periodoGrades).forEach(periodoId => {
        const calificaciones = row.periodoGrades[periodoId];
        if (calificaciones.length > 0) {
          const promedio = calificaciones.reduce((a, b) => a + b, 0) / calificaciones.length;
          const promedioTruncado = Math.floor(promedio * 100) / 100;
          
          // Obtener información del período para ponderación
          const grade = grades.find(g => {
            const periodo = (g.subPeriodo || g.insumo?.subPeriodo)?.periodo;
            return periodo?.id === periodoId;
          });
          
          const periodo = (grade?.subPeriodo || grade?.insumo?.subPeriodo)?.periodo;
          
          if (periodo) {
            const ponderacion = periodo.ponderacion || 0;
            const promedioPonderado = promedioTruncado * (ponderacion / 100);
            
            promediosPeriodo[periodoId] = {
              promedio: promedioTruncado,
              promedioPonderado: Math.floor(promedioPonderado * 100) / 100,
              nombre: periodo.nombre,
            };
            
            // Guardar información del período
            if (!periodsMap.has(periodoId)) {
              periodsMap.set(periodoId, {
                periodoId,
                periodoNombre: periodo.nombre,
                periodoOrden: periodo.orden ?? 999,
                periodoPonderacion: ponderacion,
              });
            }
          }
        }
      });
      
      // Calcular promedio general (promedio de todos los períodos)
      const periodAverages = Object.values(promediosPeriodo).map(p => p.promedio);
      const promedioGeneral = periodAverages.length > 0
        ? Math.floor((periodAverages.reduce((a, b) => a + b, 0) / periodAverages.length) * 100) / 100
        : null;
      
      averages.push({
        ...row,
        promediosSubPeriodo,
        promediosPeriodo,
        promedioGeneral,
      });
    });

    // Crear estructura periodsGrouped (similar a getGradesReport pero sin columnas de insumos)
    const periodsGrouped = [];
    const periodsByPeriod = {};
    
    subPeriodsMap.forEach(subPeriodData => {
      const periodoId = subPeriodData.periodoId;
      if (!periodsByPeriod[periodoId]) {
        periodsByPeriod[periodoId] = {
          periodoId,
          periodoNombre: subPeriodData.periodoNombre,
          periodoOrden: subPeriodData.periodoOrden,
          periodoPonderacion: subPeriodData.periodoPonderacion,
          subPeriods: [],
        };
      }
      
      periodsByPeriod[periodoId].subPeriods.push({
        subPeriodoId: subPeriodData.subPeriodoId,
        subPeriodoNombre: subPeriodData.subPeriodoNombre,
        subPeriodoOrden: subPeriodData.subPeriodoOrden,
        subPeriodoPonderacion: subPeriodData.subPeriodoPonderacion,
        columns: [], // Sin columnas de insumos
      });
    });
    
    // Ordenar subperíodos dentro de cada período
    Object.values(periodsByPeriod).forEach(period => {
      period.subPeriods.sort((a, b) => a.subPeriodoOrden - b.subPeriodoOrden);
    });
    
    // Convertir a array y ordenar por orden de período
    periodsGrouped.push(...Object.values(periodsByPeriod).sort((a, b) => a.periodoOrden - b.periodoOrden));

    // Ordenar averages por apellido y luego nombre
    averages.sort((a, b) => {
      // El formato es "Apellido Nombre", extraer apellido (primera palabra) y nombre (resto)
      const partesA = (a.estudiante || '').trim().split(/\s+/);
      const partesB = (b.estudiante || '').trim().split(/\s+/);
      
      const apellidoA = partesA.length > 0 ? partesA[0] : '';
      const apellidoB = partesB.length > 0 ? partesB[0] : '';
      
      // Comparar por apellido primero
      const comparacionApellido = apellidoA.toLowerCase().localeCompare(apellidoB.toLowerCase());
      if (comparacionApellido !== 0) {
        return comparacionApellido;
      }
      
      // Si los apellidos son iguales, comparar por nombre completo (resto de palabras)
      const nombreA = partesA.slice(1).join(' ').toLowerCase();
      const nombreB = partesB.slice(1).join(' ').toLowerCase();
      const comparacionNombre = nombreA.localeCompare(nombreB);
      if (comparacionNombre !== 0) {
        return comparacionNombre;
      }
      
      // Si todo es igual, ordenar por materia
      return a.materia.localeCompare(b.materia);
    });

    // Generar datos para gráfico
    const chartData = [
      { rango: '0-4.99', cantidad: averages.filter(a => a.promedioGeneral !== null && a.promedioGeneral >= 0 && a.promedioGeneral < 5).length },
      { rango: '5-6.99', cantidad: averages.filter(a => a.promedioGeneral !== null && a.promedioGeneral >= 5 && a.promedioGeneral < 7).length },
      { rango: '7-8.99', cantidad: averages.filter(a => a.promedioGeneral !== null && a.promedioGeneral >= 7 && a.promedioGeneral < 9).length },
      { rango: '9-10', cantidad: averages.filter(a => a.promedioGeneral !== null && a.promedioGeneral >= 9).length },
    ];

    res.json({
      averages,
      periodsGrouped,
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
        { estudiante: { user: { nombre: 'asc' } } },
        { fecha: 'desc' },
      ],
    });

    const formattedAttendance = attendance.map(att => ({
      estudiante: `${att.estudiante.user.apellido} ${att.estudiante.user.nombre}`,
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
        estudiante: `${student.user.apellido} ${student.user.nombre}`,
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


