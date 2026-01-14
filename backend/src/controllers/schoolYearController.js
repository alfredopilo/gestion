import { randomUUID } from 'crypto';
import prisma from '../config/database.js';
import { createSchoolYearSchema, createSchoolYearBasicSchema, updateSchoolYearSchema } from '../utils/validators.js';
import { getSchoolYearInstitutionFilter, getActiveSchoolYear } from '../utils/institutionFilter.js';

/**
 * Obtener todos los años lectivos de la institución seleccionada
 */
export const getSchoolYears = async (req, res, next) => {
  try {
    // Obtener la institución del filtro (header o usuario)
    const institutionId = req.institutionId || req.user?.institucionId;
    
    // SIEMPRE filtrar por institución (excepto para ADMIN que puede ver todo)
    const where = {};
    if (institutionId) {
      where.institucionId = institutionId;
    } else if (req.user?.rol !== 'ADMIN') {
      // Si no hay institución y no es ADMIN, no mostrar nada
      return res.json({
        data: [],
      });
    }
    
    const schoolYears = await prisma.schoolYear.findMany({
      where,
      include: {
        institucion: {
          select: {
            id: true,
            nombre: true,
          },
        },
        _count: {
          select: {
            periods: true,
          },
        },
      },
      orderBy: { nombre: 'desc' },
    });

    res.json({
      data: schoolYears,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener un año lectivo por ID
 */
export const getSchoolYearById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const schoolYear = await prisma.schoolYear.findUnique({
      where: { id },
      include: {
        institucion: true,
        periods: {
          orderBy: { orden: 'asc' },
          include: {
            subPeriodos: {
              orderBy: { orden: 'asc' },
            },
          },
        },
      },
    });

    if (!schoolYear) {
      return res.status(404).json({
        error: 'Año lectivo no encontrado.',
      });
    }

    res.json(schoolYear);
  } catch (error) {
    next(error);
  }
};

/**
 * Crear un nuevo año lectivo
 */
export const createSchoolYear = async (req, res, next) => {
  try {
    console.log('=== CREAR AÑO ESCOLAR ===');
    console.log('Body recibido:', JSON.stringify(req.body, null, 2));
    
    // Primero validar los datos básicos sin institucionId
    const basicData = {
      ano: req.body.ano,
      nombre: req.body.nombre, // Opcional, se generará automáticamente
      fechaInicio: req.body.fechaInicio,
      fechaFin: req.body.fechaFin,
      activo: req.body.activo || false,
    };

    console.log('Datos básicos preparados:', JSON.stringify(basicData, null, 2));

    // Validar primero los datos básicos (sin institucionId)
    let validatedBasicData = createSchoolYearBasicSchema.parse(basicData);
    
    // Generar nombre automáticamente desde el año si no se proporciona
    if (!validatedBasicData.nombre) {
      validatedBasicData.nombre = `${validatedBasicData.ano}-${validatedBasicData.ano + 1}`;
    }
    
    console.log('Datos básicos validados:', JSON.stringify(validatedBasicData, null, 2));

    // Obtener la institución del header/usuario si no se proporciona institucionId
    let institucionId = req.body.institucionId || req.institutionId;
    if (!institucionId) {
      // Obtener la institución activa del sistema
      const activeInstitution = await prisma.institution.findFirst({
        where: { activa: true },
        select: { id: true },
      });

      if (!activeInstitution) {
        // Intentar obtener la institución del usuario
        const userInstitutions = await prisma.userInstitution.findMany({
          where: { userId: req.user.id },
          select: { institucionId: true },
          take: 1,
        });

        if (userInstitutions.length === 0) {
          return res.status(400).json({
            error: 'No se puede determinar la institución. Por favor, proporciona un ID de institución o asegúrate de tener una institución activa configurada.',
          });
        }

        institucionId = userInstitutions[0].institucionId;
      } else {
        institucionId = activeInstitution.id;
      }
    }

    // Preparar datos finales con institucionId
    const validatedData = {
      ...validatedBasicData,
      institucionId,
    };

    console.log('Datos validados:', JSON.stringify(validatedData, null, 2));

    // Convertir fechas string a Date si es necesario
    // Manejar tanto formato ISO datetime como formato YYYY-MM-DD
    if (typeof validatedData.fechaInicio === 'string') {
      const fechaInicio = new Date(validatedData.fechaInicio);
      fechaInicio.setHours(0, 0, 0, 0); // Establecer inicio del día
      validatedData.fechaInicio = fechaInicio;
    }
    if (typeof validatedData.fechaFin === 'string') {
      const fechaFin = new Date(validatedData.fechaFin);
      fechaFin.setHours(23, 59, 59, 999); // Establecer fin del día
      validatedData.fechaFin = fechaFin;
    }

    // Verificar que la institución existe
    const institution = await prisma.institution.findUnique({
      where: { id: validatedData.institucionId },
    });

    if (!institution) {
      return res.status(404).json({
        error: 'Institución no encontrada.',
      });
    }

    // Verificar que no exista un año escolar con el mismo nombre en la misma institución
    const existingSchoolYear = await prisma.schoolYear.findFirst({
      where: {
        nombre: validatedData.nombre,
        institucionId: validatedData.institucionId,
      },
    });

    if (existingSchoolYear) {
      return res.status(409).json({
        error: 'Ya existe un registro con estos datos.',
        details: ['nombre'],
      });
    }

    const schoolYearData = {
      id: randomUUID(),
      ...validatedData,
      updatedAt: new Date(),
    };

    // Verificar que solo haya un año activo por institución
    if (validatedData.activo) {
      await prisma.schoolYear.updateMany({
        where: {
          activo: true,
          id: { not: schoolYearData.id },
          institucionId: validatedData.institucionId, // Solo desactivar años de la misma institución
        },
        data: { activo: false, updatedAt: new Date() },
      });
    }

    const schoolYear = await prisma.schoolYear.create({
      data: schoolYearData,
      include: {
        institucion: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
    });

    res.status(201).json({
      message: 'Año lectivo creado exitosamente.',
      schoolYear,
    });
  } catch (error) {
    // Log del error para debugging
    console.error('=== ERROR AL CREAR AÑO ESCOLAR ===');
    console.error('Tipo de error:', error.name);
    console.error('Mensaje:', error.message);
    if (error.name === 'ZodError') {
      console.error('Errores de validación detallados:');
      error.issues.forEach((issue, index) => {
        console.error(`Error ${index + 1}:`, {
          path: issue.path?.join('.'),
          code: issue.code,
          message: issue.message,
          received: issue.received,
          expected: issue.expected,
        });
      });
      console.error('Datos recibidos en req.body:', JSON.stringify(req.body, null, 2));
    }
    console.error('Stack:', error.stack);
    next(error);
  }
};

/**
 * Actualizar un año lectivo
 */
export const updateSchoolYear = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log('Actualizando año escolar:', id, 'con datos:', req.body);
    let validatedData = updateSchoolYearSchema.parse(req.body);

    // Convertir fechas string a Date si es necesario
    // Manejar tanto formato ISO datetime como formato YYYY-MM-DD
    if (validatedData.fechaInicio && typeof validatedData.fechaInicio === 'string') {
      const fechaInicio = new Date(validatedData.fechaInicio);
      fechaInicio.setHours(0, 0, 0, 0); // Establecer inicio del día
      validatedData.fechaInicio = fechaInicio;
    }
    if (validatedData.fechaFin && typeof validatedData.fechaFin === 'string') {
      const fechaFin = new Date(validatedData.fechaFin);
      fechaFin.setHours(23, 59, 59, 999); // Establecer fin del día
      validatedData.fechaFin = fechaFin;
    }

    const schoolYear = await prisma.schoolYear.findUnique({
      where: { id },
    });

    if (!schoolYear) {
      return res.status(404).json({
        error: 'Año lectivo no encontrado.',
      });
    }

    // Si se está cambiando el año, generar el nombre automáticamente
    if (validatedData.ano && validatedData.ano !== schoolYear.ano) {
      validatedData.nombre = `${validatedData.ano}-${validatedData.ano + 1}`;
    } else if (validatedData.ano && !validatedData.nombre) {
      // Si solo se proporciona el año sin nombre, generar el nombre
      validatedData.nombre = `${validatedData.ano}-${validatedData.ano + 1}`;
    }

    // Si se está cambiando el nombre, verificar que no exista otro con el mismo nombre en la misma institución
    if (validatedData.nombre && validatedData.nombre !== schoolYear.nombre) {
      const existingSchoolYear = await prisma.schoolYear.findFirst({
        where: {
          nombre: validatedData.nombre,
          id: { not: id },
          institucionId: schoolYear.institucionId,
        },
      });

      if (existingSchoolYear) {
        return res.status(409).json({
          error: 'Ya existe un año escolar con este nombre.',
          details: ['nombre'],
        });
      }

      // Mantener sincronizado el campo denormalizado anioEscolar en los períodos asociados
      await prisma.period.updateMany({
        where: { anioLectivoId: id },
        data: { anioEscolar: validatedData.nombre },
      });
    }

    // Si se está activando este año, desactivar todos los demás (global)
    if (validatedData.activo === true && !schoolYear.activo) {
      await prisma.schoolYear.updateMany({
        where: {
          activo: true,
          id: { not: id },
        },
        data: { activo: false, updatedAt: new Date() },
      });
    }

    validatedData.updatedAt = new Date();

    const updatedSchoolYear = await prisma.schoolYear.update({
      where: { id },
      data: validatedData,
      include: {
        institucion: {
          select: {
            id: true,
            nombre: true,
          },
        },
        periods: {
          orderBy: { orden: 'asc' },
        },
      },
    });

    res.json({
      message: 'Año lectivo actualizado exitosamente.',
      schoolYear: updatedSchoolYear,
    });
  } catch (error) {
    // Log del error para debugging
    console.error('Error al actualizar año escolar:', error);
    if (error.name === 'ZodError') {
      console.error('Errores de validación:', JSON.stringify(error.issues, null, 2));
      console.error('Datos recibidos:', JSON.stringify(req.body, null, 2));
    }
    next(error);
  }
};

/**
 * Eliminar un año lectivo
 */
export const deleteSchoolYear = async (req, res, next) => {
  try {
    const { id } = req.params;

    const schoolYear = await prisma.schoolYear.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            periods: true,
          },
        },
      },
    });

    if (!schoolYear) {
      return res.status(404).json({
        error: 'Año lectivo no encontrado.',
      });
    }

    if (schoolYear._count.periods > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar un año lectivo que tiene períodos asociados.',
      });
    }

    await prisma.schoolYear.delete({
      where: { id },
    });

    res.json({
      message: 'Año lectivo eliminado exitosamente.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Establecer un año lectivo como activo
 */
export const setActiveSchoolYear = async (req, res, next) => {
  try {
    const { id } = req.params;

    const schoolYear = await prisma.schoolYear.findUnique({
      where: { id },
      include: {
        institucion: true,
      },
    });

    if (!schoolYear) {
      return res.status(404).json({
        error: 'Año lectivo no encontrado.',
      });
    }

    // Verificar que el año escolar pertenece a la institución seleccionada (si no es ADMIN)
    const institutionId = req.institutionId || req.user?.institucionId;
    if (institutionId && schoolYear.institucionId !== institutionId && req.user?.rol !== 'ADMIN') {
      return res.status(403).json({
        error: 'No tienes permiso para activar este año escolar. Debe pertenecer a tu institución.',
      });
    }

    const updatedSchoolYear = await prisma.$transaction(async (tx) => {
      // Desactivar todos los demás años escolares DE LA MISMA INSTITUCIÓN
      await tx.schoolYear.updateMany({
        where: {
          activo: true,
          id: { not: id },
          institucionId: schoolYear.institucionId, // Solo desactivar años de la misma institución
        },
        data: { activo: false, updatedAt: new Date() },
      });

      // Activar el año escolar seleccionado
      return tx.schoolYear.update({
        where: { id },
        data: { activo: true, updatedAt: new Date() },
        include: {
          institucion: {
            select: {
              id: true,
              nombre: true,
            },
          },
          periods: {
            orderBy: { orden: 'asc' },
          },
        },
      });
    });

    res.json({
      message: 'Año lectivo activo actualizado exitosamente.',
      schoolYear: updatedSchoolYear,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener el año escolar activo para la institución actual
 */
export const getActiveSchoolYearController = async (req, res, next) => {
  try {
    // Obtener el año escolar activo de la institución seleccionada
    const activeSchoolYear = await getActiveSchoolYear(req, prisma);
    
    if (!activeSchoolYear) {
      // Devolver 200 con null en lugar de 404 para que el frontend pueda manejarlo mejor
      return res.status(200).json(null);
    }
    
    // Verificar que el año activo pertenece a la institución seleccionada (si no es ADMIN)
    const institutionId = req.institutionId || req.user?.institucionId;
    if (institutionId && activeSchoolYear.institucionId !== institutionId && req.user?.rol !== 'ADMIN') {
      // Si el año activo no pertenece a la institución, devolver null
      return res.status(200).json(null);
    }

    res.json(activeSchoolYear);
  } catch (error) {
    console.error('Error al obtener año escolar activo:', error);
    next(error);
  }
};

