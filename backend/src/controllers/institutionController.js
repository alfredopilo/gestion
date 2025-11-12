import prisma from '../config/database.js';
import { createInstitutionSchema, updateInstitutionSchema } from '../utils/validators.js';

/**
 * Obtener todas las instituciones
 * Ruta pública (puede ser llamada sin autenticación para login)
 */
export const getInstitutions = async (req, res, next) => {
  try {
    // Obtener solo datos básicos si no hay autenticación (para login)
    const institutions = await prisma.institution.findMany({
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        activa: true,
        // Solo incluir conteos si hay usuario autenticado
        ...(req.user ? {
          _count: {
            select: {
              aniosLectivos: true,
              usuarios: true,
            },
          },
        } : {}),
      },
    });

    res.json({
      data: institutions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener una institución por ID
 */
export const getInstitutionById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const institution = await prisma.institution.findUnique({
      where: { id },
      include: {
        aniosLectivos: {
          orderBy: { nombre: 'desc' },
        },
        _count: {
          select: {
            usuarios: true,
          },
        },
      },
    });

    if (!institution) {
      return res.status(404).json({
        error: 'Institución no encontrada.',
      });
    }

    res.json(institution);
  } catch (error) {
    next(error);
  }
};

/**
 * Crear una nueva institución
 */
export const createInstitution = async (req, res, next) => {
  try {
    const validatedData = createInstitutionSchema.parse(req.body);

    const institution = await prisma.institution.create({
      data: validatedData,
    });

    res.status(201).json({
      message: 'Institución creada exitosamente.',
      institution,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Actualizar una institución
 */
export const updateInstitution = async (req, res, next) => {
  try {
    const { id } = req.params;
    const validatedData = updateInstitutionSchema.parse(req.body);

    const institution = await prisma.institution.findUnique({
      where: { id },
    });

    if (!institution) {
      return res.status(404).json({
        error: 'Institución no encontrada.',
      });
    }

    const updatedInstitution = await prisma.institution.update({
      where: { id },
      data: validatedData,
    });

    res.json({
      message: 'Institución actualizada exitosamente.',
      institution: updatedInstitution,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Eliminar una institución
 */
export const deleteInstitution = async (req, res, next) => {
  try {
    const { id } = req.params;

    const institution = await prisma.institution.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            aniosLectivos: true,
            usuarios: true,
          },
        },
      },
    });

    if (!institution) {
      return res.status(404).json({
        error: 'Institución no encontrada.',
      });
    }

    if (institution._count.aniosLectivos > 0 || institution._count.usuarios > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar una institución que tiene años lectivos o usuarios asociados.',
      });
    }

    await prisma.institution.delete({
      where: { id },
    });

    res.json({
      message: 'Institución eliminada exitosamente.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener la institución activa
 */
export const getActiveInstitution = async (req, res, next) => {
  try {
    const institution = await prisma.institution.findFirst({
      where: { activa: true },
      include: {
        aniosLectivos: {
          where: { activo: true },
          include: {
            periods: {
              where: { activo: true },
              include: {
                subPeriodos: {
                  orderBy: { orden: 'asc' },
                },
              },
            },
            courses: true,
          },
        },
      },
    });

    if (!institution) {
      return res.status(404).json({
        error: 'No hay una institución activa configurada.',
      });
    }

    res.json(institution);
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener instituciones del usuario
 */
export const getUserInstitutions = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Si es ADMIN, obtener todas las instituciones
    if (req.user.rol === 'ADMIN') {
      const institutions = await prisma.institution.findMany({
        orderBy: { nombre: 'asc' },
      });
      return res.json({ data: institutions });
    }
    
    // Obtener institución del usuario
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        institucion: true,
      },
    });
    
    const institutions = [];
    
    // Agregar institución del usuario si existe
    if (user?.institucion) {
      institutions.push(user.institucion);
    }
    
    // También agregar la institución activa del sistema si es diferente
    const activeInstitution = await prisma.institution.findFirst({
      where: { activa: true },
    });
    
    if (activeInstitution && !institutions.find(i => i.id === activeInstitution.id)) {
      institutions.push(activeInstitution);
    }
    
    res.json({ data: institutions });
  } catch (error) {
    next(error);
  }
};

/**
 * Establecer una institución como activa
 */
export const setActiveInstitution = async (req, res, next) => {
  try {
    const { id } = req.params;

    const institution = await prisma.institution.findUnique({
      where: { id },
    });

    if (!institution) {
      return res.status(404).json({
        error: 'Institución no encontrada.',
      });
    }

    // Activar la institución seleccionada sin desactivar las demás
    const updatedInstitution = await prisma.institution.update({
      where: { id },
      data: { activa: true },
      include: {
        aniosLectivos: {
          orderBy: { nombre: 'desc' },
        },
      },
    });

    res.json({
      message: 'Institución marcada como activa exitosamente.',
      institution: updatedInstitution,
    });
  } catch (error) {
    next(error);
  }
};

