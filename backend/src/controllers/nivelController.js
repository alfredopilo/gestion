import prisma from '../config/database.js';
import { getInstitutionFilter, getAccessibleInstitutionIds } from '../utils/institutionFilter.js';
import { createNivelSchema, updateNivelSchema } from '../utils/validators.js';

/**
 * Listar niveles de la institución
 */
export const getNiveles = async (req, res, next) => {
  try {
    const institutionId = getInstitutionFilter(req);
    const where = {};
    if (institutionId) {
      where.institucionId = institutionId;
    } else if (req.user?.rol !== 'ADMIN') {
      return res.json({ data: [] });
    }

    const niveles = await prisma.nivel.findMany({
      where,
      include: {
        institucion: { select: { id: true, nombre: true } },
        _count: { select: { cursos: true } },
      },
      orderBy: { nombreNivel: 'asc' },
    });
    res.json({ data: niveles });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener un nivel por ID
 */
export const getNivelById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const institutionId = getInstitutionFilter(req);

    const nivel = await prisma.nivel.findUnique({
      where: { id },
      include: {
        institucion: { select: { id: true, nombre: true } },
        _count: { select: { cursos: true } },
      },
    });

    if (!nivel) {
      return res.status(404).json({ error: 'Nivel no encontrado.' });
    }
    if (institutionId && nivel.institucionId !== institutionId && req.user?.rol !== 'ADMIN') {
      return res.status(403).json({ error: 'No tienes acceso a este nivel.' });
    }
    res.json(nivel);
  } catch (error) {
    next(error);
  }
};

/**
 * Crear nivel
 */
export const createNivel = async (req, res, next) => {
  try {
    const validatedData = createNivelSchema.parse(req.body);
    const institutionId = getInstitutionFilter(req) || req.headers['x-institution-id'];

    if (!institutionId && req.user?.rol !== 'ADMIN') {
      return res.status(400).json({
        error: 'Debe tener una institución seleccionada para crear un nivel.',
      });
    }

    if (institutionId && req.user?.rol !== 'ADMIN') {
      const accessible = getAccessibleInstitutionIds(req);
      if (!accessible.includes(institutionId)) {
        return res.status(403).json({
          error: 'No tienes permiso para crear niveles en esta institución.',
        });
      }
    }

    const finalInstitutionId = institutionId;
    if (!finalInstitutionId) {
      return res.status(400).json({
        error: 'Debe seleccionar una institución para crear un nivel.',
      });
    }

    const existing = await prisma.nivel.findUnique({
      where: {
        institucionId_nombreNivel: {
          institucionId: finalInstitutionId,
          nombreNivel: validatedData.nombreNivel.trim(),
        },
      },
    });
    if (existing) {
      return res.status(409).json({
        error: `Ya existe un nivel con el nombre "${validatedData.nombreNivel}" en esta institución.`,
      });
    }

    const nivel = await prisma.nivel.create({
      data: {
        nombreNivel: validatedData.nombreNivel.trim(),
        numeroHorasClases: validatedData.numeroHorasClases,
        institucionId: finalInstitutionId,
      },
      include: { institucion: { select: { id: true, nombre: true } } },
    });
    res.status(201).json(nivel);
  } catch (error) {
    next(error);
  }
};

/**
 * Actualizar nivel
 */
export const updateNivel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const validatedData = updateNivelSchema.parse(req.body);
    const institutionId = getInstitutionFilter(req);

    const nivel = await prisma.nivel.findUnique({ where: { id } });
    if (!nivel) {
      return res.status(404).json({ error: 'Nivel no encontrado.' });
    }
    if (institutionId && nivel.institucionId !== institutionId && req.user?.rol !== 'ADMIN') {
      return res.status(403).json({ error: 'No tienes acceso a este nivel.' });
    }

    if (validatedData.nombreNivel !== undefined) {
      const existing = await prisma.nivel.findFirst({
        where: {
          institucionId: nivel.institucionId,
          nombreNivel: validatedData.nombreNivel.trim(),
          id: { not: id },
        },
      });
      if (existing) {
        return res.status(409).json({
          error: `Ya existe un nivel con el nombre "${validatedData.nombreNivel}" en esta institución.`,
        });
      }
    }

    const updated = await prisma.nivel.update({
      where: { id },
      data: {
        ...(validatedData.nombreNivel !== undefined && { nombreNivel: validatedData.nombreNivel.trim() }),
        ...(validatedData.numeroHorasClases !== undefined && { numeroHorasClases: validatedData.numeroHorasClases }),
      },
      include: { institucion: { select: { id: true, nombre: true } } },
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

/**
 * Eliminar nivel (solo si no tiene cursos asignados)
 */
export const deleteNivel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const institutionId = getInstitutionFilter(req);

    const nivel = await prisma.nivel.findUnique({
      where: { id },
      include: { _count: { select: { cursos: true } } },
    });
    if (!nivel) {
      return res.status(404).json({ error: 'Nivel no encontrado.' });
    }
    if (institutionId && nivel.institucionId !== institutionId && req.user?.rol !== 'ADMIN') {
      return res.status(403).json({ error: 'No tienes acceso a este nivel.' });
    }
    if (nivel._count.cursos > 0) {
      return res.status(400).json({
        error: `No se puede eliminar el nivel porque tiene ${nivel._count.cursos} curso(s) asignado(s). Reasigna los cursos antes de eliminarlo.`,
      });
    }

    await prisma.nivel.delete({ where: { id } });
    res.json({ message: 'Nivel eliminado correctamente.' });
  } catch (error) {
    next(error);
  }
};
