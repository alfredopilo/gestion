import prisma from '../config/database.js';
import { createStudentSchema } from '../utils/validators.js';
import { getStudentInstitutionFilter, verifyStudentBelongsToInstitution } from '../utils/institutionFilter.js';

/**
 * Obtener todos los estudiantes
 * Incluye usuarios con rol ESTUDIANTE que aún no tienen registro Student
 */
export const getStudents = async (req, res, next) => {
  try {
    const { grupoId, estado, includeRetired, page = 1, limit = 1000 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    
    // Obtener filtro de institución una sola vez
    const institutionFilter = await getStudentInstitutionFilter(req, prisma);
    
    // SIEMPRE aplicar el filtro de institución primero (incluso si hay grupoId)
    if (Object.keys(institutionFilter).length > 0) {
      // Si el filtro tiene un array vacío, no devolver nada
      if (institutionFilter.userId?.in && institutionFilter.userId.in.length === 0) {
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
    } else if (req.user?.rol !== 'ADMIN') {
      // Si no hay filtro y no es ADMIN, no mostrar nada
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
    
    // Si se especifica grupoId, filtrar por grupo (además del filtro de institución)
    if (grupoId) {
      where.grupoId = grupoId;
    }

    // Filtrar estudiantes retirados por defecto (solo mostrar activos)
    // A menos que se especifique includeRetired=true
    if (includeRetired !== 'true') {
      where.retirado = false;
    }

    // Filtrar por estado del usuario si se proporciona
    if (estado) {
      if (where.user) {
        where.user.estado = estado;
      } else {
        where.user = {
          estado: estado,
        };
      }
    }
    

    // Obtener estudiantes con registro Student
    const [students, studentsTotal] = await Promise.all([
      prisma.student.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          user: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              email: true,
              telefono: true,
              estado: true,
              numeroIdentificacion: true, // Campo mapeado a numero_identificacion
            },
          },
          grupo: {
            select: {
              id: true,
              nombre: true,
              nivel: true,
              paralelo: true,
            },
          },
          representante: {
            include: {
              user: {
                select: {
                  nombre: true,
                  apellido: true,
                  email: true,
                  telefono: true,
                },
              },
            },
          },
        },
        orderBy: [
          { user: { apellido: 'asc' } },
          { user: { nombre: 'asc' } },
        ],
      }),
      prisma.student.count({ where }),
    ]);

    // Obtener IDs de usuarios que ya tienen registro Student
    const studentsWithUser = students.map(s => s.userId);
    
    // Obtener numeroIdentificacion para estudiantes que ya tienen registro Student
    // Prisma puede tener problemas con campos mapeados en select dentro de include
    const userIds = students.map(s => s.userId);
    const usersWithNumeroId = userIds.length > 0 ? await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        numeroIdentificacion: true,
      },
    }) : [];
    
    // Crear un mapa de userId -> numeroIdentificacion
    const numeroIdMap = new Map(usersWithNumeroId.map(u => [u.id, u.numeroIdentificacion]));
    
    // Agregar numeroIdentificacion a los estudiantes
    students.forEach(student => {
      if (student.user && numeroIdMap.has(student.userId)) {
        student.user.numeroIdentificacion = numeroIdMap.get(student.userId);
      }
    });
    
    // Obtener usuarios con rol ESTUDIANTE que no tienen registro Student
    // SIEMPRE usar el filtro de institución para usuarios sin Student
    const userIdsFromInstitution = institutionFilter.userId?.in || [];
    
    // Si no hay usuarios de la institución, no mostrar usuarios sin Student
    if (userIdsFromInstitution.length === 0 && req.user?.rol !== 'ADMIN') {
      // No hay usuarios de la institución, solo devolver estudiantes con registro
      const allStudents = [...students];
      const total = studentsTotal;
      
      res.json({
        data: allStudents,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
      return;
    }
    
    const userWhere = {
      rol: 'ESTUDIANTE',
      estado: estado || 'ACTIVO', // Usar el filtro de estado si se proporciona, sino solo activos
      id: {
        notIn: studentsWithUser.length > 0 ? studentsWithUser : [],
      },
    };
    
    // SIEMPRE aplicar el filtro de institución para usuarios sin Student
    if (userIdsFromInstitution.length > 0) {
      userWhere.id = {
        notIn: studentsWithUser.length > 0 ? studentsWithUser : [],
        in: userIdsFromInstitution,
      };
    } else if (req.user?.rol !== 'ADMIN') {
      // Si no hay usuarios de la institución y no es ADMIN, no mostrar usuarios sin Student
      userWhere.id = { in: [] };
    }
    
    // Si se está filtrando por curso, NO incluir usuarios sin Student (solo estudiantes con registro)
    // porque los usuarios sin Student no tienen curso asignado
    const shouldIncludeUsersWithoutStudent = !grupoId;
    
    // Solo obtener usuarios sin Student si NO se está filtrando por curso
    // porque los usuarios sin Student no tienen curso asignado
    let usersWithoutStudent = [];
    if (!grupoId) {
      usersWithoutStudent = await prisma.user.findMany({
        where: userWhere,
        select: {
          id: true,
          nombre: true,
          apellido: true,
          email: true,
          telefono: true,
          estado: true,
          numeroIdentificacion: true,
        },
        orderBy: [
          { apellido: 'asc' },
          { nombre: 'asc' },
        ],
      });
    }

    // Convertir usuarios sin Student a formato compatible con Student
    const studentsFromUsers = usersWithoutStudent.map(user => ({
      id: `temp-${user.id}`, // ID temporal para identificar
      userId: user.id,
      user: {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        telefono: user.telefono,
        estado: user.estado,
        numeroIdentificacion: user.numeroIdentificacion,
      },
      grupo: null,
      grupoId: null,
      matricula: null,
      fechaNacimiento: null,
      lugarNacimiento: null,
      nacionalidad: null,
      genero: null,
      representante: null,
      representanteId: null,
      _isPending: true, // Flag para identificar que necesita registro Student
      createdAt: user.createdAt || new Date(),
    }));

    // Combinar estudiantes reales con usuarios pendientes
    const allStudents = [...students, ...studentsFromUsers];
    const total = studentsTotal + usersWithoutStudent.length;

    res.json({
      data: allStudents,
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
 * Obtener un estudiante por ID
 */
export const getStudentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            telefono: true,
            direccion: true,
            estado: true,
            numeroIdentificacion: true,
          },
        },
        grupo: {
          select: {
            id: true,
            nombre: true,
            nivel: true,
            paralelo: true,
            anioLectivo: {
              select: {
                institucionId: true,
              },
            },
            periodo: {
              select: {
                id: true,
                nombre: true,
                fechaInicio: true,
                fechaFin: true,
                activo: true,
              },
            },
            docente: {
              select: {
                id: true,
                user: {
                  select: {
                    id: true,
                    nombre: true,
                    apellido: true,
                    email: true,
                  },
                },
              },
            },
            course_subject_assignments: {
              select: {
                id: true,
                materia: {
                  select: {
                    id: true,
                    nombre: true,
                    codigo: true,
                  },
                },
                docente: {
                  select: {
                    id: true,
                    user: {
                      select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        representante: {
          include: {
            user: {
              select: {
                nombre: true,
                apellido: true,
                email: true,
                telefono: true,
              },
            },
          },
        },
        calificaciones: {
          include: {
            materia: true,
          },
          orderBy: { fechaRegistro: 'desc' },
        },
        asistencias: {
          orderBy: { fecha: 'desc' },
          take: 30,
        },
        pagos: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!student) {
      return res.status(404).json({
        error: 'Estudiante no encontrado.',
      });
    }

    // Verificar que el estudiante pertenece a la institución
    const hasAccess = await verifyStudentBelongsToInstitution(req, prisma, id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'No tienes acceso a este estudiante.',
      });
    }

    res.json(student);
  } catch (error) {
    next(error);
  }
};

/**
 * Crear un nuevo estudiante
 */
export const createStudent = async (req, res, next) => {
  try {
    const validatedData = createStudentSchema.parse(req.body);

    // Convertir fecha de string a Date si es necesario
    if (typeof validatedData.fechaNacimiento === 'string') {
      validatedData.fechaNacimiento = new Date(validatedData.fechaNacimiento);
    }

    const student = await prisma.student.create({
      data: validatedData,
      include: {
        user: {
          select: {
            nombre: true,
            apellido: true,
            email: true,
          },
        },
        grupo: true,
      },
    });

    res.status(201).json({
      message: 'Estudiante creado exitosamente.',
      student,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Actualizar un estudiante
 */
export const updateStudent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Convertir fecha si es necesario
    if (updateData.fechaNacimiento && typeof updateData.fechaNacimiento === 'string') {
      updateData.fechaNacimiento = new Date(updateData.fechaNacimiento);
    }

    const student = await prisma.student.findUnique({
      where: { id },
    });

    if (!student) {
      return res.status(404).json({
        error: 'Estudiante no encontrado.',
      });
    }

    const updatedStudent = await prisma.student.update({
      where: { id },
      data: updateData,
      include: {
        user: true,
        grupo: true,
      },
    });

    res.json({
      message: 'Estudiante actualizado exitosamente.',
      student: updatedStudent,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Eliminar un estudiante
 */
export const deleteStudent = async (req, res, next) => {
  try {
    const { id } = req.params;

    const student = await prisma.student.findUnique({
      where: { id },
      select: {
        grupoId: true,
      },
    });

    if (!student) {
      return res.status(404).json({
        error: 'Estudiante no encontrado.',
      });
    }

    if (student.grupoId) {
      return res.status(400).json({
        error: 'No puedes eliminar un estudiante que está asignado a un curso. Remuévelo del curso primero.',
      });
    }

    await prisma.student.delete({
      where: { id },
    });

    res.json({
      message: 'Estudiante eliminado exitosamente.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Subir foto de carnet del estudiante
 */
export const uploadFotoCarnet = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verificar que el estudiante existe
    const student = await prisma.student.findUnique({
      where: { id },
    });

    if (!student) {
      return res.status(404).json({
        error: 'Estudiante no encontrado.',
      });
    }

    // Verificar que se subió un archivo
    if (!req.file) {
      return res.status(400).json({
        error: 'No se proporcionó ninguna imagen.',
      });
    }

    // Actualizar la ruta de la foto en la base de datos
    const updatedStudent = await prisma.student.update({
      where: { id },
      data: {
        fotoCarnet: req.file.filename,
      },
      include: {
        user: {
          select: {
            nombre: true,
            apellido: true,
            email: true,
          },
        },
      },
    });

    res.json({
      message: 'Foto de carnet subida exitosamente.',
      filename: req.file.filename,
      student: updatedStudent,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener la foto de carnet del estudiante
 */
export const getFotoCarnet = async (req, res, next) => {
  try {
    const { filename } = req.params;
    const path = await import('path');
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const imagePath = path.join(__dirname, '../../uploads/student-profiles', filename);

    if (!fs.existsSync(imagePath)) {
      return res.status(404).send('Imagen no encontrada');
    }

    // Determinar el tipo de contenido basado en la extensión
    const ext = path.extname(filename).toLowerCase();
    const contentTypeMap = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    
    const contentType = contentTypeMap[ext] || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.sendFile(imagePath);
  } catch (error) {
    next(error);
  }
};

/**
 * Descargar plantilla Excel para actualización masiva de estudiantes
 */
export const getBulkUpdateTemplate = async (req, res, next) => {
  try {
    const XLSX = await import('xlsx');
    const { getInstitutionFilter } = await import('../utils/institutionFilter.js');
    
    const institutionId = getInstitutionFilter(req);
    if (!institutionId) {
      return res.status(400).json({
        error: 'No se pudo determinar la institución.',
      });
    }

    // Obtener campos personalizados de la institución
    const profileFields = await prisma.studentProfileField.findMany({
      where: {
        section: {
          institucionId: institutionId,
          activo: true,
        },
      },
      include: {
        section: {
          select: {
            nombre: true,
            orden: true,
          },
        },
      },
      orderBy: [
        { section: { orden: 'asc' } },
        { orden: 'asc' },
      ],
    });

    // Columnas fijas
    const fixedColumns = [
      'numeroIdentificacion',
      'nombre',
      'apellido',
      'email',
      'telefono',
      'direccion',
      'fechaNacimiento',
      'nacionalidad',
      'genero',
      'lugarNacimiento',
    ];

    // Columnas dinámicas (campos personalizados)
    const dynamicColumns = profileFields.map(field => field.etiqueta);

    // Todas las columnas
    const allColumns = [...fixedColumns, ...dynamicColumns];

    // Filas de ejemplo
    const exampleRows = [
      [
        '0102030405',
        'Juan',
        'Pérez',
        'juan.perez@correo.com',
        '0987654321',
        'Av. Principal 123',
        '2010-05-12',
        'Ecuatoriana',
        'Masculino',
        'Quito',
        ...profileFields.map(field => {
          // Ejemplos según tipo
          switch (field.tipo) {
            case 'NUMBER': return '5';
            case 'DATE': return '2024-01-15';
            case 'BOOLEAN': return 'Sí';
            case 'SELECT': 
            case 'MULTISELECT':
              try {
                const options = field.config?.options || [];
                return options[0]?.label || '';
              } catch (e) {
                return '';
              }
            default: return 'Ejemplo';
          }
        }),
      ],
      [
        '0605040302',
        'Ana',
        'Gómez',
        'ana.gomez@correo.com',
        '',
        '',
        '2009-11-28',
        'Ecuatoriana',
        'Femenino',
        'Guayaquil',
        ...profileFields.map(() => ''),
      ],
    ];

    const data = [allColumns, ...exampleRows];
    const worksheet = XLSX.default.utils.aoa_to_sheet(data);

    // Configurar anchos de columna
    const colWidths = [
      { wch: 20 }, // numeroIdentificacion
      { wch: 15 }, // nombre
      { wch: 15 }, // apellido
      { wch: 30 }, // email
      { wch: 15 }, // telefono
      { wch: 30 }, // direccion
      { wch: 15 }, // fechaNacimiento
      { wch: 15 }, // nacionalidad
      { wch: 12 }, // genero
      { wch: 20 }, // lugarNacimiento
      ...profileFields.map(() => ({ wch: 20 })),
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.default.utils.book_new();
    XLSX.default.utils.book_append_sheet(workbook, worksheet, 'Estudiantes');

    const excelBuffer = XLSX.default.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla_actualizacion_estudiantes.xlsx"');
    res.status(200).send(excelBuffer);
  } catch (error) {
    console.error('Error al generar plantilla de actualización masiva:', error);
    next(error);
  }
};

/**
 * Actualización masiva de estudiantes desde Excel
 */
export const bulkUpdateStudents = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No se proporcionó ningún archivo',
      });
    }

    const XLSX = await import('xlsx');
    const { getInstitutionFilter } = await import('../utils/institutionFilter.js');
    
    const institutionId = getInstitutionFilter(req);
    if (!institutionId) {
      return res.status(400).json({
        error: 'No se pudo determinar la institución.',
      });
    }

    // Obtener campos personalizados de la institución
    const profileFields = await prisma.studentProfileField.findMany({
      where: {
        section: {
          institucionId: institutionId,
          activo: true,
        },
      },
      include: {
        section: true,
      },
      orderBy: [
        { section: { orden: 'asc' } },
        { orden: 'asc' },
      ],
    });

    // Crear mapa de etiqueta -> field para búsqueda rápida
    const fieldsByLabel = new Map();
    profileFields.forEach(field => {
      fieldsByLabel.set(field.etiqueta.toLowerCase().trim(), field);
    });

    // Leer archivo Excel
    const workbook = XLSX.default.read(req.file.buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.default.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    if (jsonData.length < 2) {
      return res.status(400).json({
        error: 'El archivo debe incluir encabezados y al menos una fila de datos.',
      });
    }

    // Mapeo de headers
    const headerMap = {
      'numeroidentificacion': 'numeroIdentificacion',
      'numero identificacion': 'numeroIdentificacion',
      'numero_identificacion': 'numeroIdentificacion',
      'fechanacimiento': 'fechaNacimiento',
      'fecha nacimiento': 'fechaNacimiento',
      'fecha_nacimiento': 'fechaNacimiento',
      'lugarnacimiento': 'lugarNacimiento',
      'lugar nacimiento': 'lugarNacimiento',
      'lugar_nacimiento': 'lugarNacimiento',
    };

    // Procesar headers
    const rawHeaders = jsonData[0].map(header => String(header).trim());
    const headers = rawHeaders.map(header => {
      const normalized = header.toLowerCase().trim();
      return headerMap[normalized] || header;
    });

    // Validar header obligatorio
    if (!headers.includes('numeroIdentificacion')) {
      return res.status(400).json({
        error: 'Falta la columna obligatoria: numeroIdentificacion',
      });
    }

    const results = {
      procesados: 0,
      actualizados: 0,
      omitidos: 0,
      errores: [],
    };

    // Procesar cada fila
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
          record[header] = value;
        });

        const numeroIdentificacion = record.numeroIdentificacion?.trim();
        if (!numeroIdentificacion) {
          results.errores.push({
            fila: rowNumber,
            numeroIdentificacion: '-',
            error: 'Falta el número de identificación',
          });
          continue;
        }

        // Buscar estudiante por numeroIdentificacion en la institución
        const user = await prisma.user.findFirst({
          where: {
            numeroIdentificacion,
            institucionId: institutionId,
            rol: 'ESTUDIANTE',
          },
          include: {
            student: true,
          },
        });

        if (!user) {
          results.errores.push({
            fila: rowNumber,
            numeroIdentificacion,
            error: 'Estudiante no encontrado en esta institución',
          });
          continue;
        }

        if (!user.student) {
          results.errores.push({
            fila: rowNumber,
            numeroIdentificacion,
            error: 'Usuario encontrado pero sin registro de estudiante',
          });
          continue;
        }

        // Preparar actualización de User (solo campos no vacíos)
        const userUpdate = {};
        if (record.nombre && record.nombre.trim()) userUpdate.nombre = record.nombre.trim();
        if (record.apellido && record.apellido.trim()) userUpdate.apellido = record.apellido.trim();
        if (record.email && record.email.trim()) userUpdate.email = record.email.trim();
        if (record.telefono !== undefined && record.telefono !== null) {
          userUpdate.telefono = record.telefono.trim() || null;
        }
        if (record.direccion !== undefined && record.direccion !== null) {
          userUpdate.direccion = record.direccion.trim() || null;
        }

        // Preparar actualización de Student (solo campos no vacíos)
        const studentUpdate = {};
        
        if (record.fechaNacimiento && record.fechaNacimiento.trim()) {
          const fecha = new Date(record.fechaNacimiento.trim());
          if (isNaN(fecha.getTime())) {
            results.errores.push({
              fila: rowNumber,
              numeroIdentificacion,
              error: 'Fecha de nacimiento inválida',
            });
            continue;
          }
          studentUpdate.fechaNacimiento = fecha;
        }
        
        if (record.nacionalidad && record.nacionalidad.trim()) {
          studentUpdate.nacionalidad = record.nacionalidad.trim();
        }
        
        if (record.genero && record.genero.trim()) {
          studentUpdate.genero = record.genero.trim();
        }
        
        if (record.lugarNacimiento !== undefined && record.lugarNacimiento !== null) {
          studentUpdate.lugarNacimiento = record.lugarNacimiento.trim() || null;
        }

        // Preparar actualización de campos personalizados
        const profileValueUpdates = [];
        
        for (const [label, field] of fieldsByLabel.entries()) {
          // Buscar el valor en el record (case-insensitive)
          const recordKey = Object.keys(record).find(
            key => key.toLowerCase().trim() === label
          );
          
          if (!recordKey) continue; // Columna no presente en Excel
          
          const rawValue = record[recordKey];
          
          // Si está vacío y no es requerido, skip (no actualizar)
          if (!rawValue || rawValue.trim() === '') {
            if (field.requerido) {
              results.errores.push({
                fila: rowNumber,
                numeroIdentificacion,
                error: `El campo "${field.etiqueta}" es requerido`,
              });
              throw new Error('Campo requerido vacío');
            }
            continue; // No actualizar este campo
          }

          // Normalizar valor según tipo
          let normalizedValue = null;
          
          try {
            switch (field.tipo) {
              case 'NUMBER': {
                const num = Number(rawValue);
                if (isNaN(num)) {
                  throw new Error(`"${field.etiqueta}" debe ser un número válido`);
                }
                normalizedValue = num.toString();
                break;
              }
              
              case 'DATE': {
                const date = new Date(rawValue);
                if (isNaN(date.getTime())) {
                  throw new Error(`"${field.etiqueta}" debe ser una fecha válida`);
                }
                normalizedValue = date.toISOString();
                break;
              }
              
              case 'BOOLEAN': {
                const lower = rawValue.toLowerCase().trim();
                const trueValues = ['sí', 'si', 'yes', 'true', '1', 'verdadero'];
                normalizedValue = trueValues.includes(lower) ? 'true' : 'false';
                break;
              }
              
              case 'SELECT': {
                const options = field.config?.options || [];
                const validLabels = options.map(opt => opt.label.toLowerCase());
                const validValues = options.map(opt => opt.value.toLowerCase());
                const inputLower = rawValue.toLowerCase().trim();
                
                if (!validLabels.includes(inputLower) && !validValues.includes(inputLower)) {
                  throw new Error(`"${field.etiqueta}" debe ser una de las opciones válidas`);
                }
                normalizedValue = rawValue.trim();
                break;
              }
              
              case 'MULTISELECT': {
                const values = rawValue.split(',').map(v => v.trim()).filter(Boolean);
                if (values.length === 0 && field.requerido) {
                  throw new Error(`"${field.etiqueta}" requiere al menos una opción`);
                }
                normalizedValue = JSON.stringify(values);
                break;
              }
              
              default:
                normalizedValue = rawValue.trim();
            }

            profileValueUpdates.push({
              fieldId: field.id,
              value: normalizedValue,
            });
          } catch (validationError) {
            results.errores.push({
              fila: rowNumber,
              numeroIdentificacion,
              error: validationError.message,
            });
            throw validationError;
          }
        }

        // Ejecutar actualizaciones en transacción
        await prisma.$transaction(async (tx) => {
          // Actualizar User si hay cambios
          if (Object.keys(userUpdate).length > 0) {
            await tx.user.update({
              where: { id: user.id },
              data: userUpdate,
            });
          }

          // Actualizar Student si hay cambios
          if (Object.keys(studentUpdate).length > 0) {
            await tx.student.update({
              where: { id: user.student.id },
              data: studentUpdate,
            });
          }

          // Actualizar campos personalizados
          for (const { fieldId, value } of profileValueUpdates) {
            if (value === null) {
              await tx.studentProfileValue.deleteMany({
                where: {
                  studentId: user.student.id,
                  fieldId,
                },
              });
            } else {
              await tx.studentProfileValue.upsert({
                where: {
                  studentId_fieldId: {
                    studentId: user.student.id,
                    fieldId,
                  },
                },
                update: { valor: value },
                create: {
                  studentId: user.student.id,
                  fieldId,
                  valor: value,
                },
              });
            }
          }
        });

        results.actualizados += 1;
        results.procesados += 1;
      } catch (error) {
        results.procesados += 1;
        // Si ya se agregó el error específico, no duplicar
        if (!results.errores.some(e => e.fila === rowNumber)) {
          results.errores.push({
            fila: rowNumber,
            numeroIdentificacion: record.numeroIdentificacion || '-',
            error: error.message || 'Error desconocido al procesar esta fila',
          });
        }
      }
    }

    res.json({
      message: 'Actualización masiva procesada correctamente.',
      resumen: {
        procesados: results.procesados,
        actualizados: results.actualizados,
        omitidos: results.omitidos,
        errores: results.errores.length,
      },
      errores: results.errores,
    });
  } catch (error) {
    console.error('Error en actualización masiva:', error);
    next(error);
  }
};

