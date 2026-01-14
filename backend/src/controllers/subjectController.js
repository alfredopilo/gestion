import prisma from '../config/database.js';
import { createSubjectSchema } from '../utils/validators.js';
import { getSubjectInstitutionFilter, getActiveSchoolYear, getInstitutionFilter } from '../utils/institutionFilter.js';
import XLSX from 'xlsx';

/**
 * Obtener todas las materias
 */
export const getSubjects = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Filtrar por institución
    const institutionFilter = await getSubjectInstitutionFilter(req, prisma);
    const where = Object.keys(institutionFilter).length > 0 ? institutionFilter : {};
    
    // Si el filtro tiene un array vacío, no devolver nada
    if (where.id?.in && where.id.in.length === 0 && !where.OR) {
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

    const [subjects, total] = await Promise.all([
      prisma.subject.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          institucion: {
            select: {
              id: true,
              nombre: true,
            },
          },
          anioLectivo: {
            select: {
              id: true,
              nombre: true,
              activo: true,
            },
          },
          asignaciones: {
            include: {
              curso: true,
              docente: {
                include: { user: true },
              },
            },
          },
        },
        orderBy: { nombre: 'asc' },
      }),
      prisma.subject.count({ where }),
    ]);

    res.json({
      data: subjects,
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
 * Obtener una materia por ID
 */
export const getSubjectById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const subject = await prisma.subject.findUnique({
      where: { id },
      include: {
        institucion: {
          select: {
            id: true,
            nombre: true,
          },
        },
        anioLectivo: {
          select: {
            id: true,
            nombre: true,
            activo: true,
          },
        },
        asignaciones: {
          include: {
            curso: {
              include: {
                periodo: true,
              },
            },
            docente: {
              include: { user: true },
            },
          },
        },
      },
    });

    if (!subject) {
      return res.status(404).json({
        error: 'Materia no encontrada.',
      });
    }

    res.json(subject);
  } catch (error) {
    next(error);
  }
};

/**
 * Crear una nueva materia
 */
