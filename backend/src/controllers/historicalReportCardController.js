import prisma from '../config/database.js';
import { getStudentInstitutionFilter, verifyStudentBelongsToInstitution } from '../utils/institutionFilter.js';
import { calculateAveragesByMateria, truncate, getGradeScaleEquivalent } from '../utils/gradeCalculations.js';

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

    const schoolYearsMap = new Map();

    // 1. Obtener años lectivos desde enrollments
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
    });

    console.log(`[getStudentSchoolYears] Enrollments encontrados: ${enrollments.length}`);
    
    enrollments.forEach(enrollment => {
      if (enrollment.anioLectivo && !schoolYearsMap.has(enrollment.anioLectivo.id)) {
        schoolYearsMap.set(enrollment.anioLectivo.id, enrollment.anioLectivo);
      }
    });

    // 2. Si no hay enrollments, buscar años lectivos desde cursos donde el estudiante está asignado
    // Esto cubre casos donde el estudiante tiene calificaciones/cursos pero no enrollments formales
    if (schoolYearsMap.size === 0) {
      console.log(`[getStudentSchoolYears] No hay enrollments, buscando desde cursos asignados...`);
      
      const student = await prisma.student.findUnique({
        where: { id: studentId },
        include: {
          grupo: {
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
          },
        },
      });

      if (student?.grupo?.anioLectivo && !schoolYearsMap.has(student.grupo.anioLectivo.id)) {
        schoolYearsMap.set(student.grupo.anioLectivo.id, student.grupo.anioLectivo);
        console.log(`[getStudentSchoolYears] Encontrado año lectivo desde curso asignado: ${student.grupo.anioLectivo.nombre}`);
      }

      // 3. También buscar desde las calificaciones del estudiante
      // Las materias tienen anioLectivoId, así que podemos obtenerlos directamente
      const grades = await prisma.grade.findMany({
        where: { estudianteId: studentId },
        include: {
          materia: {
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
          },
        },
        distinct: ['materiaId'],
      });

      // Extraer años lectivos únicos de las materias de las calificaciones
      grades.forEach(grade => {
        if (grade.materia?.anioLectivo && !schoolYearsMap.has(grade.materia.anioLectivo.id)) {
          schoolYearsMap.set(grade.materia.anioLectivo.id, grade.materia.anioLectivo);
          console.log(`[getStudentSchoolYears] Encontrado año lectivo desde calificaciones: ${grade.materia.anioLectivo.nombre}`);
        }
      });
    }

    const schoolYears = Array.from(schoolYearsMap.values()).sort((a, b) => {
      // Ordenar por año descendente
      return (b.ano || 0) - (a.ano || 0);
    });

    console.log(`[getStudentSchoolYears] Total años lectivos encontrados: ${schoolYears.length}`);
    schoolYears.forEach((sy, idx) => {
      console.log(`[getStudentSchoolYears] Año lectivo ${idx + 1}: ${sy.nombre} (${sy.ano})`);
    });

    res.json({
      data: schoolYears,
    });
  } catch (error) {
    console.error('[getStudentSchoolYears] Error:', error);
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

  if (!curso) {
    console.log(`[HistoricalReportCards] ERROR: Curso con ID ${courseId} no encontrado`);
    return null;
  }
  
  if (curso.anioLectivoId !== anioLectivoId) {
    console.log(`[HistoricalReportCards] ADVERTENCIA: Curso ${courseId} (${curso.nombre}) pertenece al año lectivo ${curso.anioLectivoId}, pero se esperaba ${anioLectivoId}`);
    // Continuar de todas formas, puede haber una inconsistencia pero queremos mostrar los datos
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
    console.log(`[HistoricalReportCards] ERROR: Estudiante con ID ${studentId} no encontrado`);
    return null;
  }
  
  console.log(`[HistoricalReportCards] Generando boletín para: Estudiante=${estudiante.user.nombre} ${estudiante.user.apellido}, Curso=${curso.nombre}, AñoLectivo=${anioLectivoId}`);

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

  // Log para depuración
  console.log(`[HistoricalReportCards] Año lectivo ${anioLectivoId} - Períodos encontrados: ${periods.length}`);
  if (periods.length > 0) {
    periods.forEach((p, idx) => {
      console.log(`[HistoricalReportCards] Período ${idx + 1}: ${p.nombre} (${p.subPeriodos.length} subperíodos)`);
    });
  }

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

    // Usar función centralizada para calcular promedios
    const { promediosSubPeriodo, promediosPeriodo, promedioGeneral } = calculateAveragesByMateria(materiaGrades);

    // Agregar equivalentes de escala a los promedios calculados
    Object.keys(promediosSubPeriodo).forEach(subPeriodoId => {
      const equivalente = getGradeScaleEquivalent(gradeScale, promediosSubPeriodo[subPeriodoId].promedio);
      promediosSubPeriodo[subPeriodoId].equivalente = equivalente;
    });

    Object.keys(promediosPeriodo).forEach(periodoId => {
      const equivalente = getGradeScaleEquivalent(gradeScale, promediosPeriodo[periodoId].promedio);
      promediosPeriodo[periodoId].equivalente = equivalente;
    });

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
  // Siempre usar los períodos del año lectivo, incluso si no hay calificaciones
  const periodsByPeriod = {};
  
  // Primero, construir desde los períodos del año lectivo para asegurar que todos se muestren
  if (periods.length > 0) {
    periods.forEach(period => {
      const periodoId = period.id;
      if (!periodsByPeriod[periodoId]) {
        periodsByPeriod[periodoId] = {
          periodoId: periodoId,
          periodoNombre: period.nombre,
          periodoOrden: period.orden ?? 999,
          periodoPonderacion: period.ponderacion || 100,
          subPeriods: [],
        };
      }
      
      // Agregar todos los subperíodos del período
      period.subPeriodos.forEach(subPeriodo => {
        // Evitar duplicados
        if (!periodsByPeriod[periodoId].subPeriods.find(sp => sp.subPeriodoId === subPeriodo.id)) {
          periodsByPeriod[periodoId].subPeriods.push({
            subPeriodoId: subPeriodo.id,
            subPeriodoNombre: subPeriodo.nombre,
            subPeriodoOrden: subPeriodo.orden ?? 999,
            subPeriodoPonderacion: subPeriodo.ponderacion || 0,
          });
        }
      });
    });
  }
  
  // También recopilar subperíodos de las calificaciones para asegurar que se incluyan
  // incluso si no están en los períodos configurados (por si acaso)
  const subPeriodsFromGrades = new Map();
  grades.forEach(grade => {
    const subPeriodo = grade.subPeriodo || grade.insumo?.subPeriodo;
    if (subPeriodo) {
      const subPeriodoId = subPeriodo.id;
      if (!subPeriodsFromGrades.has(subPeriodoId)) {
        const periodo = subPeriodo.periodo;
        const periodoId = periodo?.id || 'default';
        
        if (!periodsByPeriod[periodoId]) {
          periodsByPeriod[periodoId] = {
            periodoId: periodoId,
            periodoNombre: periodo?.nombre || periodoNombre !== '-' ? periodoNombre : 'Período',
            periodoOrden: periodo?.orden ?? 999,
            periodoPonderacion: periodo?.ponderacion || 100,
            subPeriods: [],
          };
        }
        
        // Agregar subperíodo si no existe
        if (!periodsByPeriod[periodoId].subPeriods.find(sp => sp.subPeriodoId === subPeriodoId)) {
          periodsByPeriod[periodoId].subPeriods.push({
            subPeriodoId: subPeriodo.id,
            subPeriodoNombre: subPeriodo.nombre,
            subPeriodoOrden: subPeriodo.orden ?? 999,
            subPeriodoPonderacion: subPeriodo.ponderacion || 0,
          });
        }
        
        subPeriodsFromGrades.set(subPeriodoId, true);
      }
    }
  });
  
  // Ordenar subperíodos dentro de cada período
  Object.values(periodsByPeriod).forEach(period => {
    period.subPeriods.sort((a, b) => a.subPeriodoOrden - b.subPeriodoOrden);
  });
  
  // Convertir a array y ordenar por orden de período
  const periodsGroupedArray = Object.values(periodsByPeriod).sort((a, b) => a.periodoOrden - b.periodoOrden);
  
  // Log para depuración
  console.log(`[HistoricalReportCards] Períodos agrupados finales: ${periodsGroupedArray.length}`);
  if (periodsGroupedArray.length > 0) {
    periodsGroupedArray.forEach((pg, idx) => {
      console.log(`[HistoricalReportCards] Período agrupado ${idx + 1}: ${pg.periodoNombre} (${pg.subPeriods.length} subperíodos)`);
    });
  } else {
    console.log(`[HistoricalReportCards] ADVERTENCIA: No se generaron períodos agrupados para el año lectivo ${anioLectivoId}`);
  }

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
    const anioLectivoIdParam = anioLectivoId; // Guardar para uso posterior
    
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

    console.log(`[HistoricalReportCards] Enrollments encontrados para estudiante ${estudianteId}: ${enrollments.length}`);
    
    // Preparar estructura para agrupar cursos por año lectivo
    const coursesBySchoolYear = {};
    
    // 1. Si hay enrollments, usarlos
    if (enrollments.length > 0) {
      enrollments.forEach((enr, idx) => {
        console.log(`[HistoricalReportCards] Enrollment ${idx + 1}: cursoId=${enr.cursoId}, cursoNombre=${enr.curso?.nombre}, anioLectivoId=${enr.anioLectivoId}`);
        
        const anioLectivoKey = enr.anioLectivoId;
        if (!coursesBySchoolYear[anioLectivoKey]) {
          coursesBySchoolYear[anioLectivoKey] = {
            anioLectivo: enr.anioLectivo,
            courses: [],
          };
        }
        
        // Agregar curso si no está ya en la lista
        if (enr.cursoId && !coursesBySchoolYear[anioLectivoKey].courses.find(c => c.id === enr.cursoId)) {
          coursesBySchoolYear[anioLectivoKey].courses.push({
            id: enr.cursoId,
            nombre: enr.curso?.nombre,
            nivel: enr.curso?.nivel,
            paralelo: enr.curso?.paralelo,
            anioLectivoId: enr.anioLectivoId,
          });
        }
      });
    } else {
      console.log(`[HistoricalReportCards] No se encontraron enrollments, buscando cursos desde otras fuentes...`);
      
      // 2. Buscar desde el curso asignado directamente al estudiante
      const student = await prisma.student.findUnique({
        where: { id: estudianteId },
        include: {
          grupo: {
            include: {
              anioLectivo: {
                select: {
                  id: true,
                  nombre: true,
                  ano: true,
                },
              },
            },
          },
        },
      });

      if (student?.grupo) {
        const cursoId = student.grupo.id;
        const anioLectivoId = student.grupo.anioLectivoId;
        
        // Filtrar por año lectivo si se especificó
        if (anioLectivoIdParam && anioLectivoId !== anioLectivoIdParam) {
          console.log(`[HistoricalReportCards] Curso asignado pertenece a año lectivo diferente (${anioLectivoId}), filtrando...`);
        } else {
          console.log(`[HistoricalReportCards] Encontrado curso asignado directamente: ${cursoId} en año lectivo ${anioLectivoId}`);
          
          if (!coursesBySchoolYear[anioLectivoId]) {
            coursesBySchoolYear[anioLectivoId] = {
              anioLectivo: student.grupo.anioLectivo,
              courses: [],
            };
          }
          
          if (!coursesBySchoolYear[anioLectivoId].courses.find(c => c.id === cursoId)) {
            coursesBySchoolYear[anioLectivoId].courses.push({
              id: cursoId,
              nombre: student.grupo.nombre,
              nivel: student.grupo.nivel,
              paralelo: student.grupo.paralelo,
              anioLectivoId: anioLectivoId,
            });
          }
        }
      }

      // 3. Buscar cursos desde las calificaciones del estudiante
      const grades = await prisma.grade.findMany({
        where: { estudianteId: estudianteId },
        include: {
          materia: {
            include: {
              asignaciones: {
                include: {
                  curso: {
                    include: {
                      anioLectivo: {
                        select: {
                          id: true,
                          nombre: true,
                          ano: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        distinct: ['materiaId'],
      });

      console.log(`[HistoricalReportCards] Calificaciones encontradas: ${grades.length}`);
      
      grades.forEach(grade => {
        grade.materia?.asignaciones?.forEach(assignment => {
          const curso = assignment.curso;
          if (curso && curso.anioLectivo) {
            const anioLectivoId = curso.anioLectivo.id;
            
            // Filtrar por año lectivo si se especificó
            if (anioLectivoIdParam && anioLectivoId !== anioLectivoIdParam) {
              return;
            }
            
            if (!coursesBySchoolYear[anioLectivoId]) {
              coursesBySchoolYear[anioLectivoId] = {
                anioLectivo: curso.anioLectivo,
                courses: [],
              };
            }
            
            if (!coursesBySchoolYear[anioLectivoId].courses.find(c => c.id === curso.id)) {
              coursesBySchoolYear[anioLectivoId].courses.push({
                id: curso.id,
                nombre: curso.nombre,
                nivel: curso.nivel,
                paralelo: curso.paralelo,
                anioLectivoId: anioLectivoId,
              });
              console.log(`[HistoricalReportCards] Agregado curso desde calificaciones: ${curso.nombre} en año lectivo ${curso.anioLectivo.nombre}`);
            }
          }
        });
      });
    }

    // Si aún no hay cursos, devolver vacío
    if (Object.keys(coursesBySchoolYear).length === 0) {
      console.log(`[HistoricalReportCards] ADVERTENCIA: No se encontraron cursos para el estudiante ${estudianteId}`);
      return res.json({
        data: [],
        total: 0,
      });
    }

    // Generar boletines para cada curso en cada año lectivo
    const reportCards = [];
    for (const [anioLectivoKey, schoolYearData] of Object.entries(coursesBySchoolYear)) {
      console.log(`[HistoricalReportCards] Procesando año lectivo ${anioLectivoKey} con ${schoolYearData.courses.length} cursos`);
      for (const course of schoolYearData.courses) {
        console.log(`[HistoricalReportCards] Generando boletín para cursoId=${course.id}, anioLectivoId=${course.anioLectivoId}`);
        const reportCard = await generateReportCardForCourse(
          estudianteId,
          course.id,
          course.anioLectivoId
        );
        
        if (reportCard) {
          console.log(`[HistoricalReportCards] Boletín generado exitosamente para curso ${course.nombre}`);
          reportCards.push(reportCard);
        } else {
          console.log(`[HistoricalReportCards] ADVERTENCIA: No se pudo generar boletín para cursoId=${course.id}, anioLectivoId=${course.anioLectivoId}`);
        }
      }
    }
    
    console.log(`[HistoricalReportCards] Total de boletines generados: ${reportCards.length}`);

    res.json({
      data: reportCards,
      total: reportCards.length,
    });
  } catch (error) {
    console.error('Error al obtener boletines históricos:', error);
    next(error);
  }
};

