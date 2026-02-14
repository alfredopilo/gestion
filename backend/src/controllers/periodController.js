import { randomUUID } from 'crypto';
import prisma from '../config/database.js';
import { createPeriodSchema, updatePeriodSchema, importPeriodSchema, importPeriodsConfigSchema } from '../utils/validators.js';
import { getPeriodInstitutionFilter, verifyPeriodBelongsToInstitution, getActiveSchoolYear, getInstitutionFilter } from '../utils/institutionFilter.js';

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

    // Si se está creando un período supletorio activo, desactivar automáticamente los demás períodos supletorios activos del mismo año lectivo
    if (validatedData.esSupletorio && validatedData.activo) {
      await prisma.period.updateMany({
        where: {
          anioLectivoId: validatedData.anioLectivoId,
          esSupletorio: true,
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

    // Si se está marcando como supletorio y activo, desactivar otros períodos supletorios activos del mismo año lectivo
    const isBecomingSupplementary = (validatedData.esSupletorio === true) && (period.esSupletorio !== true);
    const isActivatingSupplementary = (validatedData.activo === true) && (validatedData.esSupletorio === true || period.esSupletorio === true);
    
    if ((isBecomingSupplementary || isActivatingSupplementary) && validatedData.activo !== false) {
      const anioLectivoId = validatedData.anioLectivoId || period.anioLectivoId;
      if (anioLectivoId) {
        await prisma.period.updateMany({
          where: {
            anioLectivoId: anioLectivoId,
            esSupletorio: true,
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

/**
 * Exportar la configuración de todos los periodos (año lectivo actual)
 * Para poder importarlos en otra institución o como respaldo
 */
export const exportAllPeriodsConfiguration = async (req, res, next) => {
  try {
    const where = {};
    const institutionFilter = await getPeriodInstitutionFilter(req, prisma);
    if (Object.keys(institutionFilter).length > 0) {
      if (institutionFilter.anioLectivoId?.in && institutionFilter.anioLectivoId.in.length === 0) {
        return res.json({
          version: '1.0',
          exportDate: new Date().toISOString(),
          periods: [],
        });
      }
      Object.assign(where, institutionFilter);
    }

    const periods = await prisma.period.findMany({
      where,
      include: {
        subPeriodos: { orderBy: { orden: 'asc' } },
      },
      orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
    });

    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      periods: periods.map((p) => ({
        period: {
          nombre: p.nombre,
          fechaInicio: p.fechaInicio,
          fechaFin: p.fechaFin,
          calificacionMinima: p.calificacionMinima ?? 7.0,
          ponderacion: p.ponderacion ?? 50.0,
          activo: p.activo,
          esSupletorio: p.esSupletorio ?? false,
          orden: p.orden ?? 1,
          anioEscolar: p.anioEscolar,
        },
        subPeriods: (p.subPeriodos || []).map((sp) => ({
          nombre: sp.nombre,
          ponderacion: sp.ponderacion,
          orden: sp.orden ?? 1,
          fechaInicio: sp.fechaInicio ?? null,
          fechaFin: sp.fechaFin ?? null,
        })),
      })),
    };

    res.setHeader('Content-Disposition', `attachment; filename="configuracion-periodos-${new Date().toISOString().split('T')[0]}.json"`);
    res.json(exportData);
  } catch (error) {
    next(error);
  }
};

/**
 * Exportar configuración de un período (periodo + subperíodos) como JSON
 * Retorna estructura sin IDs internos para permitir importación limpia
 */
export const exportPeriod = async (req, res, next) => {
  try {
    const { id } = req.params;

    const period = await prisma.period.findUnique({
      where: { id },
      include: {
        subPeriodos: {
          orderBy: { orden: 'asc' },
        },
      },
    });

    if (!period) {
      return res.status(404).json({
        error: 'Período no encontrado.',
      });
    }

    const hasAccess = await verifyPeriodBelongsToInstitution(req, prisma, id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'No tienes acceso a este período.',
      });
    }

    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      period: {
        nombre: period.nombre,
        fechaInicio: period.fechaInicio,
        fechaFin: period.fechaFin,
        calificacionMinima: period.calificacionMinima ?? 7.0,
        ponderacion: period.ponderacion ?? 50.0,
        activo: period.activo,
        esSupletorio: period.esSupletorio ?? false,
        orden: period.orden ?? 1,
        anioEscolar: period.anioEscolar,
      },
      subPeriods: (period.subPeriodos || []).map((sp) => ({
        nombre: sp.nombre,
        ponderacion: sp.ponderacion,
        orden: sp.orden ?? 1,
        fechaInicio: sp.fechaInicio ?? null,
        fechaFin: sp.fechaFin ?? null,
      })),
    };

    res.setHeader('Content-Disposition', `attachment; filename="periodo-${period.nombre.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.json"`);
    res.json(exportData);
  } catch (error) {
    next(error);
  }
};

/**
 * Helper: crea un período con sus subperíodos en transacción
 */
async function createPeriodWithSubPeriods(tx, periodData, subPeriodsData, schoolYear) {
  const anioEscolar = periodData.anioEscolar || schoolYear.nombre;
  const fechaInicio = typeof periodData.fechaInicio === 'string' ? new Date(periodData.fechaInicio) : periodData.fechaInicio;
  const fechaFin = typeof periodData.fechaFin === 'string' ? new Date(periodData.fechaFin) : periodData.fechaFin;

  const newPeriod = await tx.period.create({
    data: {
      id: randomUUID(),
      nombre: periodData.nombre,
      fechaInicio,
      fechaFin,
      calificacionMinima: periodData.calificacionMinima,
      ponderacion: periodData.ponderacion ?? 50.0,
      activo: periodData.activo,
      esSupletorio: periodData.esSupletorio ?? false,
      orden: periodData.orden ?? 1,
      anioEscolar,
      anioLectivoId: schoolYear.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  for (const sp of subPeriodsData) {
    await tx.subPeriod.create({
      data: {
        id: randomUUID(),
        periodoId: newPeriod.id,
        nombre: sp.nombre,
        ponderacion: sp.ponderacion,
        orden: sp.orden,
        fechaInicio: sp.fechaInicio && sp.fechaInicio !== null
          ? (typeof sp.fechaInicio === 'string' ? new Date(sp.fechaInicio) : sp.fechaInicio)
          : null,
        fechaFin: sp.fechaFin && sp.fechaFin !== null
          ? (typeof sp.fechaFin === 'string' ? new Date(sp.fechaFin) : sp.fechaFin)
          : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  return tx.period.findUnique({
    where: { id: newPeriod.id },
    include: { subPeriodos: { orderBy: { orden: 'asc' } } },
  });
}

/**
 * Importar configuración de períodos desde JSON
 * Acepta formato single { period, subPeriods } o múltiple { periods: [...] }
 */
export const importPeriod = async (req, res, next) => {
  try {
    let rawData = req.body;
    if (typeof rawData === 'string') {
      try {
        rawData = JSON.parse(rawData);
      } catch {
        return res.status(400).json({
          error: 'El archivo no contiene JSON válido.',
        });
      }
    }

    const schoolYear = await getActiveSchoolYear(req, prisma);
    if (!schoolYear) {
      return res.status(400).json({
        error: 'No hay un año escolar activo configurado. Por favor, crea y activa un año escolar primero.',
      });
    }

    let itemsToImport = [];

    const multiResult = importPeriodsConfigSchema.safeParse(rawData);
    if (multiResult.success && multiResult.data.periods?.length > 0) {
      itemsToImport = multiResult.data.periods;
    } else {
      const singleResult = importPeriodSchema.safeParse(rawData);
      if (!singleResult.success) {
        return res.status(400).json({
          error: 'Estructura de importación inválida.',
          details: singleResult.error.issues,
        });
      }
      itemsToImport = [{ period: singleResult.data.period, subPeriods: singleResult.data.subPeriods || [] }];
    }

    for (const item of itemsToImport) {
      const { period: periodData, subPeriods: subPeriodsData } = item;

      const existingPeriod = await prisma.period.findFirst({
        where: {
          anioLectivoId: schoolYear.id,
          nombre: periodData.nombre,
        },
      });

      if (existingPeriod) {
        return res.status(409).json({
          error: `Ya existe un período con el nombre "${periodData.nombre}" en el año lectivo actual.`,
        });
      }

      const sumaPonderacion = subPeriodsData.reduce((sum, sp) => sum + sp.ponderacion, 0);
      if (sumaPonderacion > 100.01) {
        return res.status(400).json({
          error: `La suma de ponderaciones de subperíodos de "${periodData.nombre}" (${sumaPonderacion.toFixed(2)}%) excede 100%.`,
        });
      }
    }

    let activatedAny = false;
    for (const item of itemsToImport) {
      const { period: periodData, subPeriods: subPeriodsData } = item;
      if (periodData.activo) {
        activatedAny = true;
        break;
      }
    }
    if (activatedAny) {
      await prisma.period.updateMany({
        where: { anioLectivoId: schoolYear.id, activo: true },
        data: { activo: false },
      });
    }
    for (const item of itemsToImport) {
      const { period: periodData } = item;
      if (periodData.esSupletorio && periodData.activo) {
        await prisma.period.updateMany({
          where: {
            anioLectivoId: schoolYear.id,
            esSupletorio: true,
            activo: true,
          },
          data: { activo: false },
        });
        break;
      }
    }

    const createdPeriods = [];
    for (const item of itemsToImport) {
      const { period: periodData, subPeriods: subPeriodsData } = item;
      const created = await prisma.$transaction((tx) =>
        createPeriodWithSubPeriods(tx, periodData, subPeriodsData, schoolYear)
      );
      createdPeriods.push(created);
    }

    res.status(201).json({
      message: itemsToImport.length === 1
        ? 'Período importado exitosamente.'
        : `${itemsToImport.length} períodos importados exitosamente.`,
      period: createdPeriods[0],
      periods: createdPeriods.length > 1 ? createdPeriods : undefined,
    });
  } catch (error) {
    next(error);
  }
};

