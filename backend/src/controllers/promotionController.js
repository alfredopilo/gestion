import prisma from '../config/database.js';
import { randomUUID } from 'crypto';
import { 
  calculateStudentPromotionStatus,
  adjustPeriodDates,
  copyCourseToNewYear,
  copySubjectToNewYear,
  copyPeriodToNewYear,
  copyGradeScaleToNewYear,
} from '../utils/promotionLogic.js';
import { getInstitutionFilter } from '../utils/institutionFilter.js';
import { generateMatriculaNumber } from '../utils/matricula.js';

/**
 * Generar vista previa de la promoción escolar
 * Calcula qué estudiantes pasan, qué se copiará, etc. sin ejecutar cambios
 */
export const preparePromotionPreview = async (req, res, next) => {
  try {
    const { institucionId } = req.params;
    const { nuevoAno } = req.query;

    if (!institucionId) {
      return res.status(400).json({
        error: 'Debe proporcionar institucionId.',
      });
    }

    if (!nuevoAno) {
      return res.status(400).json({
        error: 'Debe proporcionar nuevoAno como query parameter.',
      });
    }

    const nuevoAnoInt = parseInt(nuevoAno);
    if (isNaN(nuevoAnoInt)) {
      return res.status(400).json({
        error: 'nuevoAno debe ser un número válido.',
      });
    }

    // Verificar acceso a la institución
    const userInstitutionId = getInstitutionFilter(req);
    if (userInstitutionId !== institucionId && req.user?.rol !== 'ADMIN') {
      return res.status(403).json({
        error: 'No tienes acceso a esta institución.',
      });
    }

    // Obtener año lectivo activo de la institución
    const activeSchoolYear = await prisma.schoolYear.findFirst({
      where: {
        institucionId: institucionId,
        activo: true,
      },
      include: {
        institucion: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
    });

    if (!activeSchoolYear) {
      return res.status(404).json({
        error: 'No hay un año lectivo activo para esta institución.',
      });
    }

    // Verificar que no exista ya el año lectivo nuevo
    const nombreNuevoAno = `${nuevoAnoInt}-${nuevoAnoInt + 1}`;
    const existingSchoolYear = await prisma.schoolYear.findFirst({
      where: {
        institucionId: institucionId,
        nombre: nombreNuevoAno,
      },
    });

    if (existingSchoolYear) {
      return res.status(409).json({
        error: `Ya existe un año lectivo con el nombre "${nombreNuevoAno}" para esta institución.`,
      });
    }

    // Obtener todos los cursos del año lectivo activo
    const courses = await prisma.course.findMany({
      where: {
        anioLectivoId: activeSchoolYear.id,
      },
      include: {
        estudiantes: {
          where: {
            retirado: false,
          },
          include: {
            user: {
              select: {
                id: true,
                nombre: true,
                apellido: true,
                numeroIdentificacion: true,
              },
            },
          },
        },
        cursoSiguiente: {
          select: {
            id: true,
            nombre: true,
            nivel: true,
            paralelo: true,
          },
        },
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });

    // Obtener todas las materias del año lectivo activo
    const subjects = await prisma.subject.findMany({
      where: {
        anioLectivoId: activeSchoolYear.id,
      },
      orderBy: {
        codigo: 'asc',
      },
    });

    // Obtener todas las escalas de calificación usadas en asignaciones del año lectivo
    const courseAssignmentsForScalesPreview = await prisma.courseSubjectAssignment.findMany({
      where: {
        curso: {
          anioLectivoId: activeSchoolYear.id,
        },
        gradeScaleId: { not: null },
      },
      include: {
        gradeScale: {
          include: {
            detalles: {
              orderBy: { orden: 'asc' },
            },
          },
        },
      },
      distinct: ['gradeScaleId'],
    });

    // Extraer escalas únicas
    const uniqueScales = [];
    const scalesSeen = new Set();
    for (const assignment of courseAssignmentsForScalesPreview) {
      if (assignment.gradeScale && !scalesSeen.has(assignment.gradeScale.id)) {
        scalesSeen.add(assignment.gradeScale.id);
        uniqueScales.push(assignment.gradeScale);
      }
    }

    // Obtener todos los períodos del año lectivo activo
    const periods = await prisma.period.findMany({
      where: {
        anioLectivoId: activeSchoolYear.id,
      },
      include: {
        subPeriodos: {
          orderBy: { orden: 'asc' },
        },
      },
      orderBy: {
        orden: 'asc',
      },
    });

    // Calcular estado de promoción para cada estudiante
    const estudiantesConPromocion = [];
    
    for (const course of courses) {
      for (const student of course.estudiantes) {
        const promotionStatus = await calculateStudentPromotionStatus(
          student.id,
          activeSchoolYear.id,
          course.id
        );

        estudiantesConPromocion.push({
          studentId: student.id,
          studentNombre: `${student.user.apellido} ${student.user.nombre}`,
          studentNumeroIdentificacion: student.user.numeroIdentificacion,
          cursoId: course.id,
          cursoNombre: course.nombre,
          cursoNivel: course.nivel,
          cursoParalelo: course.paralelo,
          cursoSiguienteId: course.cursoSiguienteId,
          cursoSiguienteNombre: course.cursoSiguiente?.nombre || null,
          pasa: promotionStatus.pasa,
          promedioGeneral: promotionStatus.promedioGeneral,
          materias: promotionStatus.materias,
          motivo: promotionStatus.motivo,
        });
      }
    }

    // Separar estudiantes que pasan y que no pasan
    const estudiantesQuePasan = estudiantesConPromocion.filter(e => e.pasa);
    const estudiantesQueNoPasan = estudiantesConPromocion.filter(e => !e.pasa);

    // Preparar información de cursos a copiar
    const cursosACopiar = courses.map(course => ({
      id: course.id,
      nombre: course.nombre,
      nivel: course.nivel,
      paralelo: course.paralelo,
      capacidad: course.capacidad,
      cursoSiguienteId: course.cursoSiguienteId,
      cursoSiguienteNombre: course.cursoSiguiente?.nombre || null,
      totalEstudiantes: course.estudiantes.length,
    }));

    // Preparar información de materias a copiar
    const materiasACopiar = subjects.map(subject => ({
      id: subject.id,
      nombre: subject.nombre,
      codigo: subject.codigo,
      creditos: subject.creditos,
      horas: subject.horas,
      promedioMinimoSupletorio: subject.promedioMinimoSupletorio,
    }));

    // Preparar información de escalas de calificación a copiar (ya obtenidas arriba)
    const escalasACopiar = uniqueScales.map(scale => ({
      id: scale.id,
      nombre: scale.nombre,
      totalDetalles: scale.detalles.length,
      detalles: scale.detalles.map(detalle => ({
        titulo: detalle.titulo,
        valor: detalle.valor,
        orden: detalle.orden,
      })),
    }));

    // Preparar información de períodos a copiar con fechas ajustadas
    const periodosACopiar = periods.map(period => {
      const periodAjustado = adjustPeriodDates(period, nuevoAnoInt);
      return {
        id: period.id,
        nombre: period.nombre,
        fechaInicio: period.fechaInicio,
        fechaFin: period.fechaFin,
        nuevaFechaInicio: periodAjustado.fechaInicio,
        nuevaFechaFin: periodAjustado.fechaFin,
        esSupletorio: period.esSupletorio,
        calificacionMinima: period.calificacionMinima,
        ponderacion: period.ponderacion,
        orden: period.orden,
        totalSubPeriodos: period.subPeriodos.length,
      };
    });

    res.json({
      anioLectivoActual: {
        id: activeSchoolYear.id,
        nombre: activeSchoolYear.nombre,
        ano: activeSchoolYear.ano,
        fechaInicio: activeSchoolYear.fechaInicio,
        fechaFin: activeSchoolYear.fechaFin,
      },
      nuevoAnoLectivo: {
        nombre: nombreNuevoAno,
        ano: nuevoAnoInt,
        fechaInicio: adjustPeriodDates({ fechaInicio: activeSchoolYear.fechaInicio, fechaFin: activeSchoolYear.fechaFin }, nuevoAnoInt).fechaInicio,
        fechaFin: adjustPeriodDates({ fechaInicio: activeSchoolYear.fechaInicio, fechaFin: activeSchoolYear.fechaFin }, nuevoAnoInt).fechaFin,
      },
      resumen: {
        totalCursos: courses.length,
        totalMaterias: subjects.length,
        totalPeriodos: periods.length,
        totalEscalas: uniqueScales.length,
        totalEstudiantes: estudiantesConPromocion.length,
        estudiantesQuePasan: estudiantesQuePasan.length,
        estudiantesQueNoPasan: estudiantesQueNoPasan.length,
      },
      cursosACopiar,
      materiasACopiar,
      escalasACopiar,
      periodosACopiar,
      estudiantesQuePasan,
      estudiantesQueNoPasan,
    });
  } catch (error) {
    console.error('Error al generar vista previa de promoción:', error);
    next(error);
  }
};

/**
 * Ejecutar la promoción escolar completa
 * Crea nuevo año lectivo, copia estructura y promueve estudiantes
 */
export const executePromotion = async (req, res, next) => {
  let transaction;
  
  try {
    const { institucionId, nuevoAno, estudiantesPromocion } = req.body;

    if (!institucionId || !nuevoAno) {
      return res.status(400).json({
        error: 'Debe proporcionar institucionId y nuevoAno.',
      });
    }

    const nuevoAnoInt = parseInt(nuevoAno);
    if (isNaN(nuevoAnoInt)) {
      return res.status(400).json({
        error: 'nuevoAno debe ser un número válido.',
      });
    }

    // Verificar acceso a la institución
    const userInstitutionId = getInstitutionFilter(req);
    if (userInstitutionId !== institucionId && req.user?.rol !== 'ADMIN') {
      return res.status(403).json({
        error: 'No tienes acceso a esta institución.',
      });
    }

    // Obtener año lectivo activo
    const activeSchoolYear = await prisma.schoolYear.findFirst({
      where: {
        institucionId: institucionId,
        activo: true,
      },
    });

    if (!activeSchoolYear) {
      return res.status(404).json({
        error: 'No hay un año lectivo activo para esta institución.',
      });
    }

    // Verificar que no exista ya el año lectivo nuevo
    const nombreNuevoAno = `${nuevoAnoInt}-${nuevoAnoInt + 1}`;
    const existingSchoolYear = await prisma.schoolYear.findFirst({
      where: {
        institucionId: institucionId,
        nombre: nombreNuevoAno,
      },
    });

    if (existingSchoolYear) {
      return res.status(409).json({
        error: `Ya existe un año lectivo con el nombre "${nombreNuevoAno}" para esta institución.`,
      });
    }

    // Crear transacción
    transaction = await prisma.$transaction(async (tx) => {
      // 1. Crear nuevo año lectivo
      const nuevoAnioLectivoFechaInicio = adjustPeriodDates(
        { fechaInicio: activeSchoolYear.fechaInicio, fechaFin: activeSchoolYear.fechaFin },
        nuevoAnoInt
      ).fechaInicio;
      
      const nuevoAnioLectivoFechaFin = adjustPeriodDates(
        { fechaInicio: activeSchoolYear.fechaInicio, fechaFin: activeSchoolYear.fechaFin },
        nuevoAnoInt
      ).fechaFin;

      const nuevoAnioLectivo = await tx.schoolYear.create({
        data: {
          id: randomUUID(),
          institucionId: institucionId,
          ano: nuevoAnoInt,
          nombre: nombreNuevoAno,
          fechaInicio: nuevoAnioLectivoFechaInicio,
          fechaFin: nuevoAnioLectivoFechaFin,
          activo: true, // El nuevo año se activa automáticamente
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Desactivar año anterior
      await tx.schoolYear.update({
        where: { id: activeSchoolYear.id },
        data: { activo: false, updatedAt: new Date() },
      });

      // 2. Copiar materias
      const subjects = await tx.subject.findMany({
        where: {
          anioLectivoId: activeSchoolYear.id,
        },
      });

      const materiasMapeo = {}; // materiasMapeo[materiaIdAnterior] = materiaIdNueva
      
      for (const subject of subjects) {
        const nuevaMateria = await copySubjectToNewYear(subject, nuevoAnioLectivo.id, tx);
        materiasMapeo[subject.id] = nuevaMateria.id;
      }

      // 2.5. Copiar escalas de calificación usadas en asignaciones
      // Primero obtener todos los IDs de escalas únicas
      const assignmentsWithScales = await tx.courseSubjectAssignment.findMany({
        where: {
          curso: {
            anioLectivoId: activeSchoolYear.id,
          },
          gradeScaleId: { not: null },
        },
        select: {
          gradeScaleId: true,
        },
        distinct: ['gradeScaleId'],
      });

      const escalaIds = assignmentsWithScales
        .map(a => a.gradeScaleId)
        .filter(id => id !== null);

      // Obtener todas las escalas con sus detalles
      const gradeScales = await tx.gradeScale.findMany({
        where: {
          id: { in: escalaIds },
          institucionId: institucionId,
        },
        include: {
          detalles: {
            orderBy: { orden: 'asc' },
          },
        },
      });

      const escalasMapeo = {}; // escalasMapeo[escalaIdAnterior] = escalaIdNueva
      
      for (const escala of gradeScales) {
        const nuevaEscala = await copyGradeScaleToNewYear(escala, institucionId, tx);
        escalasMapeo[escala.id] = nuevaEscala.id;
      }

      // 3. Copiar períodos
      const periods = await tx.period.findMany({
        where: {
          anioLectivoId: activeSchoolYear.id,
        },
        include: {
          subPeriodos: {
            orderBy: { orden: 'asc' },
          },
        },
        orderBy: {
          orden: 'asc',
        },
      });

      for (const period of periods) {
        await copyPeriodToNewYear(period, nuevoAnioLectivo.id, nuevoAnoInt, tx);
      }

      // 4. Copiar cursos
      const courses = await tx.course.findMany({
        where: {
          anioLectivoId: activeSchoolYear.id,
        },
        include: {
          cursoSiguiente: {
            select: {
              id: true,
            },
          },
        },
      });

      const cursosMapeo = {}; // cursosMapeo[cursoIdAnterior] = cursoIdNuevo

      // Primero crear todos los cursos (sin cursoSiguienteId)
      for (const course of courses) {
        const nuevoCurso = await copyCourseToNewYear(course, nuevoAnioLectivo.id, {}, tx);
        cursosMapeo[course.id] = nuevoCurso.id;
      }

      // Luego actualizar cursoSiguienteId en todos los cursos nuevos
      for (const course of courses) {
        if (course.cursoSiguienteId && cursosMapeo[course.cursoSiguienteId]) {
          await tx.course.update({
            where: { id: cursosMapeo[course.id] },
            data: {
              cursoSiguienteId: cursosMapeo[course.cursoSiguienteId],
              updatedAt: new Date(),
            },
          });
        }
      }

      // 5. Copiar asignaciones de materias a cursos
      const courseAssignments = await tx.courseSubjectAssignment.findMany({
        where: {
          curso: {
            anioLectivoId: activeSchoolYear.id,
          },
        },
        include: {
          materia: true,
          curso: true,
          horarios: {
            orderBy: [
              { diaSemana: 'asc' },
              { hora: 'asc' },
            ],
          },
        },
      });

      for (const assignment of courseAssignments) {
        const nuevoCursoId = cursosMapeo[assignment.cursoId];
        const nuevaMateriaId = materiasMapeo[assignment.materiaId];
        
        // Mapear la escala de calificación si existe
        const nuevaEscalaId = assignment.gradeScaleId && escalasMapeo[assignment.gradeScaleId]
          ? escalasMapeo[assignment.gradeScaleId]
          : assignment.gradeScaleId; // Si no hay mapeo, usar la misma escala
        
        if (nuevoCursoId && nuevaMateriaId) {
          const nuevaAsignacion = await tx.courseSubjectAssignment.create({
            data: {
              id: randomUUID(),
              cursoId: nuevoCursoId,
              materiaId: nuevaMateriaId,
              docenteId: assignment.docenteId,
              gradeScaleId: nuevaEscalaId,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });

          // Copiar horarios de la asignación
          for (const horario of assignment.horarios) {
            await tx.assignmentSchedule.create({
              data: {
                id: randomUUID(),
                assignmentId: nuevaAsignacion.id,
                hora: horario.hora,
                diaSemana: horario.diaSemana,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });
          }
        }
      }

      // 6. Promover estudiantes según las decisiones del admin
      const estudiantesPromovidos = [];
      const estudiantesRepetidores = [];
      const estudiantesSinAsignar = [];

      if (estudiantesPromocion && Array.isArray(estudiantesPromocion)) {
        for (const decision of estudiantesPromocion) {
          const { studentId, nuevoCursoId, cursoIdOriginal, accion } = decision;
          
          // Obtener estudiante
          const student = await tx.student.findUnique({
            where: { id: studentId },
            include: {
              user: {
                select: {
                  institucionId: true,
                },
              },
            },
          });

          if (!student) continue;

          // Verificar que el estudiante pertenece a la institución
          if (student.user?.institucionId !== institucionId) continue;

          // Determinar el curso destino
          let cursoDestinoId = nuevoCursoId;
          // Si se proporciona cursoIdOriginal, mapearlo al nuevo curso
          if (cursoIdOriginal && cursosMapeo[cursoIdOriginal]) {
            cursoDestinoId = cursosMapeo[cursoIdOriginal];
          }

          if (accion === 'promover' && cursoDestinoId) {
            // Promover al nuevo curso
            await tx.student.update({
              where: { id: studentId },
              data: {
                grupoId: cursoDestinoId,
                updatedAt: new Date(),
              },
            });

            // Crear nueva matrícula
            const matricula = await generateMatriculaNumber(tx, institucionId, nuevoAnioLectivo.id);
            
            await tx.enrollment.create({
              data: {
                id: randomUUID(),
                studentId: studentId,
                cursoId: cursoDestinoId,
                anioLectivoId: nuevoAnioLectivo.id,
                institucionId: institucionId,
                matricula: matricula,
                fechaInicio: new Date(),
                activo: true,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });

            // Cerrar matrícula anterior si existe
            const enrollmentAnterior = await tx.enrollment.findFirst({
              where: {
                studentId: studentId,
                anioLectivoId: activeSchoolYear.id,
                activo: true,
              },
            });

            if (enrollmentAnterior) {
              await tx.enrollment.update({
                where: { id: enrollmentAnterior.id },
                data: {
                  activo: false,
                  fechaFin: new Date(),
                  updatedAt: new Date(),
                },
              });
            }

            estudiantesPromovidos.push(studentId);
          } else if (accion === 'repetir' && cursoDestinoId) {
            // Repetir curso (mismo curso en nuevo año)
            await tx.student.update({
              where: { id: studentId },
              data: {
                grupoId: cursoDestinoId,
                updatedAt: new Date(),
              },
            });

            // Crear nueva matrícula
            const matricula = await generateMatriculaNumber(tx, institucionId, nuevoAnioLectivo.id);
            
            await tx.enrollment.create({
              data: {
                id: randomUUID(),
                studentId: studentId,
                cursoId: cursoDestinoId,
                anioLectivoId: nuevoAnioLectivo.id,
                institucionId: institucionId,
                matricula: matricula,
                fechaInicio: new Date(),
                activo: true,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });

            // Cerrar matrícula anterior
            const enrollmentAnterior = await tx.enrollment.findFirst({
              where: {
                studentId: studentId,
                anioLectivoId: activeSchoolYear.id,
                activo: true,
              },
            });

            if (enrollmentAnterior) {
              await tx.enrollment.update({
                where: { id: enrollmentAnterior.id },
                data: {
                  activo: false,
                  fechaFin: new Date(),
                  updatedAt: new Date(),
                },
              });
            }

            estudiantesRepetidores.push(studentId);
          } else if (accion === 'sin-asignar') {
            // Quitar del curso (grupoId = null)
            await tx.student.update({
              where: { id: studentId },
              data: {
                grupoId: null,
                updatedAt: new Date(),
              },
            });

            // Cerrar matrícula anterior
            const enrollmentAnterior = await tx.enrollment.findFirst({
              where: {
                studentId: studentId,
                anioLectivoId: activeSchoolYear.id,
                activo: true,
              },
            });

            if (enrollmentAnterior) {
              await tx.enrollment.update({
                where: { id: enrollmentAnterior.id },
                data: {
                  activo: false,
                  fechaFin: new Date(),
                  updatedAt: new Date(),
                },
              });
            }

            estudiantesSinAsignar.push(studentId);
          }
        }
      }

      return {
        nuevoAnioLectivo,
        resumen: {
          cursosCopiados: Object.keys(cursosMapeo).length,
          materiasCopiadas: Object.keys(materiasMapeo).length,
          escalasCopiadas: Object.keys(escalasMapeo).length,
          periodosCopiados: periods.length,
          estudiantesPromovidos: estudiantesPromovidos.length,
          estudiantesRepetidores: estudiantesRepetidores.length,
          estudiantesSinAsignar: estudiantesSinAsignar.length,
        },
      };
    }, {
      maxWait: 5000,
      timeout: 30000,
    });

    res.json({
      message: 'Promoción escolar ejecutada exitosamente.',
      nuevoAnioLectivo: transaction.nuevoAnioLectivo,
      resumen: transaction.resumen,
    });
  } catch (error) {
    console.error('Error al ejecutar promoción escolar:', error);
    next(error);
  }
};

