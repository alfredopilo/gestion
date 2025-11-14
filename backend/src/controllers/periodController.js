import { randomUUID } from 'crypto';
import prisma from '../config/database.js';
import { createPeriodSchema, updatePeriodSchema } from '../utils/validators.js';
import { getPeriodInstitutionFilter, verifyPeriodBelongsToInstitution, getActiveSchoolYear } from '../utils/institutionFilter.js';

/**
 * Obtener todos los períodos
 */
export const getPeriods = async (req, res, next) => {
  try {
    const { anioEscolar, activo, anioLectivoId } = req.query;

    const where = {};
    if (anioEscolar) where.anioEscolar = anioEscolar;
    if (activo !== undefined) where.activo = activo === 'true';
    if (anioLectivoId) {
      where.anioLectivoId = anioLectivoId;
    } else {
      // Filtrar por institución activa o del usuario si no se especifica
      const institutionFilter = await getPeriodInstitutionFilter(req, prisma);
      // Solo aplicar filtro si no está vacío
      if (Object.keys(institutionFilter).length > 0) {
        // Si el filtro tiene un array vacío, no devolver nada
        if (institutionFilter.anioLectivoId?.in && institutionFilter.anioLectivoId.in.length === 0) {
          return res.json({
            data: [],
          });
        }
        Object.assign(where, institutionFilter);
      }
    }

    const periods = await prisma.period.findMany({
      where,
      include: {
        anioLectivo: {
          include: {
            institucion: {
              select: {
                id: true,
                nombre: true,
              },
            },
          },
        },
        subPeriodos: {
          orderBy: { orden: 'asc' },
        },
        _count: {
          select: {
            courses: true,
          },
        },
      },
      orderBy: [
        { anioEscolar: 'desc' },
        { orden: 'asc' },
      ],
    });

    res.json({
      data: periods,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener un período por ID
 */
export const getPeriodById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const period = await prisma.period.findUnique({
      where: { id },
      include: {
        anioLectivo: {
          include: {
            institucion: {
              select: {
                id: true,
                nombre: true,
              },
            },
          },
        },
        subPeriodos: {
          orderBy: { orden: 'asc' },
        },
        courses: {
          include: {
            _count: {
              select: {
                estudiantes: true,
              },
            },
          },
        },
      },
    });

    if (!period) {
      return res.status(404).json({
        error: 'Período no encontrado.',
      });
    }

    // Verificar que el período pertenece a la institución
    const hasAccess = await verifyPeriodBelongsToInstitution(req, prisma, id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'No tienes acceso a este período.',
      });
    }

    res.json(period);
  } catch (error) {
    next(error);
  }
};

/**
 * Crear un nuevo período
 */
