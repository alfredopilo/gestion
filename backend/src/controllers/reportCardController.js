import prisma from '../config/database.js';
import { getCourseInstitutionFilter, verifyCourseBelongsToInstitution, getGradeInstitutionFilter, getStudentInstitutionFilter } from '../utils/institutionFilter.js';
import { calculateWeightedAverage, truncate, getGradeScaleEquivalent } from '../utils/gradeCalculations.js';

/**
 * Obtener boletines de calificaciones para estudiantes de un curso
 */
export const getReportCards = async (req, res, next) => {
  try {
    const { cursoId, estudianteIds } = req.query;

    if (!cursoId) {
      return res.status(400).json({
        error: 'Debe proporcionar cursoId.',
      });
    }

    // Verificar acceso al curso
    const hasAccess = await verifyCourseBelongsToInstitution(req, prisma, cursoId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'No tienes acceso a este curso.',
      });
    }

    // Obtener filtro de institución para estudiantes
    const studentInstitutionFilter = await getStudentInstitutionFilter(req, prisma);
    let studentWhere = {};
    
    // Aplicar filtro de institución a estudiantes
    if (Object.keys(studentInstitutionFilter).length > 0) {
      if (studentInstitutionFilter.userId?.in && studentInstitutionFilter.userId.in.length === 0) {
        // No hay estudiantes de la institución
        return res.json({
          data: [],
          periodsGrouped: [],
          total: 0,
        });
      }
      // Aplicar filtro de institución (userId)
      studentWhere.user = {
        id: { in: studentInstitutionFilter.userId.in },
      };
    } else if (req.user?.rol !== 'ADMIN') {
      // Si no hay filtro y no es ADMIN, no mostrar estudiantes
      return res.json({
        data: [],
        periodsGrouped: [],
        total: 0,
      });
    }
    
    // Si se especifican estudianteIds, agregar al filtro
    if (estudianteIds) {
      const estudianteIdsArray = Array.isArray(estudianteIds) ? estudianteIds : [estudianteIds];
      if (studentWhere.user) {
        // Ya hay filtro de institución, combinar con estudianteIds
        const studentsFromIds = await prisma.student.findMany({
          where: { 
            id: { in: estudianteIdsArray },
            user: {
              id: { in: studentInstitutionFilter.userId.in },
            },
          },
          select: { id: true },
        });
        const validStudentIds = studentsFromIds.map(s => s.id);
        if (validStudentIds.length === 0) {
          return res.json({
            data: [],
            periodsGrouped: [],
            total: 0,
          });
        }
        studentWhere.id = { in: validStudentIds };
      } else {
        // Si no hay filtro de institución, usar solo los estudianteIds
        studentWhere.id = { in: estudianteIdsArray };
      }
    }

    // Obtener información del curso
    const curso = await prisma.course.findUnique({
      where: { id: cursoId },
      include: {
        periodo: {
          include: {
            subPeriodos: {
              orderBy: { orden: 'asc' },
            },
          },
        },
        estudiantes: {
          where: {
            grupoId: cursoId,
            ...studentWhere,
          },
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
          orderBy: [
            { user: { apellido: 'asc' } },
            { user: { nombre: 'asc' } },
          ],
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
      return res.status(404).json({
        error: 'Curso no encontrado.',
      });
    }

    // Obtener todas las materias del curso con sus escalas
    const materiasConEscala = curso.course_subject_assignments.map(a => ({
      materia: a.materia,
      gradeScale: a.gradeScale,
    }));
    const materias = materiasConEscala.map(m => m.materia);

    // Obtener todas las calificaciones de los estudiantes del curso
    const materiaIds = materias.map(m => m.id);
    const estudianteIdsArray = curso.estudiantes.map(e => e.id);

    // Aplicar filtro de institución a las calificaciones
    const gradeInstitutionFilter = await getGradeInstitutionFilter(req, prisma);
    const gradeWhere = {
      estudianteId: { in: estudianteIdsArray },
      materiaId: { in: materiaIds },
    };
    
    // Aplicar filtro de institución si existe
    if (Object.keys(gradeInstitutionFilter).length > 0) {
      // Si el filtro tiene un array vacío, no hay calificaciones
      if (gradeInstitutionFilter.estudianteId?.in && gradeInstitutionFilter.estudianteId.in.length === 0) {
        // No hay estudiantes de la institución, devolver boletines vacíos
        return res.json({
          data: curso.estudiantes.map(estudiante => ({
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
              periodo: curso.periodo?.nombre || '-',
            },
            materias: materiasConEscala.map(({ materia, gradeScale }) => ({
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
            })),
            promedioGeneral: null,
          })),
          periodsGrouped: [],
          total: curso.estudiantes.length,
        });
      }
      // Combinar el filtro de institución con el filtro de estudiantes del curso
      // Solo incluir estudiantes que están en ambos arrays
      const filteredStudentIds = estudianteIdsArray.filter(id => 
        gradeInstitutionFilter.estudianteId.in.includes(id)
      );
      if (filteredStudentIds.length === 0) {
        // No hay estudiantes del curso que pertenezcan a la institución
        return res.json({
          data: [],
          periodsGrouped: [],
          total: 0,
        });
      }
      gradeWhere.estudianteId = { in: filteredStudentIds };
    }

    const grades = await prisma.grade.findMany({
      where: gradeWhere,
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
        { estudianteId: 'asc' },
        { materiaId: 'asc' },
        { fechaRegistro: 'desc' },
      ],
    });

    // Obtener el período desde las calificaciones si el curso no tiene período asignado
    let periodoNombre = curso.periodo?.nombre || '-';
    if (periodoNombre === '-' && grades.length > 0) {
      // Intentar obtener el período desde la primera calificación
      const firstGrade = grades[0];
      const periodoFromGrade = firstGrade.subPeriodo?.periodo || firstGrade.insumo?.subPeriodo?.periodo;
      if (periodoFromGrade) {
        periodoNombre = periodoFromGrade.nombre;
      }
    }
    
    // Estructurar datos por estudiante y materia
    const reportCards = curso.estudiantes.map(estudiante => {
      const estudianteGrades = grades.filter(g => g.estudianteId === estudiante.id);
      
      const materiasData = materiasConEscala.map(({ materia, gradeScale }) => {
        const materiaGrades = estudianteGrades.filter(g => g.materiaId === materia.id);
        
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
        materias: materiasData,
        promedioGeneral: materiasData.length > 0
          ? truncate(materiasData.reduce((sum, m) => sum + (m.promedioGeneral || 0), 0) / materiasData.filter(m => m.promedioGeneral !== null).length)
          : null,
      };
    });

    // Construir periodsGrouped basado en el período del curso o desde las calificaciones
    const periodsGrouped = [];
    const subPeriodsMap = new Map();
    
    // Recopilar todos los subperíodos únicos de las calificaciones
    grades.forEach(grade => {
      const subPeriodo = grade.subPeriodo || grade.insumo?.subPeriodo;
      if (subPeriodo) {
        const subPeriodoId = subPeriodo.id;
        if (!subPeriodsMap.has(subPeriodoId)) {
          // Obtener el período desde el subperíodo
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
    
    // Si no hay subperíodos en las calificaciones pero el curso tiene período, usar los del período del curso
    if (subPeriodsMap.size === 0 && curso.periodo && curso.periodo.subPeriodos) {
      curso.periodo.subPeriodos.forEach(subPeriodo => {
        subPeriodsMap.set(subPeriodo.id, {
          subPeriodoId: subPeriodo.id,
          subPeriodoNombre: subPeriodo.nombre,
          subPeriodoOrden: subPeriodo.orden ?? 999,
          subPeriodoPonderacion: subPeriodo.ponderacion || 0,
          periodoId: curso.periodo.id,
          periodoNombre: curso.periodo.nombre,
          periodoOrden: curso.periodo.orden ?? 999,
          periodoPonderacion: curso.periodo.ponderacion || 100,
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
    periodsGrouped.push(...Object.values(periodsByPeriod).sort((a, b) => a.periodoOrden - b.periodoOrden));

    res.json({
      data: reportCards,
      periodsGrouped,
      total: reportCards.length,
    });
  } catch (error) {
    next(error);
  }
};

