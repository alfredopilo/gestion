import prisma from '../config/database.js';
import { createSubPeriodSchema, updateSubPeriodSchema } from '../utils/validators.js';

/**
 * Obtener todos los subperíodos
 */
export const getSubPeriods = async (req, res, next) => {
  try {
    const { periodoId } = req.query;

    const where = {};
    if (periodoId) where.periodoId = periodoId;

    const subPeriods = await prisma.subPeriod.findMany({
      where,
      include: {
        periodo: {
          select: {
            id: true,
            nombre: true,
            anioEscolar: true,
          },
        },
        _count: {
          select: {
            calificaciones: true,
          },
        },
      },
      orderBy: [
        { periodo: { orden: 'asc' } },
        { orden: 'asc' },
      ],
    });

    res.json({
      data: subPeriods,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener un subperíodo por ID
 */
export const getSubPeriodById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const subPeriod = await prisma.subPeriod.findUnique({
      where: { id },
      include: {
        periodo: true,
        _count: {
          select: {
            calificaciones: true,
          },
        },
      },
    });

    if (!subPeriod) {
      return res.status(404).json({
        error: 'Subperíodo no encontrado.',
      });
    }

    res.json(subPeriod);
  } catch (error) {
    next(error);
  }
};

/**
 * Crear un nuevo subperíodo
 */
export const createSubPeriod = async (req, res, next) => {
  try {
    let validatedData = createSubPeriodSchema.parse(req.body);
    
    // Convertir fechas string a Date si es necesario
    if (validatedData.fechaInicio && typeof validatedData.fechaInicio === 'string') {
      validatedData.fechaInicio = new Date(validatedData.fechaInicio);
    }
    if (validatedData.fechaFin && typeof validatedData.fechaFin === 'string') {
      validatedData.fechaFin = new Date(validatedData.fechaFin);
    }

    // Verificar que el período existe
    const period = await prisma.period.findUnique({
      where: { id: validatedData.periodoId },
      include: {
        subPeriodos: true,
      },
    });

    if (!period) {
      return res.status(404).json({
        error: 'Período no encontrado.',
      });
    }

    // Verificar que no exista otro subperíodo con el mismo nombre en el mismo período
    const existing = await prisma.subPeriod.findUnique({
      where: {
        periodoId_nombre: {
          periodoId: validatedData.periodoId,
          nombre: validatedData.nombre,
        },
      },
    });

    if (existing) {
      return res.status(409).json({
        error: 'Ya existe un subperíodo con este nombre en el período.',
      });
    }

    // Verificar que la suma de ponderaciones no exceda 100
    const sumaActual = period.subPeriodos.reduce((sum, sp) => sum + sp.ponderacion, 0);
    const nuevaSuma = sumaActual + validatedData.ponderacion;

    if (nuevaSuma > 100.01) { // Permitir pequeña tolerancia por redondeo
      return res.status(400).json({
        error: `La suma de ponderaciones excedería 100%. Suma actual: ${sumaActual.toFixed(2)}%, nuevo subperíodo: ${validatedData.ponderacion}%.`,
        sumaActual: parseFloat(sumaActual.toFixed(2)),
        nuevaSuma: parseFloat(nuevaSuma.toFixed(2)),
      });
    }

    const subPeriod = await prisma.subPeriod.create({
      data: validatedData,
      include: {
        periodo: {
          select: {
            id: true,
            nombre: true,
            anioEscolar: true,
          },
        },
      },
    });

    res.status(201).json({
      message: 'Subperíodo creado exitosamente.',
      subPeriod,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Actualizar un subperíodo
 */
export const updateSubPeriod = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Remover periodoId si viene en el body (no debería estar en actualización)
    const { periodoId, ...bodyWithoutPeriodId } = req.body;
    
    let validatedData = updateSubPeriodSchema.parse(bodyWithoutPeriodId);
    
    // Convertir fechas string a Date si es necesario
    if (validatedData.fechaInicio && typeof validatedData.fechaInicio === 'string') {
      validatedData.fechaInicio = new Date(validatedData.fechaInicio);
    }
    if (validatedData.fechaFin && typeof validatedData.fechaFin === 'string') {
      validatedData.fechaFin = new Date(validatedData.fechaFin);
    }

    const subPeriod = await prisma.subPeriod.findUnique({
      where: { id },
      include: {
        periodo: {
          include: {
            subPeriodos: true,
          },
        },
      },
    });

    if (!subPeriod) {
      return res.status(404).json({
        error: 'Subperíodo no encontrado.',
      });
    }

    // Si se actualiza la ponderación, verificar que no exceda 100
    if (validatedData.ponderacion !== undefined) {
      const sumaActual = subPeriod.periodo.subPeriodos
        .filter(sp => sp.id !== id)
        .reduce((sum, sp) => sum + sp.ponderacion, 0);
      const nuevaSuma = sumaActual + validatedData.ponderacion;

      if (nuevaSuma > 100.01) {
        return res.status(400).json({
          error: `La suma de ponderaciones excedería 100%. Suma actual sin este: ${sumaActual.toFixed(2)}%, nuevo valor: ${validatedData.ponderacion}%.`,
          sumaActual: parseFloat(sumaActual.toFixed(2)),
          nuevaSuma: parseFloat(nuevaSuma.toFixed(2)),
        });
      }
    }

    // Si se actualiza el nombre, verificar que no exista otro con el mismo nombre
    if (validatedData.nombre && validatedData.nombre !== subPeriod.nombre) {
      const existing = await prisma.subPeriod.findUnique({
        where: {
          periodoId_nombre: {
            periodoId: subPeriod.periodoId,
            nombre: validatedData.nombre,
          },
        },
      });

      if (existing) {
        return res.status(409).json({
          error: 'Ya existe un subperíodo con este nombre en el período.',
        });
      }
    }

    const updatedSubPeriod = await prisma.subPeriod.update({
      where: { id },
      data: validatedData,
      include: {
        periodo: {
          select: {
            id: true,
            nombre: true,
            anioEscolar: true,
          },
        },
      },
    });

    res.json({
      message: 'Subperíodo actualizado exitosamente.',
      subPeriod: updatedSubPeriod,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Eliminar un subperíodo
 */
export const deleteSubPeriod = async (req, res, next) => {
  try {
    const { id } = req.params;

    const subPeriod = await prisma.subPeriod.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            calificaciones: true,
          },
        },
      },
    });

    if (!subPeriod) {
      return res.status(404).json({
        error: 'Subperíodo no encontrado.',
      });
    }

    if (subPeriod._count.calificaciones > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar un subperíodo que tiene calificaciones asociadas.',
      });
    }

    await prisma.subPeriod.delete({
      where: { id },
    });

    res.json({
      message: 'Subperíodo eliminado exitosamente.',
    });
  } catch (error) {
    next(error);
  }
};