export const createPeriod = async (req, res, next) => {
  try {
    let validatedData = createPeriodSchema.parse(req.body);
    
    // Convertir fechas string a Date si es necesario
    if (typeof validatedData.fechaInicio === 'string') {
      validatedData.fechaInicio = new Date(validatedData.fechaInicio);
    }
    if (typeof validatedData.fechaFin === 'string') {
      validatedData.fechaFin = new Date(validatedData.fechaFin);
    }

    // Si no se proporciona anioLectivoId (null, undefined o no presente), obtener el año escolar activo automáticamente
    let schoolYear;
    if (!validatedData.anioLectivoId || validatedData.anioLectivoId === null || validatedData.anioLectivoId === undefined) {
      schoolYear = await getActiveSchoolYear(req, prisma);
      if (!schoolYear) {
        return res.status(400).json({
          error: 'No hay un año escolar activo configurado. Por favor, crea y activa un año escolar primero.',
        });
      }
      validatedData.anioLectivoId = schoolYear.id;
    } else {
      // Verificar que el año lectivo existe si se proporciona
      schoolYear = await prisma.schoolYear.findUnique({
        where: { id: validatedData.anioLectivoId },
        include: {
          institucion: true,
        },
      });

      if (!schoolYear) {
        return res.status(404).json({
          error: 'Año lectivo no encontrado.',
        });
      }
    }

    // Si no se proporciona anioEscolar (null, undefined o no presente), usar el nombre del año lectivo
    if (!validatedData.anioEscolar || validatedData.anioEscolar === null || validatedData.anioEscolar === undefined) {
      validatedData.anioEscolar = schoolYear.nombre;
    }

    // Si se está creando un período activo, desactivar automáticamente los demás períodos activos del mismo año lectivo
    if (validatedData.activo) {
      await prisma.period.updateMany({
        where: {
          anioLectivoId: validatedData.anioLectivoId,
          activo: true,
        },
        data: { activo: false },
      });
    }

    // Generar ID para el período
    const periodData = {
      id: randomUUID(),
      ...validatedData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const period = await prisma.period.create({
      data: periodData,
      include: {
        subPeriodos: true,
      },
    });

    res.status(201).json({
      message: 'Período creado exitosamente.',
      period,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Actualizar un período
 */
export const updatePeriod = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Validar datos
    let validatedData;
    try {
      validatedData = updatePeriodSchema.parse(req.body);
    } catch (validationError) {
      return res.status(400).json({
        error: 'Error de validación',
        details: validationError.issues || validationError.errors,
      });
    }
    
    // Convertir fechas string a Date si es necesario
    if (validatedData.fechaInicio && typeof validatedData.fechaInicio === 'string') {
      validatedData.fechaInicio = new Date(validatedData.fechaInicio);
    }
    if (validatedData.fechaFin && typeof validatedData.fechaFin === 'string') {
      validatedData.fechaFin = new Date(validatedData.fechaFin);
    }

    const period = await prisma.period.findUnique({
      where: { id },
    });

    if (!period) {
      return res.status(404).json({
        error: 'Período no encontrado.',
      });
    }

    // Si se está activando este período, desactivar otros del mismo año lectivo
    if (validatedData.activo === true && !period.activo) {
      const anioLectivoId = validatedData.anioLectivoId || period.anioLectivoId;
      if (anioLectivoId) {
        await prisma.period.updateMany({
          where: {
            anioLectivoId: anioLectivoId,
            activo: true,
            id: { not: id },
          },
          data: { activo: false },
        });
      }
    }

    const updatedPeriod = await prisma.period.update({
      where: { id },
      data: validatedData,
      include: {
        subPeriodos: {
          orderBy: { orden: 'asc' },
        },
      },
    });

    res.json({
      message: 'Período actualizado exitosamente.',
      period: updatedPeriod,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Eliminar un período
 */
export const deletePeriod = async (req, res, next) => {
  try {
    const { id } = req.params;

    const period = await prisma.period.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            courses: true,
            subPeriodos: true,
          },
        },
      },
    });

    if (!period) {
      return res.status(404).json({
        error: 'Período no encontrado.',
      });
    }

    if (period._count.courses > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar un período que tiene cursos asociados.',
      });
    }

    await prisma.period.delete({
      where: { id },
    });

    res.json({
      message: 'Período eliminado exitosamente.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener el período activo
 */
export const getActivePeriod = async (req, res, next) => {
  try {
    const period = await prisma.period.findFirst({
      where: { activo: true },
      include: {
        subPeriodos: {
          orderBy: { orden: 'asc' },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!period) {
      return res.status(404).json({
        error: 'No hay un período activo configurado.',
      });
    }

    res.json(period);
  } catch (error) {
    next(error);
  }
};

/**
 * Establecer un período como activo (desactiva los demás)
 */
export const setActivePeriod = async (req, res, next) => {
  try {
    const { id } = req.params;

    const period = await prisma.period.findUnique({
      where: { id },
    });

    if (!period) {
      return res.status(404).json({
        error: 'Período no encontrado.',
      });
    }

    // Desactivar todos los períodos del mismo año escolar
    await prisma.period.updateMany({
      where: {
        anioEscolar: period.anioEscolar,
        activo: true,
      },
      data: { activo: false },
    });

    // Activar el período seleccionado
    const updatedPeriod = await prisma.period.update({
      where: { id },
      data: { activo: true },
      include: {
        subPeriodos: {
          orderBy: { orden: 'asc' },
        },
      },
    });

    res.json({
      message: 'Período activo actualizado exitosamente.',
      period: updatedPeriod,
    });
  } catch (error) {
    next(error);
  }
};

