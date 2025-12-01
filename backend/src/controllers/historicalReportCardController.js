import prisma from '../config/database.js';
import { getStudentInstitutionFilter, verifyStudentBelongsToInstitution } from '../utils/institutionFilter.js';
import { truncate, getGradeScaleEquivalent } from '../utils/gradeCalculations.js';

/**
 * Obtener años lectivos de un estudiante a través de sus enrollments
 */
export const getStudentSchoolYears = async (req, res, next) => {
  try {
    const { id: studentId } = req.params;

    // Verificar acceso
    const hasAccess = await verifyStudentBelongsToInstitution(req, prisma, studentId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'No tienes acceso a este estudiante.',
      });
    }

    // Obtener todos los enrollments del estudiante (incluyendo inactivos/retirados)
    // No filtrar por activo para mostrar histórico completo
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId },
      include: {
        anioLectivo: {
          select: {
            id: true,
            nombre: true,
            ano: true,
            fechaInicio: true,
            fechaFin: true,
            activo: true,
          },
        },
      },
      orderBy: {
        anioLectivo: {
          ano: 'desc',
        },
      },
    });

    // Extraer años lectivos únicos
    const schoolYearsMap = new Map();
    enrollments.forEach(enrollment => {
      if (enrollment.anioLectivo && !schoolYearsMap.has(enrollment.anioLectivo.id)) {
        schoolYearsMap.set(enrollment.anioLectivo.id, enrollment.anioLectivo);
      }
    });

    const schoolYears = Array.from(schoolYearsMap.values());

    res.json({
      data: schoolYears,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generar boletín para un estudiante y curso específico en un año lectivo
 * Reutiliza la lógica de getReportCards pero adaptada para un estudiante específico
 */
const generateReportCardForCourse = async (studentId, courseId, anioLectivoId) => {
  // Obtener información del curso
  const curso = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      periodo: {
        include: {
          subPeriodos: {
            orderBy: { orden: 'asc' },
          },
        },
      },
      anioLectivo: {
        select: {
          id: true,
          nombre: true,
          ano: true,
        },
      },
      course_subject_assignments: {
        include: {
          materia: {
            select: {
              id: true,
              nombre: true,
              codigo: true,
            },
          },
          gradeScale: {
            include: {
              detalles: {
                orderBy: { orden: 'asc' },
              },
            },
          },
        },
      },
    },
  });

  if (!curso || curso.anioLectivoId !== anioLectivoId) {
    return null;
  }

  // Obtener información del estudiante
  const estudiante = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      user: {
        select: {
          nombre: true,
          apellido: true,
          numeroIdentificacion: true,
          email: true,
        },
      },
    },
  });

  if (!estudiante) {
    return null;
  }

  // Obtener todas las materias del curso con sus escalas
  const materiasConEscala = curso.course_subject_assignments.map(a => ({
    materia: a.materia,
    gradeScale: a.gradeScale,
  }));
  const materias = materiasConEscala.map(m => m.materia);
  const materiaIds = materias.map(m => m.id);

  // Obtener períodos del año lectivo
  const periods = await prisma.period.findMany({
    where: { anioLectivoId },
    include: {
      subPeriodos: {
        orderBy: { orden: 'asc' },
      },
    },
    orderBy: { orden: 'asc' },
  });

  // Obtener todos los subperíodos del año lectivo
  const allSubPeriodIds = periods.flatMap(p => p.subPeriodos.map(sp => sp.id));

  // Obtener calificaciones del estudiante en las materias del curso
  // Filtrar por subperíodos que pertenecen al año lectivo
  const grades = await prisma.grade.findMany({
    where: {
      estudianteId: studentId,
      materiaId: { in: materiaIds },
      OR: [
        { subPeriodoId: { in: allSubPeriodIds } },
        {
          insumo: {
            subPeriodo: {
              id: { in: allSubPeriodIds },
            },
          },
        },
      ],
    },
    include: {
      materia: {
        select: {
          id: true,
          nombre: true,
          codigo: true,
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
    },
    orderBy: [
      { materiaId: 'asc' },
      { fechaRegistro: 'desc' },
    ],
  });

  // Obtener el período desde las calificaciones si el curso no tiene período asignado
  let periodoNombre = curso.periodo?.nombre || '-';
  if (periodoNombre === '-' && grades.length > 0) {
    const firstGrade = grades[0];
    const periodoFromGrade = firstGrade.subPeriodo?.periodo || firstGrade.insumo?.subPeriodo?.periodo;
    if (periodoFromGrade) {
      periodoNombre = periodoFromGrade.nombre;
    }
  }

  // Estructurar datos por materia
  const materiasData = materiasConEscala.map(({ materia, gradeScale }) => {
    const materiaGrades = grades.filter(g => g.materiaId === materia.id);
    
    if (materiaGrades.length === 0) {
      return {
        materia: {
          id: materia.id,
          nombre: materia.nombre,
          codigo: materia.codigo,
        },
        gradeScale: gradeScale,
        promediosSubPeriodo: {},
        promediosPeriodo: {},
        promedioGeneral: null,
        equivalenteGeneral: null,
        calificaciones: [],
      };
    }

    // Agrupar calificaciones por subperíodo
    const gradesBySubPeriod = {};
    materiaGrades.forEach(grade => {
      const subPeriodo = grade.subPeriodo || grade.insumo?.subPeriodo;
      if (subPeriodo) {
        const subPeriodoId = subPeriodo.id;
        if (!gradesBySubPeriod[subPeriodoId]) {
          gradesBySubPeriod[subPeriodoId] = {
            subPeriodo: subPeriodo,
            calificaciones: [],
          };
        }
        gradesBySubPeriod[subPeriodoId].calificaciones.push(grade.calificacion);
      }
    });

    // Calcular promedios por subperíodo
    const promediosSubPeriodo = {};
    Object.keys(gradesBySubPeriod).forEach(subPeriodoId => {
      const data = gradesBySubPeriod[subPeriodoId];
      if (data.calificaciones.length > 0) {
        const promedio = data.calificaciones.reduce((sum, cal) => sum + cal, 0) / data.calificaciones.length;
        const promedioTruncado = truncate(promedio);
        const ponderacion = data.subPeriodo.ponderacion || 0;
        const promedioPonderado = promedioTruncado * (ponderacion / 100);
        
        const equivalenteSubPeriodo = getGradeScaleEquivalent(gradeScale, promedioTruncado);
        promediosSubPeriodo[subPeriodoId] = {
          subPeriodoNombre: data.subPeriodo.nombre,
          promedio: promedioTruncado,
          promedioPonderado: truncate(promedioPonderado),
          ponderacion: ponderacion,
          equivalente: equivalenteSubPeriodo,
        };
      }
    });

    // Calcular promedios por período
    const promediosPeriodo = {};
    const gradesByPeriod = {};
    
    Object.keys(gradesBySubPeriod).forEach(subPeriodoId => {
      const data = gradesBySubPeriod[subPeriodoId];
      const periodoId = data.subPeriodo.periodo?.id;
      if (periodoId) {
        if (!gradesByPeriod[periodoId]) {
          gradesByPeriod[periodoId] = {
            periodo: data.subPeriodo.periodo,
            subPeriodos: [],
          };
        }
        gradesByPeriod[periodoId].subPeriodos.push({
          subPeriodoId,
          promedio: promediosSubPeriodo[subPeriodoId]?.promedio || 0,
          ponderacion: data.subPeriodo.ponderacion || 0,
        });
      }
    });

    Object.keys(gradesByPeriod).forEach(periodoId => {
      const data = gradesByPeriod[periodoId];
      let sumaPonderada = 0;
      let sumaPonderacion = 0;
      
      data.subPeriodos.forEach(sub => {
        const promedio = promediosSubPeriodo[sub.subPeriodoId]?.promedio || 0;
        sumaPonderada += promedio * (sub.ponderacion / 100);
        sumaPonderacion += sub.ponderacion / 100;
      });
      
      const promedioPeriodo = sumaPonderacion > 0 ? sumaPonderada / sumaPonderacion : 0;
      const promedioPeriodoTruncado = truncate(promedioPeriodo);
      const periodoPonderacion = data.periodo.ponderacion || 100;
      const promedioPonderado = promedioPeriodoTruncado * (periodoPonderacion / 100);
      
      const equivalentePeriodo = getGradeScaleEquivalent(gradeScale, promedioPeriodoTruncado);
      promediosPeriodo[periodoId] = {
        periodoNombre: data.periodo.nombre,
        promedio: promedioPeriodoTruncado,
        promedioPonderado: truncate(promedioPonderado),
        ponderacion: periodoPonderacion,
        equivalente: equivalentePeriodo,
      };
    });

    // Calcular promedio general
    const periodAverages = Object.values(promediosPeriodo);
    let promedioGeneral = null;
    
    if (periodAverages.length > 0) {
      let sumaPonderada = 0;
      periodAverages.forEach(period => {
        sumaPonderada += period.promedioPonderado;
      });
      promedioGeneral = truncate(sumaPonderada);
    }

    const equivalenteGeneral = getGradeScaleEquivalent(gradeScale, promedioGeneral);
    return {
      materia: {
        id: materia.id,
        nombre: materia.nombre,
        codigo: materia.codigo,
      },
      gradeScale: gradeScale,
      promediosSubPeriodo,
      promediosPeriodo,
      promedioGeneral,
      equivalenteGeneral: equivalenteGeneral,
      calificaciones: materiaGrades.map(g => ({
        id: g.id,
        calificacion: g.calificacion,
        subPeriodo: g.subPeriodo?.nombre || g.insumo?.subPeriodo?.nombre || '-',
        periodo: g.subPeriodo?.periodo?.nombre || g.insumo?.subPeriodo?.periodo?.nombre || '-',
        insumo: g.insumo?.nombre || null,
        fechaRegistro: g.fechaRegistro,
      })),
    };
  });

  // Construir periodsGrouped basado en los períodos del año lectivo
  const periodsGrouped = [];
  const subPeriodsMap = new Map();
  
  // Recopilar todos los subperíodos únicos de las calificaciones
  grades.forEach(grade => {
    const subPeriodo = grade.subPeriodo || grade.insumo?.subPeriodo;
    if (subPeriodo) {
      const subPeriodoId = subPeriodo.id;
      if (!subPeriodsMap.has(subPeriodoId)) {
        const periodo = subPeriodo.periodo;
        subPeriodsMap.set(subPeriodoId, {
          subPeriodoId: subPeriodo.id,
          subPeriodoNombre: subPeriodo.nombre,
          subPeriodoOrden: subPeriodo.orden ?? 999,
          subPeriodoPonderacion: subPeriodo.ponderacion || 0,
          periodoId: periodo?.id || 'default',
          periodoNombre: periodo?.nombre || periodoNombre !== '-' ? periodoNombre : 'Período',
          periodoOrden: periodo?.orden ?? 999,
          periodoPonderacion: periodo?.ponderacion || 100,
        });
      }
    }
  });
  
  // Si no hay subperíodos en las calificaciones pero hay períodos del año lectivo, usar esos
  if (subPeriodsMap.size === 0 && periods.length > 0) {
    periods.forEach(period => {
      period.subPeriodos.forEach(subPeriodo => {
        subPeriodsMap.set(subPeriodo.id, {
          subPeriodoId: subPeriodo.id,
          subPeriodoNombre: subPeriodo.nombre,
          subPeriodoOrden: subPeriodo.orden ?? 999,
          subPeriodoPonderacion: subPeriodo.ponderacion || 0,
          periodoId: period.id,
          periodoNombre: period.nombre,
          periodoOrden: period.orden ?? 999,
          periodoPonderacion: period.ponderacion || 100,
        });
      });
    });
  }
  
  // Agrupar por período
  const periodsByPeriod = {};
  subPeriodsMap.forEach(subPeriodData => {
    const periodoId = subPeriodData.periodoId || 'default';
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
    });
  });
  
  // Ordenar subperíodos dentro de cada período
  Object.values(periodsByPeriod).forEach(period => {
    period.subPeriods.sort((a, b) => a.subPeriodoOrden - b.subPeriodoOrden);
  });
  
  // Convertir a array y ordenar por orden de período
  const periodsGroupedArray = Object.values(periodsByPeriod).sort((a, b) => a.periodoOrden - b.periodoOrden);

  const promedioGeneralEstudiante = materiasData.length > 0
    ? truncate(materiasData.reduce((sum, m) => sum + (m.promedioGeneral || 0), 0) / materiasData.filter(m => m.promedioGeneral !== null).length)
    : null;

  return {
    estudiante: {
      id: estudiante.id,
      nombre: estudiante.user.nombre,
      apellido: estudiante.user.apellido,
      numeroIdentificacion: estudiante.user.numeroIdentificacion || '-',
      email: estudiante.user.email || '-',
    },
    curso: {
      id: curso.id,
      nombre: curso.nombre,
      nivel: curso.nivel,
      paralelo: curso.paralelo,
      periodo: periodoNombre,
    },
    anioLectivo: {
      id: curso.anioLectivo.id,
      nombre: curso.anioLectivo.nombre,
      ano: curso.anioLectivo.ano,
    },
    materias: materiasData,
    promedioGeneral: promedioGeneralEstudiante,
    periodsGrouped: periodsGroupedArray,
  };
};

