import prisma from '../config/database.js';
import { getInstitutionFilter } from '../utils/institutionFilter.js';
import { randomUUID } from 'crypto';

/**
 * Obtener todas las escalas de calificación
 */
export const getGradeScales = async (req, res, next) => {
  try {
    const institutionId = getInstitutionFilter(req);
    
    const where = {};
    if (institutionId) {
      where.institucionId = institutionId;
    } else if (req.user.institucionId) {
      where.institucionId = req.user.institucionId;
    }

    const gradeScales = await prisma.gradeScale.findMany({
      where,
      include: {
        detalles: {
          orderBy: { orden: 'asc' },
        },
        institucion: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({ data: gradeScales });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener una escala de calificación por ID
 */
export const getGradeScaleById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const gradeScale = await prisma.gradeScale.findUnique({
      where: { id },
      include: {
        detalles: {
          orderBy: { orden: 'asc' },
        },
        institucion: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
    });

    if (!gradeScale) {
      return res.status(404).json({
        error: 'Escala de calificación no encontrada.',
      });
    }

    res.json(gradeScale);
  } catch (error) {
    next(error);
  }
};

/**
 * Crear una nueva escala de calificación
 */
export const createGradeScale = async (req, res, next) => {
  try {
    const { nombre, detalles, institucionId } = req.body;
    const user = req.user;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({
        error: 'El nombre de la escala es requerido.',
      });
    }

    // Determinar institucionId
    let finalInstitucionId = institucionId;
    if (!finalInstitucionId && user.institucionId) {
      finalInstitucionId = user.institucionId;
    }

    if (!finalInstitucionId) {
      return res.status(400).json({
        error: 'Debe proporcionar una institución.',
      });
    }

    // Crear la escala con sus detalles
    const gradeScale = await prisma.gradeScale.create({
      data: {
        id: randomUUID(),
        nombre: nombre.trim(),
        institucionId: finalInstitucionId,
        detalles: detalles && detalles.length > 0 ? {
          create: detalles.map((detalle, index) => ({
            id: randomUUID(),
            titulo: detalle.titulo || '',
            valor: parseFloat(detalle.valor) || 0,
            orden: detalle.orden !== undefined ? detalle.orden : index,
          })),
        } : undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      include: {
        detalles: {
          orderBy: { orden: 'asc' },
        },
        institucion: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
    });

    res.status(201).json(gradeScale);
  } catch (error) {
    next(error);
  }
};

/**
 * Actualizar una escala de calificación
 */
export const updateGradeScale = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, detalles } = req.body;

    // Verificar que la escala existe
    const existingScale = await prisma.gradeScale.findUnique({
      where: { id },
    });

    if (!existingScale) {
      return res.status(404).json({
        error: 'Escala de calificación no encontrada.',
      });
    }

    // Actualizar la escala
    const updateData = {
      updatedAt: new Date(),
    };

    if (nombre !== undefined) {
      updateData.nombre = nombre.trim();
    }

    // Si se proporcionan detalles, actualizar
    if (detalles !== undefined) {
      // Eliminar detalles existentes
      await prisma.gradeScaleDetail.deleteMany({
        where: { gradeScaleId: id },
      });

      // Crear nuevos detalles si se proporcionan
      if (detalles.length > 0) {
        updateData.detalles = {
          create: detalles.map((detalle, index) => ({
            id: randomUUID(),
            titulo: detalle.titulo || '',
            valor: parseFloat(detalle.valor) || 0,
            orden: detalle.orden !== undefined ? detalle.orden : index,
          })),
        };
      }
    }

    const gradeScale = await prisma.gradeScale.update({
      where: { id },
      data: updateData,
      include: {
        detalles: {
          orderBy: { orden: 'asc' },
        },
        institucion: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
    });

    res.json(gradeScale);
  } catch (error) {
    next(error);
  }
};

/**
 * Eliminar una escala de calificación
 */
export const deleteGradeScale = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verificar que la escala existe
    const existingScale = await prisma.gradeScale.findUnique({
      where: { id },
    });

    if (!existingScale) {
      return res.status(404).json({
        error: 'Escala de calificación no encontrada.',
      });
    }

    // Eliminar la escala (los detalles se eliminan en cascada)
    await prisma.gradeScale.delete({
      where: { id },
    });

    res.json({ message: 'Escala de calificación eliminada exitosamente.' });
  } catch (error) {
    next(error);
  }
};

