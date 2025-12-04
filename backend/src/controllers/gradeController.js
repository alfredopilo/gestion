import prisma from '../config/database.js';
import { createGradeSchema } from '../utils/validators.js';
import { calculateWeightedAverage, truncate } from '../utils/gradeCalculations.js';
import { getGradeInstitutionFilter } from '../utils/institutionFilter.js';
import { randomUUID } from 'crypto';

/**
 * Reiniciar calificaciones masivamente (poner en 0 y limpiar observaciones)
 * para una combinación específica de curso, materia y subperíodo.
 */
export const resetGrades = async (req, res, next) => {
  try {
    const { cursoId, materiaId, subPeriodoId } = req.body;

    if (!cursoId || !materiaId || !subPeriodoId) {
      return res.status(400).json({
        error: 'Debe proporcionar cursoId, materiaId y subPeriodoId.',
      });
    }

    // Obtener estudiantes del curso para limitar el alcance
    const course = await prisma.course.findUnique({
      where: { id: cursoId },
      include: {
        estudiantes: {
          select: { id: true },
        },
      },
    });

    if (!course) {
      return res.status(404).json({
        error: 'Curso no encontrado.',
      });
    }

    const studentIds = course.estudiantes.map((e) => e.id);

    if (studentIds.length === 0) {
      return res.json({
        message: 'No hay estudiantes en el curso para reiniciar calificaciones.',
        count: 0,
      });
    }

    const result = await prisma.grade.deleteMany({
      where: {
        estudianteId: { in: studentIds },
        materiaId,
        subPeriodoId,
      },
    });

    return res.json({
      message: 'Calificaciones eliminadas exitosamente.',
      count: result.count || 0,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener calificaciones
 */
export const getGrades = async (req, res, next) => {
  try {
    const { estudianteId, materiaId, cursoId, parcial, subPeriodoId, insumoId, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (estudianteId) {
      where.estudianteId = estudianteId;
    } else {
      // Filtrar por institución si no se especifica estudiante
      const institutionFilter = await getGradeInstitutionFilter(req, prisma);
      if (Object.keys(institutionFilter).length > 0) {
        if (institutionFilter.estudianteId?.in && institutionFilter.estudianteId.in.length === 0) {
          return res.json({
            data: [],
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total: 0,
              pages: 0,
            },
          });
        }
        Object.assign(where, institutionFilter);
      }
    }
    if (materiaId) where.materiaId = materiaId;
    if (parcial) where.parcial = parcial;
    if (subPeriodoId) where.subPeriodoId = subPeriodoId;
    if (insumoId) where.insumoId = insumoId;

    // Si se filtra por curso, obtener las materias del curso desde asignaciones
    if (cursoId) {
      const asignaciones = await prisma.courseSubjectAssignment.findMany({
        where: { cursoId },
        select: { materiaId: true },
      });
      const materiaIds = asignaciones.map(a => a.materiaId);

      if (materiaIds.length === 0) {
        return res.json({
          data: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            pages: 0,
          },
        });
      }

      where.materiaId = { in: materiaIds };
    }

    const [grades, total] = await Promise.all([
      prisma.grade.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          estudiante: {
            include: {
              user: {
                select: {
                  nombre: true,
                  apellido: true,
                },
              },
            },
          },
          materia: {
            include: {
              asignaciones: {
                include: {
                  curso: true,
                  docente: {
                    include: { user: true },
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
                  anioEscolar: true,
                },
              },
            },
          },
          insumo: {
            select: {
              id: true,
              nombre: true,
              descripcion: true,
            },
          },
        },
        orderBy: { fechaRegistro: 'desc' },
      }),
      prisma.grade.count({ where }),
    ]);

    res.json({
      data: grades,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener calificaciones de un estudiante
 * También incluye las materias asignadas al curso del estudiante (aunque no tenga calificaciones)
 */
export const getStudentGrades = async (req, res, next) => {
  try {
    const { estudianteId } = req.params;
    const { parcial, materiaId } = req.query;

    // Verificar que el estudiante pertenece a la institución
    const { verifyStudentBelongsToInstitution } = await import('../utils/institutionFilter.js');
    const hasAccess = await verifyStudentBelongsToInstitution(req, prisma, estudianteId);
    
    if (!hasAccess) {
      return res.status(403).json({
        error: 'No tienes acceso a este estudiante.',
      });
    }

    // Obtener el estudiante y su curso
    const estudiante = await prisma.student.findUnique({
      where: { id: estudianteId },
      include: {
        grupo: true,
      },
    });

    if (!estudiante) {
      return res.status(404).json({
        error: 'Estudiante no encontrado.',
      });
    }

    const where = { estudianteId };
    if (parcial) where.parcial = parcial;
    if (materiaId) where.materiaId = materiaId;

    const grades = await prisma.grade.findMany({
      where,
      include: {
        materia: {
          include: {
            asignaciones: {
              include: {
                curso: true,
                docente: {
                  include: { user: true },
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
                anioEscolar: true,
                calificacionMinima: true,
                ponderacion: true,
              },
            },
          },
        },
      },
      orderBy: [
        { materia: { nombre: 'asc' } },
        { subPeriodo: { orden: 'asc' } },
        { parcial: 'asc' },
      ],
    });

    // Obtener todas las materias asignadas al curso del estudiante
    let materiasDelCurso = [];
    if (estudiante.grupoId) {
      const asignaciones = await prisma.courseSubjectAssignment.findMany({
        where: { cursoId: estudiante.grupoId },
        include: {
          materia: {
            include: {
              asignaciones: {
                include: {
                  curso: true,
                  docente: {
                    include: { user: true },
                  },
                },
              },
            },
          },
        },
      });
      materiasDelCurso = asignaciones.map(a => a.materia);
    }

    // Incluir todas las materias del curso en el mapa (incluso sin calificaciones)
    const materiasMap = new Map();
    
    // Primero agregar todas las materias del curso
    materiasDelCurso.forEach(materia => {
      if (!materiasMap.has(materia.id)) {
        materiasMap.set(materia.id, {
          materia: materia,
          calificaciones: [],
          promedio: 0,
          promedioPonderado: null,
        });
      }
    });

    // Luego agregar las calificaciones
    grades.forEach(grade => {
      if (!materiasMap.has(grade.materiaId)) {
        materiasMap.set(grade.materiaId, {
          materia: grade.materia,
          calificaciones: [],
          promedio: 0,
          promedioPonderado: null,
        });
      }
      materiasMap.get(grade.materiaId).calificaciones.push(grade);
    });

    // Calcular promedio para cada materia
    materiasMap.forEach((value) => {
      if (value.calificaciones.length > 0) {
        // Promedio simple (para compatibilidad)
        const suma = value.calificaciones.reduce((acc, g) => acc + g.calificacion, 0);
        value.promedio = truncate(suma / value.calificaciones.length);
        
        // Calcular promedio ponderado si hay subperíodos
        const gradesWithSubPeriod = value.calificaciones.filter(g => g.subPeriodo);
        if (gradesWithSubPeriod.length > 0) {
          const weighted = calculateWeightedAverage(gradesWithSubPeriod);
          value.promedioPonderado = weighted.promedioFinal;
          value.detallePonderado = weighted.detalles;
          value.aprobado = weighted.aprobado;
          value.calificacionMinima = gradesWithSubPeriod[0]?.subPeriodo?.periodo?.calificacionMinima || 7.0;
        }
      }
    });

    res.json({
      estudianteId,
      calificaciones: grades,
      resumenPorMateria: Array.from(materiasMap.values()),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Crear una nueva calificación
 * Ahora permite múltiples calificaciones por estudiante/materia/subperíodo
 */
export const upsertGrade = async (req, res, next) => {
  try {
    const validatedData = createGradeSchema.parse(req.body);

    // Validar que se proporcione subPeriodoId, parcial o insumoId
    if (!validatedData.subPeriodoId && !validatedData.parcial && !validatedData.insumoId) {
      return res.status(400).json({
        error: 'Debe proporcionar subPeriodoId, parcial o insumoId.',
      });
    }

    // Validar supletorio si se está ingresando una calificación de supletorio
    let periodoEsSupletorio = false;
    let anioLectivoId = null;

    if (validatedData.subPeriodoId) {
      const subPeriodo = await prisma.subPeriod.findUnique({
        where: { id: validatedData.subPeriodoId },
        include: {
          periodo: {
            select: {
              id: true,
              esSupletorio: true,
              anioLectivoId: true,
            },
          },
        },
      });

      if (subPeriodo?.periodo) {
        periodoEsSupletorio = subPeriodo.periodo.esSupletorio;
        anioLectivoId = subPeriodo.periodo.anioLectivoId;
      }
    } else if (validatedData.insumoId) {
      const insumo = await prisma.insumo.findUnique({
        where: { id: validatedData.insumoId },
        include: {
          subPeriodo: {
            include: {
              periodo: {
                select: {
                  id: true,
                  esSupletorio: true,
                  anioLectivoId: true,
                },
              },
            },
          },
        },
      });

      if (insumo?.subPeriodo?.periodo) {
        periodoEsSupletorio = insumo.subPeriodo.periodo.esSupletorio;
        anioLectivoId = insumo.subPeriodo.periodo.anioLectivoId;
      }
    }

    // Si es un período supletorio, verificar que el estudiante califica
    if (periodoEsSupletorio && anioLectivoId) {
      const { checkStudentQualifiesForSupplementary } = await import('../utils/supplementaryLogic.js');
      
      const qualificationResult = await checkStudentQualifiesForSupplementary(
        validatedData.estudianteId,
        validatedData.materiaId,
        anioLectivoId
      );

      if (!qualificationResult.qualifies) {
        return res.status(400).json({
          error: 'Este estudiante no califica para supletorio en esta materia. El promedio general debe ser menor a la suma de las calificaciones mínimas de los períodos regulares.',
          detalles: {
            promedioGeneral: qualificationResult.promedioGeneral,
            sumaMinima: qualificationResult.sumaMinima,
          },
        });
      }
    }

    // NO truncar las calificaciones individuales, mantener el valor exacto
    // Solo se truncará el promedio en el cálculo

    let grade;
    if (validatedData.insumoId) {
      // Usar insumo - Upsert basado en estudiante e insumo (único por insumo)
      // Preparar datos para create, excluyendo campos que no deben estar
      const createData = {
        id: randomUUID(),
        estudianteId: validatedData.estudianteId,
        materiaId: validatedData.materiaId,
        insumoId: validatedData.insumoId,
        subPeriodoId: validatedData.subPeriodoId || null,
        calificacion: validatedData.calificacion,
        observaciones: validatedData.observaciones || null,
        parcial: validatedData.parcial || null,
        tipoEvaluacion: validatedData.tipoEvaluacion || null,
        descripcion: validatedData.descripcion || null,
      };
      
      grade = await prisma.grade.upsert({
        where: {
          estudianteId_insumoId: {
            estudianteId: validatedData.estudianteId,
            insumoId: validatedData.insumoId,
          },
        },
        update: {
          calificacion: validatedData.calificacion,
          observaciones: validatedData.observaciones || null,
        },
        create: createData,
        include: {
          estudiante: {
            include: {
              user: {
                select: {
                  nombre: true,
                  apellido: true,
                },
              },
            },
          },
          materia: true,
          subPeriodo: {
            include: {
              periodo: {
                select: {
                  id: true,
                  nombre: true,
                  anioEscolar: true,
                  calificacionMinima: true,
                },
              },
            },
          },
          insumo: {
            select: {
              id: true,
              nombre: true,
              descripcion: true,
            },
          },
        },
      });
    } else if (validatedData.subPeriodoId) {
      // Usar subperíodo (método nuevo) - Crear nueva calificación (permite múltiples)
      const createData = {
        id: randomUUID(),
        estudianteId: validatedData.estudianteId,
        materiaId: validatedData.materiaId,
        subPeriodoId: validatedData.subPeriodoId,
        calificacion: validatedData.calificacion,
        observaciones: validatedData.observaciones || null,
        parcial: validatedData.parcial || null,
        tipoEvaluacion: validatedData.tipoEvaluacion || null,
        descripcion: validatedData.descripcion || null,
        insumoId: validatedData.insumoId || null,
      };
      
      grade = await prisma.grade.create({
        data: createData,
        include: {
          estudiante: {
            include: {
              user: {
                select: {
                  nombre: true,
                  apellido: true,
                },
              },
            },
          },
          materia: true,
          subPeriodo: {
            include: {
              periodo: {
                select: {
                  id: true,
                  nombre: true,
                  anioEscolar: true,
                  calificacionMinima: true,
                },
              },
            },
          },
          insumo: {
            select: {
              id: true,
              nombre: true,
              descripcion: true,
            },
          },
        },
      });
    } else {
      // Usar parcial (método legacy para compatibilidad) - Mantener upsert para compatibilidad
      const createData = {
        id: randomUUID(),
        estudianteId: validatedData.estudianteId,
        materiaId: validatedData.materiaId,
        parcial: validatedData.parcial,
        calificacion: validatedData.calificacion,
        observaciones: validatedData.observaciones || null,
        subPeriodoId: validatedData.subPeriodoId || null,
        tipoEvaluacion: validatedData.tipoEvaluacion || null,
        descripcion: validatedData.descripcion || null,
        insumoId: validatedData.insumoId || null,
      };
      
      grade = await prisma.grade.upsert({
        where: {
          estudianteId_materiaId_parcial: {
            estudianteId: validatedData.estudianteId,
            materiaId: validatedData.materiaId,
            parcial: validatedData.parcial,
          },
        },
        update: {
          calificacion: validatedData.calificacion,
          observaciones: validatedData.observaciones || null,
        },
        create: createData,
        include: {
          estudiante: {
            include: {
              user: {
                select: {
                  nombre: true,
                  apellido: true,
                },
              },
            },
          },
          materia: true,
          insumo: {
            select: {
              id: true,
              nombre: true,
              descripcion: true,
            },
          },
        },
      });
    }

    res.json({
      message: 'Calificación registrada exitosamente.',
      grade,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Actualizar una calificación individual
 */
export const updateGrade = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { calificacion, observaciones, tipoEvaluacion, descripcion } = req.body;

    // Validar que la calificación existe
    const grade = await prisma.grade.findUnique({
      where: { id },
    });

    if (!grade) {
      return res.status(404).json({
        error: 'Calificación no encontrada.',
      });
    }

    // Validar calificación
    if (calificacion !== undefined) {
      if (typeof calificacion !== 'number' || calificacion < 0 || calificacion > 10) {
        return res.status(400).json({
          error: 'La calificación debe ser un número entre 0 y 10.',
        });
      }
    }

    // Truncar calificación a 2 decimales si se proporciona
    const updateData = {};
    if (calificacion !== undefined) {
      // NO truncar las calificaciones individuales, mantener el valor exacto
      updateData.calificacion = calificacion;
    }
    if (observaciones !== undefined) updateData.observaciones = observaciones;
    if (tipoEvaluacion !== undefined) updateData.tipoEvaluacion = tipoEvaluacion;
    if (descripcion !== undefined) updateData.descripcion = descripcion;

    const updatedGrade = await prisma.grade.update({
      where: { id },
      data: updateData,
      include: {
        estudiante: {
          include: {
            user: {
              select: {
                nombre: true,
                apellido: true,
              },
            },
          },
        },
        materia: true,
        subPeriodo: {
          include: {
            periodo: {
              select: {
                id: true,
                nombre: true,
                anioEscolar: true,
              },
            },
          },
        },
      },
    });

    res.json({
      message: 'Calificación actualizada exitosamente.',
      grade: updatedGrade,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Eliminar una calificación individual
 */
export const deleteGrade = async (req, res, next) => {
  try {
    const { id } = req.params;

    const grade = await prisma.grade.findUnique({
      where: { id },
    });

    if (!grade) {
      return res.status(404).json({
        error: 'Calificación no encontrada.',
      });
    }

    await prisma.grade.delete({
      where: { id },
    });

    res.json({
      message: 'Calificación eliminada exitosamente.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Carga masiva de calificaciones
 */
export const bulkCreateGrades = async (req, res, next) => {
  try {
    const { calificaciones } = req.body;

    if (!Array.isArray(calificaciones) || calificaciones.length === 0) {
      return res.status(400).json({
        error: 'Debe proporcionar un array de calificaciones.',
      });
    }

    // Validar cada calificación
    for (const cal of calificaciones) {
      createGradeSchema.parse(cal);
    }

    // Usar transacción para insertar todas
    const results = await prisma.$transaction(
      calificaciones.map(cal => {
        // NO truncar las calificaciones individuales, mantener el valor exacto
        return prisma.grade.create({
          data: {
            ...cal,
            calificacion: cal.calificacion,
          },
        });
      })
    );

    res.json({
      message: `${results.length} calificaciones procesadas exitosamente.`,
      count: results.length,
    });
  } catch (error) {
    next(error);
  }
};