/**
 * Obtener boletines históricos de calificaciones para un estudiante
 */
export const getHistoricalReportCards = async (req, res, next) => {
  try {
    const { estudianteId, anioLectivoId } = req.query;

    if (!estudianteId) {
      return res.status(400).json({
        error: 'Debe proporcionar estudianteId.',
      });
    }

    // Verificar acceso al estudiante
    const hasAccess = await verifyStudentBelongsToInstitution(req, prisma, estudianteId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'No tienes acceso a este estudiante.',
      });
    }

    // Obtener enrollments del estudiante (incluyendo inactivos/retirados)
    // No filtrar por activo para mostrar histórico completo
    let enrollmentsWhere = { studentId: estudianteId };
    
    // Si se especifica año lectivo, filtrar por ese año
    if (anioLectivoId) {
      enrollmentsWhere.anioLectivoId = anioLectivoId;
    }

    const enrollments = await prisma.enrollment.findMany({
      where: enrollmentsWhere,
      include: {
        curso: {
          select: {
            id: true,
            nombre: true,
            nivel: true,
            paralelo: true,
            anioLectivoId: true,
          },
        },
        anioLectivo: {
          select: {
            id: true,
            nombre: true,
            ano: true,
          },
        },
      },
      orderBy: {
        anioLectivo: {
          ano: 'desc',
        },
      },
    });

    if (enrollments.length === 0) {
      return res.json({
        data: [],
        total: 0,
      });
    }

    // Agrupar enrollments por año lectivo
    const enrollmentsBySchoolYear = {};
    enrollments.forEach(enrollment => {
      const anioLectivoKey = enrollment.anioLectivoId;
      if (!enrollmentsBySchoolYear[anioLectivoKey]) {
        enrollmentsBySchoolYear[anioLectivoKey] = {
          anioLectivo: enrollment.anioLectivo,
          enrollments: [],
        };
      }
      enrollmentsBySchoolYear[anioLectivoKey].enrollments.push(enrollment);
    });

    // Generar boletines para cada curso en cada año lectivo
    const reportCards = [];
    for (const [anioLectivoKey, schoolYearData] of Object.entries(enrollmentsBySchoolYear)) {
      for (const enrollment of schoolYearData.enrollments) {
        const reportCard = await generateReportCardForCourse(
          estudianteId,
          enrollment.cursoId,
          enrollment.anioLectivoId
        );
        
        if (reportCard) {
          reportCards.push(reportCard);
        }
      }
    }

    res.json({
      data: reportCards,
      total: reportCards.length,
    });
  } catch (error) {
    console.error('Error al obtener boletines históricos:', error);
    next(error);
  }
};

