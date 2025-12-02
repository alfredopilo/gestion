import prisma from '../config/database.js';
import { createInsumoSchema, updateInsumoSchema } from '../utils/validators.js';
import { getInsumoInstitutionFilter, verifyCourseBelongsToInstitution, getInstitutionFilter } from '../utils/institutionFilter.js';

/**
 * Obtener todos los insumos
 */
export const getInsumos = async (req, res, next) => {
  try {
    const { cursoId, materiaId, subPeriodoId, activo } = req.query;

    const where = {};
    
    // Filtrar por institución
    const institutionFilter = await getInsumoInstitutionFilter(req, prisma);
    if (Object.keys(institutionFilter).length > 0) {
      if (institutionFilter.cursoId?.in && institutionFilter.cursoId.in.length === 0) {
        return res.json({
          data: [],
        });
      }
      Object.assign(where, institutionFilter);
    }
    
    if (cursoId) where.cursoId = cursoId;
    if (materiaId) where.materiaId = materiaId;
    if (subPeriodoId) where.subPeriodoId = subPeriodoId;
    if (activo !== undefined) where.activo = activo === 'true';

    const insumos = await prisma.insumo.findMany({
      where,
      include: {
        curso: {
          select: {
            id: true,
            nombre: true,
            nivel: true,
            paralelo: true,
          },
        },
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
      orderBy: [
        { orden: 'asc' },
        { nombre: 'asc' },
      ],
    });

    // Log para depuración
    console.log('Insumos encontrados:', insumos.length);
    if (insumos.length > 0) {
      console.log('Primer insumo:', {
        id: insumos[0].id,
        nombre: insumos[0].nombre,
        cursoId: insumos[0].cursoId,
        materiaId: insumos[0].materiaId,
        fechaDeber: insumos[0].fechaDeber,
        fechaEntrega: insumos[0].fechaEntrega,
      });
    }

    res.json({
      data: insumos,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener un insumo por ID
 */
export const getInsumoById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const insumo = await prisma.insumo.findUnique({
      where: { id },
      include: {
        curso: true,
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

    if (!insumo) {
      return res.status(404).json({
        error: 'Insumo no encontrado.',
      });
    }
    
    // Verificar que el insumo pertenece a la institución del usuario
    await verifyCourseBelongsToInstitution(req, prisma, insumo.cursoId);

    res.json(insumo);
  } catch (error) {
    next(error);
  }
};

/**
 * Crear un nuevo insumo
 */
export const createInsumo = async (req, res, next) => {
  try {
    let validatedData = createInsumoSchema.parse(req.body);

    // Convertir fechas de string a Date si es necesario
    const insumoData = {
      ...validatedData,
      fechaDeber: validatedData.fechaDeber instanceof Date 
        ? validatedData.fechaDeber 
        : new Date(validatedData.fechaDeber),
      fechaEntrega: validatedData.fechaEntrega 
        ? (validatedData.fechaEntrega instanceof Date 
            ? validatedData.fechaEntrega 
            : new Date(validatedData.fechaEntrega))
        : null,
    };

    // Verificar que el curso existe y pertenece a la institución
    const curso = await prisma.course.findUnique({
      where: { id: insumoData.cursoId },
    });

    if (!curso) {
      return res.status(404).json({
        error: 'Curso no encontrado.',
      });
    }
    
    // Verificar que el curso pertenece a la institución del usuario
    await verifyCourseBelongsToInstitution(req, prisma, insumoData.cursoId);

    // Verificar que la materia existe y pertenece a la institución
    const materia = await prisma.subject.findUnique({
      where: { id: insumoData.materiaId },
    });

    if (!materia) {
      return res.status(404).json({
        error: 'Materia no encontrada.',
      });
    }
    
    // Verificar que la materia pertenece a la institución del usuario
    const institutionId = getInstitutionFilter(req);
    if (institutionId && materia.institucionId !== institutionId) {
      return res.status(403).json({
        error: 'La materia no pertenece a tu institución.',
      });
    }

    // Verificar que el subperíodo existe
    const subPeriodo = await prisma.subPeriod.findUnique({
      where: { id: insumoData.subPeriodoId },
      include: {
        insumos: {
          where: {
            cursoId: insumoData.cursoId,
            materiaId: insumoData.materiaId,
          },
        },
      },
    });

    if (!subPeriodo) {
      return res.status(404).json({
        error: 'Subperíodo no encontrado.',
      });
    }

    // Verificar que no exista otro insumo con la misma combinación (curso, materia, subperíodo, nombre)
    const existing = await prisma.insumo.findFirst({
      where: {
        cursoId: insumoData.cursoId,
        materiaId: insumoData.materiaId,
        subPeriodoId: insumoData.subPeriodoId,
        nombre: insumoData.nombre,
      },
    });

    if (existing) {
      return res.status(409).json({
        error: 'Ya existe un insumo con este nombre para esta combinación de curso, materia y subperíodo.',
      });
    }

    // Si no se proporciona orden, asignar el siguiente disponible
    if (!insumoData.orden) {
      const maxOrden = subPeriodo.insumos.reduce((max, insumo) => {
        return insumo.orden && insumo.orden > max ? insumo.orden : max;
      }, 0);
      insumoData.orden = maxOrden + 1;
    }

    const insumo = await prisma.insumo.create({
      data: insumoData,
      include: {
        subPeriodo: {
          select: {
            id: true,
            nombre: true,
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

    res.status(201).json({
      message: 'Insumo creado exitosamente.',
      insumo,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Actualizar un insumo
 */
export const updateInsumo = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Remover cursoId, materiaId y subPeriodoId si vienen en el body (no se pueden cambiar en actualización)
    const { cursoId, materiaId, subPeriodoId, ...bodyWithoutIds } = req.body;
    
    let validatedData = updateInsumoSchema.parse(bodyWithoutIds);

    // Convertir fechas de string a Date si es necesario
    const updateData = { ...validatedData };
    if (validatedData.fechaDeber) {
      updateData.fechaDeber = validatedData.fechaDeber instanceof Date 
        ? validatedData.fechaDeber 
        : new Date(validatedData.fechaDeber);
    }
    if (validatedData.fechaEntrega !== undefined) {
      updateData.fechaEntrega = validatedData.fechaEntrega 
        ? (validatedData.fechaEntrega instanceof Date 
            ? validatedData.fechaEntrega 
            : new Date(validatedData.fechaEntrega))
        : null;
    }

    const insumo = await prisma.insumo.findUnique({
      where: { id },
      include: {
        curso: true,
        materia: true,
        subPeriodo: {
          include: {
            insumos: true,
          },
        },
      },
    });

    if (!insumo) {
      return res.status(404).json({
        error: 'Insumo no encontrado.',
      });
    }
    
    // Verificar que el insumo pertenece a la institución del usuario
    await verifyCourseBelongsToInstitution(req, prisma, insumo.cursoId);

    // Si se actualiza el nombre, verificar que no exista otro con el mismo nombre para la misma combinación
    if (validatedData.nombre && validatedData.nombre !== insumo.nombre) {
      const existing = await prisma.insumo.findFirst({
        where: {
          cursoId: insumo.cursoId,
          materiaId: insumo.materiaId,
          subPeriodoId: insumo.subPeriodoId,
          nombre: validatedData.nombre,
        },
      });

      if (existing) {
        return res.status(409).json({
          error: 'Ya existe un insumo con este nombre para esta combinación de curso, materia y subperíodo.',
        });
      }
    }

    const updatedInsumo = await prisma.insumo.update({
      where: { id },
      data: updateData,
      include: {
        subPeriodo: {
          select: {
            id: true,
            nombre: true,
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
      message: 'Insumo actualizado exitosamente.',
      insumo: updatedInsumo,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Eliminar un insumo
 */
export const deleteInsumo = async (req, res, next) => {
  try {
    const { id } = req.params;

    const insumo = await prisma.insumo.findUnique({
      where: { id },
      include: {
        curso: true,
      },
    });

    if (!insumo) {
      return res.status(404).json({
        error: 'Insumo no encontrado.',
      });
    }
    
    // Verificar que el insumo pertenece a la institución del usuario
    await verifyCourseBelongsToInstitution(req, prisma, insumo.cursoId);

    await prisma.insumo.delete({
      where: { id },
    });

    res.json({
      message: 'Insumo eliminado exitosamente.',
    });
  } catch (error) {
    next(error);
  }
};

