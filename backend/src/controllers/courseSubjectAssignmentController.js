import prisma from '../config/database.js';
import { createCourseSubjectAssignmentSchema, updateCourseSubjectAssignmentSchema } from '../utils/validators.js';
import { getCourseSubjectAssignmentInstitutionFilter, verifyCourseBelongsToInstitution } from '../utils/institutionFilter.js';

/**
 * Obtener todas las asignaciones
 */
export const getAssignments = async (req, res, next) => {
  try {
    const { cursoId, materiaId, docenteId, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (cursoId) {
      where.cursoId = cursoId;
    } else {
      // Filtrar por institución si no se especifica curso
      const institutionFilter = await getCourseSubjectAssignmentInstitutionFilter(req, prisma);
      if (Object.keys(institutionFilter).length > 0) {
        if (institutionFilter.cursoId?.in && institutionFilter.cursoId.in.length === 0) {
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
    if (docenteId) where.docenteId = docenteId;

    const [assignments, total] = await Promise.all([
      prisma.courseSubjectAssignment.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          materia: true,
          curso: {
            include: {
              periodo: true,
            },
          },
          docente: {
            include: {
              user: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.courseSubjectAssignment.count({ where }),
    ]);

    res.json({
      data: assignments,
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
 * Obtener una asignación por ID
 */
export const getAssignmentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const assignment = await prisma.courseSubjectAssignment.findUnique({
      where: { id },
      include: {
        materia: true,
        curso: {
          include: {
            periodo: true,
            estudiantes: {
              include: {
                user: true,
              },
            },
          },
        },
        docente: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!assignment) {
      return res.status(404).json({
        error: 'Asignación no encontrada.',
      });
    }

    res.json(assignment);
  } catch (error) {
    next(error);
  }
};

/**
 * Crear una nueva asignación
 * Al crear una asignación, todos los estudiantes del curso tienen acceso a esa materia
 */
export const createAssignment = async (req, res, next) => {
  try {
    console.log('Datos recibidos para crear asignación:', req.body);
    
    // Validar datos con mejor manejo de errores
    let validatedData;
    try {
      validatedData = createCourseSubjectAssignmentSchema.parse(req.body);
    } catch (validationError) {
      console.error('Error de validación:', validationError.issues || validationError.errors);
      return res.status(400).json({
        error: 'Error de validación',
        details: validationError.issues || validationError.errors || [validationError],
        received: req.body,
      });
    }

    // Verificar que la materia existe
    const materia = await prisma.subject.findUnique({
      where: { id: validatedData.materiaId },
    });

    if (!materia) {
      return res.status(404).json({
        error: 'Materia no encontrada.',
      });
    }

    // Verificar que el curso existe y pertenece a la institución
    const curso = await prisma.course.findUnique({
      where: { id: validatedData.cursoId },
    });

    if (!curso) {
      return res.status(404).json({
        error: 'Curso no encontrado.',
      });
    }

    // Verificar acceso a la institución del curso
    const hasAccess = await verifyCourseBelongsToInstitution(req, prisma, validatedData.cursoId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'No tienes permiso para asignar materias a este curso.',
      });
    }

    // Verificar que el docente existe
    const docente = await prisma.teacher.findUnique({
      where: { id: validatedData.docenteId },
    });

    if (!docente) {
      return res.status(404).json({
        error: 'Docente no encontrado.',
      });
    }

    // Verificar que no exista ya esta asignación
    const existing = await prisma.courseSubjectAssignment.findUnique({
      where: {
        materiaId_cursoId: {
          materiaId: validatedData.materiaId,
          cursoId: validatedData.cursoId,
        },
      },
    });

    if (existing) {
      return res.status(400).json({
        error: 'Esta materia ya está asignada a este curso.',
      });
    }

    // Crear la asignación
    const assignment = await prisma.courseSubjectAssignment.create({
      data: {
        ...validatedData,
        updatedAt: new Date(),
      },
      include: {
        materia: true,
        curso: {
          include: {
            periodo: true,
            estudiantes: true,
          },
        },
        docente: {
          include: {
            user: true,
          },
        },
      },
    });

    // Los estudiantes del curso ahora tienen acceso automático a esta materia
    // (se refleja cuando consultan sus materias desde el curso)

    res.status(201).json({
      message: 'Asignación creada exitosamente. Todos los estudiantes del curso ahora tienen acceso a esta materia.',
      assignment,
    });
  } catch (error) {
    // Si es un error de validación de Zod, ya lo manejamos arriba
    if (error.name === 'ZodError') {
      return next(error);
    }
    next(error);
  }
};

/**
 * Actualizar una asignación (principalmente para cambiar el docente)
 */
export const updateAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const validatedData = updateCourseSubjectAssignmentSchema.parse(req.body);

    const assignment = await prisma.courseSubjectAssignment.findUnique({
      where: { id },
    });

    if (!assignment) {
      return res.status(404).json({
        error: 'Asignación no encontrada.',
      });
    }

    // Verificar que el curso de la asignación pertenece a la institución
    const hasAccess = await verifyCourseBelongsToInstitution(req, prisma, assignment.cursoId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'No tienes acceso a esta asignación.',
      });
    }

    // Verificar que el docente existe
    const docente = await prisma.teacher.findUnique({
      where: { id: validatedData.docenteId },
    });

    if (!docente) {
      return res.status(404).json({
        error: 'Docente no encontrado.',
      });
    }

    // Solo se puede actualizar el docente, no la materia ni el curso
    const updatedAssignment = await prisma.courseSubjectAssignment.update({
      where: { id },
      data: {
        docenteId: validatedData.docenteId,
        updatedAt: new Date(),
      },
      include: {
        materia: true,
        curso: {
          include: {
            periodo: true,
          },
        },
        docente: {
          include: {
            user: true,
          },
        },
      },
    });

    res.json({
      message: 'Asignación actualizada exitosamente.',
      assignment: updatedAssignment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Eliminar una asignación
 */
export const deleteAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;

    const assignment = await prisma.courseSubjectAssignment.findUnique({
      where: { id },
    });

    if (!assignment) {
      return res.status(404).json({
        error: 'Asignación no encontrada.',
      });
    }

    await prisma.courseSubjectAssignment.delete({
      where: { id },
    });

    res.json({
      message: 'Asignación eliminada exitosamente.',
    });
  } catch (error) {
    next(error);
  }
};