export const createSubject = async (req, res, next) => {
  try {
    const validatedData = createSubjectSchema.parse(req.body);

    // Obtener institución del request
    const institutionId = getInstitutionFilter(req);
    console.log('🔍 [createSubject] institutionId:', institutionId);
    
    if (!institutionId) {
      return res.status(400).json({
        error: 'No se pudo determinar la institución. Debe estar autenticado.',
      });
    }

    // Obtener año lectivo activo de la institución o usar el proporcionado
    let anioLectivoId = validatedData.anioLectivoId;
    console.log('🔍 [createSubject] anioLectivoId del request:', anioLectivoId);
    
    // Normalizar: convertir a null si es undefined, null o string vacío
    if (!anioLectivoId || anioLectivoId === '') {
      anioLectivoId = null;
    }
    
    // Si no se proporcionó un año lectivo, buscar el activo de la institución
    if (!anioLectivoId) {
      console.log('🔍 [createSubject] Buscando año lectivo activo para institución:', institutionId);
      
      // Buscar año lectivo activo de la institución
      const activeSchoolYear = await prisma.schoolYear.findFirst({
        where: {
          institucionId: institutionId,
          activo: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      console.log('🔍 [createSubject] Año lectivo activo encontrado:', activeSchoolYear?.id);

      if (activeSchoolYear) {
        anioLectivoId = activeSchoolYear.id;
      } else {
        console.log('🔍 [createSubject] No hay activo, buscando el más reciente...');
        
        // Si no hay activo, buscar el más reciente de la institución
        const latestSchoolYear = await prisma.schoolYear.findFirst({
          where: {
            institucionId: institutionId,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        console.log('🔍 [createSubject] Año lectivo más reciente encontrado:', latestSchoolYear?.id);

        if (!latestSchoolYear) {
          return res.status(400).json({
            error: 'No se encontró un año lectivo para la institución. Debe crear un año lectivo primero.',
          });
        }

        anioLectivoId = latestSchoolYear.id;
      }
    } else {
      // Verificar que el año lectivo proporcionado pertenece a la institución
      const schoolYear = await prisma.schoolYear.findUnique({
        where: { id: anioLectivoId },
      });

      if (!schoolYear) {
        return res.status(404).json({
          error: 'El año lectivo especificado no existe.',
        });
      }

      if (schoolYear.institucionId !== institutionId) {
        return res.status(403).json({
          error: 'El año lectivo no pertenece a la institución.',
        });
      }
    }

    console.log('✅ [createSubject] Valores finales - institutionId:', institutionId, 'anioLectivoId:', anioLectivoId);

    // Validar que tenemos valores válidos antes de crear
    if (!institutionId) {
      return res.status(400).json({
        error: 'No se pudo determinar la institución.',
      });
    }

    if (!anioLectivoId) {
      return res.status(400).json({
        error: 'No se pudo determinar el año lectivo. Verifique que exista un año lectivo activo para la institución.',
      });
    }

    // Verificación final antes de crear
    if (!institutionId || !anioLectivoId) {
      console.error('❌ [createSubject] Error: Valores faltantes antes de crear subject', {
        institutionId,
        anioLectivoId,
        validatedData,
      });
      return res.status(500).json({
        error: 'Error interno: No se pudieron determinar los valores requeridos para crear la materia.',
      });
    }

    // Verificación final de tipos y valores
    if (typeof institutionId !== 'string' || institutionId.trim() === '') {
      console.error('❌ [createSubject] institutionId inválido:', institutionId, typeof institutionId);
      return res.status(500).json({
        error: 'Error interno: ID de institución inválido.',
      });
    }

    if (typeof anioLectivoId !== 'string' || anioLectivoId.trim() === '') {
      console.error('❌ [createSubject] anioLectivoId inválido:', anioLectivoId, typeof anioLectivoId);
      return res.status(500).json({
        error: 'Error interno: ID de año lectivo inválido.',
      });
    }

    // Construir objeto de datos explícitamente, asegurando que los campos requeridos estén presentes
    const createData = {
      nombre: validatedData.nombre,
      codigo: validatedData.codigo,
      creditos: validatedData.creditos ?? null,
      horas: validatedData.horas ?? null,
      institucionId: institutionId, // Usar directamente el valor obtenido
      anioLectivoId: anioLectivoId, // Usar directamente el valor obtenido
    };

    // Verificar que createData tiene todos los campos necesarios
    console.log('📝 [createSubject] Creando subject con datos:', JSON.stringify(createData, null, 2));
    console.log('📝 [createSubject] Verificación de campos:', {
      tieneNombre: 'nombre' in createData,
      tieneCodigo: 'codigo' in createData,
      tieneInstitucionId: 'institucionId' in createData,
      tieneAnioLectivoId: 'anioLectivoId' in createData,
      valorInstitucionId: createData.institucionId,
      valorAnioLectivoId: createData.anioLectivoId,
      tipoInstitucionId: typeof createData.institucionId,
      tipoAnioLectivoId: typeof createData.anioLectivoId,
    });

    // Verificación final absoluta antes de llamar a Prisma
    if (!createData.institucionId || !createData.anioLectivoId) {
      console.error('❌ [createSubject] ERROR CRÍTICO: Campos faltantes en createData:', {
        createData,
        institutionId,
        anioLectivoId,
      });
      return res.status(500).json({
        error: 'Error interno: Los campos requeridos no están presentes en los datos.',
      });
    }

    // Crear el objeto de datos de forma explícita y directa
    const prismaData = {
      nombre: String(createData.nombre),
      codigo: String(createData.codigo),
      creditos: createData.creditos ?? null,
      horas: createData.horas ?? null,
      institucionId: String(institutionId),
      anioLectivoId: String(anioLectivoId),
    };

    console.log('🔵 [createSubject] Datos que se enviarán a Prisma:', JSON.stringify(prismaData, null, 2));
    console.log('🔵 [createSubject] Verificación final:', {
      'prismaData.institucionId existe': 'institucionId' in prismaData,
      'prismaData.anioLectivoId existe': 'anioLectivoId' in prismaData,
      'prismaData.institucionId valor': prismaData.institucionId,
      'prismaData.anioLectivoId valor': prismaData.anioLectivoId,
    });

    try {
      // Crear el subject SIN include primero para forzar SubjectUncheckedCreateInput
      // (que acepta campos directos como institucionId y anioLectivoId)
      const createdSubject = await prisma.subject.create({
        data: prismaData,
      });

      console.log('✅ [createSubject] Materia creada exitosamente:', createdSubject.id);

      // Ahora obtener el subject con las relaciones usando findUnique
      const subject = await prisma.subject.findUnique({
        where: { id: createdSubject.id },
        include: {
          institucion: {
            select: {
              id: true,
              nombre: true,
            },
          },
          anioLectivo: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
      });

      res.status(201).json({
        message: 'Materia creada exitosamente.',
        subject,
      });
    } catch (prismaError) {
      console.error('❌ [createSubject] Error de Prisma:', {
        code: prismaError.code,
        message: prismaError.message,
        meta: prismaError.meta,
        createData: JSON.stringify(createData, null, 2),
      });
      throw prismaError;
    }
  } catch (error) {
    console.error('❌ [createSubject] Error general:', error);
    next(error);
  }
};

/**
 * Actualizar una materia
 */
export const updateSubject = async (req, res, next) => {
  try {
    const { id } = req.params;

    const subject = await prisma.subject.findUnique({
      where: { id },
    });

    if (!subject) {
      return res.status(404).json({
        error: 'Materia no encontrada.',
      });
    }

    // Verificar que la materia pertenece a la institución del usuario
    const institutionId = getInstitutionFilter(req);
    if (institutionId && subject.institucionId !== institutionId) {
      return res.status(403).json({
        error: 'No tienes acceso a esta materia.',
      });
    }

    // Preparar datos de actualización (no permitir cambiar institución ni año escolar)
    const updateData = { ...req.body };
    delete updateData.institucionId;
    delete updateData.anioLectivoId;

    // Si se intenta cambiar el año lectivo, validar que pertenezca a la institución
    if (req.body.anioLectivoId && req.body.anioLectivoId !== subject.anioLectivoId) {
      const schoolYear = await prisma.schoolYear.findUnique({
        where: { id: req.body.anioLectivoId },
      });

      if (!schoolYear || schoolYear.institucionId !== subject.institucionId) {
        return res.status(400).json({
          error: 'El año lectivo no pertenece a la institución de la materia.',
        });
      }

      updateData.anioLectivoId = req.body.anioLectivoId;
    }

    const updatedSubject = await prisma.subject.update({
      where: { id },
      data: updateData,
      include: {
        institucion: {
          select: {
            id: true,
            nombre: true,
          },
        },
        anioLectivo: {
          select: {
            id: true,
            nombre: true,
            activo: true,
          },
        },
        asignaciones: {
          include: {
            curso: true,
            docente: {
              include: { user: true },
            },
          },
        },
      },
    });

    res.json({
      message: 'Materia actualizada exitosamente.',
      subject: updatedSubject,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Eliminar una materia
 */
export const deleteSubject = async (req, res, next) => {
  try {
    const { id } = req.params;

    const subject = await prisma.subject.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            asignaciones: true,
            calificaciones: true,
          },
        },
      },
    });

    if (!subject) {
      return res.status(404).json({
        error: 'Materia no encontrada.',
      });
    }

    // Verificar que no tenga movimientos (asignaciones o calificaciones)
    if (subject._count.asignaciones > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar una materia que tiene asignaciones a cursos.',
      });
    }

    if (subject._count.calificaciones > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar una materia que tiene calificaciones registradas.',
      });
    }

    await prisma.subject.delete({
      where: { id },
    });

    res.json({
      message: 'Materia eliminada exitosamente.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Descargar plantilla Excel para importación de materias
 */
export const getImportSubjectsTemplate = (req, res) => {
  try {
    // Crear un nuevo workbook
    const workbook = XLSX.utils.book_new();

    // Definir los datos para la hoja de Excel
    const data = [
      ['nombre', 'codigo', 'creditos', 'horas'],
      ['Matemáticas Avanzadas', 'MAT-301', '4', '40'],
      ['Lengua y Literatura', 'LYL-201', '3', '30'],
      ['Ciencias Naturales', 'CCN-101', '3', '35'],
    ];

    // Crear la hoja de trabajo desde el array
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Configurar el ancho de las columnas para mejor visualización
    worksheet['!cols'] = [
      { wch: 30 }, // nombre
      { wch: 15 }, // codigo
      { wch: 10 }, // creditos
      { wch: 10 }, // horas
    ];

    // Agregar la hoja al workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Materias');

    // Generar el buffer del archivo Excel
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Configurar los headers de la respuesta
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla_importacion_materias.xlsx"');
    res.status(200).send(excelBuffer);
  } catch (error) {
    console.error('Error al generar plantilla Excel:', error);
    res.status(500).json({ error: 'Error al generar la plantilla Excel' });
  }
};

/**
 * Importar materias desde archivo Excel
 */
export const importSubjects = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No se proporcionó ningún archivo',
      });
    }

    // Obtener institución del request
    const institutionId = getInstitutionFilter(req);
    if (!institutionId) {
      return res.status(400).json({
        error: 'No se pudo determinar la institución. Debe estar autenticado.',
      });
    }

    // Obtener año lectivo activo de la institución
    let anioLectivoId = null;
    const activeSchoolYear = await prisma.schoolYear.findFirst({
      where: {
        institucionId: institutionId,
        activo: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (activeSchoolYear) {
      anioLectivoId = activeSchoolYear.id;
    } else {
      // Si no hay activo, buscar el más reciente
      const latestSchoolYear = await prisma.schoolYear.findFirst({
        where: {
          institucionId: institutionId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!latestSchoolYear) {
        return res.status(400).json({
          error: 'No se encontró un año lectivo para la institución. Debe crear un año lectivo primero.',
        });
      }

      anioLectivoId = latestSchoolYear.id;
    }

    // Leer archivo Excel
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    if (jsonData.length < 2) {
      return res.status(400).json({
        error: 'El archivo debe incluir encabezados y al menos una fila de datos.',
      });
    }

    // Mapeo de encabezados
    const headerMap = {
      nombre: 'nombre',
      codigo: 'codigo',
      creditos: 'creditos',
      horas: 'horas',
    };

    // Procesar headers
    const rawHeaders = jsonData[0].map(header => String(header).trim());
    const headers = rawHeaders.map(header => headerMap[header.toLowerCase()] ?? header);

    // Validar encabezados requeridos
    const requiredHeaders = ['nombre', 'codigo'];
    const missingHeaders = requiredHeaders.filter(required => !headers.includes(required));
    if (missingHeaders.length > 0) {
      return res.status(400).json({
        error: `Faltan las columnas obligatorias: ${missingHeaders.join(', ')}`,
      });
    }

    // Procesar filas de datos
    const results = {
      procesados: 0,
      creados: 0,
      actualizados: 0,
      errores: [],
    };

    for (let rowIndex = 1; rowIndex < jsonData.length; rowIndex += 1) {
      const row = jsonData[rowIndex];
      const rowNumber = rowIndex + 1;

      // Saltar filas vacías
      if (!row || row.every(cell => !cell || String(cell).trim() === '')) {
        continue;
      }

      try {
        // Construir objeto de la fila
        const record = {};
        headers.forEach((header, columnIndex) => {
          if (!header) return;
          const value = row[columnIndex] !== undefined && row[columnIndex] !== null 
            ? String(row[columnIndex]).trim() 
            : '';
          if (value !== '') {
            record[header] = value;
          }
        });

        // Validar campos obligatorios
        if (!record.nombre || !record.codigo) {
          results.errores.push({
            fila: rowNumber,
            error: 'Faltan campos obligatorios (nombre y/o codigo)',
          });
          continue;
        }

        // Procesar campos opcionales
        const nombre = record.nombre.trim();
        const codigo = record.codigo.trim();
        let creditos = null;
        let horas = null;

        if (record.creditos) {
          const creditosValue = parseInt(record.creditos);
          if (isNaN(creditosValue) || creditosValue < 0) {
            results.errores.push({
              fila: rowNumber,
              error: 'El valor de créditos debe ser un número entero positivo',
            });
            continue;
          }
          creditos = creditosValue;
        }

        if (record.horas) {
          const horasValue = parseInt(record.horas);
          if (isNaN(horasValue) || horasValue < 0) {
            results.errores.push({
              fila: rowNumber,
              error: 'El valor de horas debe ser un número entero positivo',
            });
            continue;
          }
          horas = horasValue;
        }

        // Verificar si ya existe una materia con el mismo código
        const existingSubject = await prisma.subject.findFirst({
          where: {
            codigo: codigo,
            institucionId: institutionId,
            anioLectivoId: anioLectivoId,
          },
        });

        if (existingSubject) {
          // Actualizar materia existente
          await prisma.subject.update({
            where: { id: existingSubject.id },
            data: {
              nombre: nombre,
              creditos: creditos,
              horas: horas,
            },
          });
          results.actualizados += 1;
        } else {
          // Crear nueva materia
          await prisma.subject.create({
            data: {
              nombre: nombre,
              codigo: codigo,
              creditos: creditos,
              horas: horas,
              institucionId: institutionId,
              anioLectivoId: anioLectivoId,
            },
          });
          results.creados += 1;
        }

        results.procesados += 1;
      } catch (error) {
        console.error(`Error al procesar fila ${rowNumber}:`, error);
        results.errores.push({
          fila: rowNumber,
          error: error.message || 'Error desconocido al procesar esta fila',
        });
      }
    }

    res.json({
      message: 'Importación procesada correctamente.',
      resumen: {
        procesados: results.procesados,
        creados: results.creados,
        actualizados: results.actualizados,
        errores: results.errores.length,
      },
      errores: results.errores,
    });
  } catch (error) {
    console.error('Error en importación de materias:', error);
    next(error);
  }
};

