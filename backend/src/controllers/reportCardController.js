import prisma from '../config/database.js';
import { getCourseInstitutionFilter, verifyCourseBelongsToInstitution, getGradeInstitutionFilter, getStudentInstitutionFilter } from '../utils/institutionFilter.js';
import { calculateAveragesByMateria, truncate, getGradeScaleEquivalent } from '../utils/gradeCalculations.js';

/**
 * Obtener boletines de calificaciones para estudiantes de un curso
 */
export const getReportCards = async (req, res, next) => {
  try {
    const { cursoId, estudianteIds, includeAttendance } = req.query;
    const wantAttendance = includeAttendance === '1' || includeAttendance === 'true';

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

    // Obtener información del curso (anioLectivo solo si se pide asistencia)
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
        ...(wantAttendance ? { anioLectivo: { select: { fechaInicio: true, fechaFin: true } } } : {}),
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
                cualitativa: true,
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
                cualitativa: materia.cualitativa ?? false,
              },
              gradeScale: gradeScale,
              promediosSubPeriodo: {},
              promediosPeriodo: {},
              promedioGeneral: null,
              equivalenteGeneral: null,
              calificaciones: [],
            })),
            promedioGeneral: null,
            ...(wantAttendance ? { asistencia: { resumen: { total: 0, asistencias: 0, faltas: 0, justificadas: 0, tardes: 0, porcentajeAsistencia: 0 } } } : {}),
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
              cualitativa: materia.cualitativa ?? false,
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
            cualitativa: materia.cualitativa ?? false,
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
          // Si no hay período, usar un identificador único basado en el subperíodo
          const periodoId = periodo?.id || `subperiod-${subPeriodoId}`;
          const periodoNombre = periodo?.nombre || `Período de ${subPeriodo.nombre}`;
          subPeriodsMap.set(subPeriodoId, {
            subPeriodoId: subPeriodo.id,
            subPeriodoNombre: subPeriodo.nombre,
            subPeriodoOrden: subPeriodo.orden ?? 999,
            subPeriodoPonderacion: subPeriodo.ponderacion || 0,
            periodoId: periodoId,
            periodoNombre: periodoNombre,
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
      // Usar periodoId como clave, asegurando que sea único
      const periodoId = subPeriodData.periodoId || `default-${subPeriodData.subPeriodoId}`;
      if (!periodsByPeriod[periodoId]) {
        periodsByPeriod[periodoId] = {
          periodoId,
          periodoNombre: subPeriodData.periodoNombre,
          periodoOrden: subPeriodData.periodoOrden,
          periodoPonderacion: subPeriodData.periodoPonderacion,
          subPeriods: [],
        };
      }
      
      // Verificar que el subperíodo no esté ya en la lista (evitar duplicados)
      const exists = periodsByPeriod[periodoId].subPeriods.some(
        sp => sp.subPeriodoId === subPeriodData.subPeriodoId
      );
      if (!exists) {
        periodsByPeriod[periodoId].subPeriods.push({
          subPeriodoId: subPeriodData.subPeriodoId,
          subPeriodoNombre: subPeriodData.subPeriodoNombre,
          subPeriodoOrden: subPeriodData.subPeriodoOrden,
          subPeriodoPonderacion: subPeriodData.subPeriodoPonderacion,
        });
      }
    });
    
    // Ordenar subperíodos dentro de cada período
    Object.values(periodsByPeriod).forEach(period => {
      period.subPeriods.sort((a, b) => a.subPeriodoOrden - b.subPeriodoOrden);
    });
    
    // Convertir a array y ordenar por orden de período
    periodsGrouped.push(...Object.values(periodsByPeriod).sort((a, b) => a.periodoOrden - b.periodoOrden));

    // Si se pidió asistencia, obtener resumen por estudiante filtrado por fechas del año lectivo
    let dataToSend = reportCards;
    if (wantAttendance && curso.anioLectivo) {
      const fechaInicio = curso.anioLectivo.fechaInicio;
      const fechaFin = curso.anioLectivo.fechaFin;
      const attendanceWhere = {
        fecha: { gte: fechaInicio, lte: fechaFin },
        estudianteId: { in: estudianteIdsArray },
      };
      const attendanceRecords = await prisma.attendance.findMany({
        where: attendanceWhere,
        select: { estudianteId: true, estado: true },
      });
      const summaryByStudent = new Map();
      for (const estId of estudianteIdsArray) {
        const records = attendanceRecords.filter(a => a.estudianteId === estId);
        const total = records.length;
        const asistencias = records.filter(a => a.estado === 'ASISTENCIA').length;
        const faltas = records.filter(a => a.estado === 'FALTA').length;
        const justificadas = records.filter(a => a.estado === 'JUSTIFICADA').length;
        const tardes = records.filter(a => a.estado === 'TARDE').length;
        const porcentajeAsistencia = total > 0
          ? Math.round(((asistencias + tardes + justificadas) / total) * 10000) / 100
          : 0;
        summaryByStudent.set(estId, {
          resumen: { total, asistencias, faltas, justificadas, tardes, porcentajeAsistencia },
        });
      }
      dataToSend = reportCards.map(rc => ({
        ...rc,
        asistencia: summaryByStudent.get(rc.estudiante.id) || { resumen: { total: 0, asistencias: 0, faltas: 0, justificadas: 0, tardes: 0, porcentajeAsistencia: 0 } },
      }));
    }

    res.json({
      data: dataToSend,
      periodsGrouped,
      total: reportCards.length,
    });
  } catch (error) {
    next(error);
  }
};

