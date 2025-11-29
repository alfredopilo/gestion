import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../config/database.js';
import { createCourseSchema, updateCourseSchema, importStudentsSchema } from '../utils/validators.js';
import { getCourseInstitutionFilter, verifyCourseBelongsToInstitution, verifyPeriodBelongsToInstitution, getActiveSchoolYear, getInstitutionFilter, getStudentInstitutionFilter } from '../utils/institutionFilter.js';

/**
 * Obtener todos los cursos
 */
export const getCourses = async (req, res, next) => {
  try {
    const { periodoId, nivel, docenteId, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    
    // SIEMPRE aplicar el filtro de institución primero
    // Este filtro ya considera el año escolar activo global
    const institutionFilter = await getCourseInstitutionFilter(req, prisma);
    if (Object.keys(institutionFilter).length > 0) {
      if (institutionFilter.anioLectivoId?.in && institutionFilter.anioLectivoId.in.length === 0) {
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
    
    // Si se especifica periodoId, filtrar por período (además del filtro de institución)
    if (periodoId) {
      // Verificar que el período pertenece al año activo global
      const periodo = await prisma.period.findUnique({
        where: { id: periodoId },
        include: {
          anioLectivo: {
            select: {
              id: true,
              institucionId: true,
            },
          },
        },
      });
      
      if (periodo) {
        const activeSchoolYear = await getActiveSchoolYear(req, prisma);
        
        // Verificar que el período pertenece al año escolar activo GLOBAL
        if (activeSchoolYear && periodo.anioLectivo?.id !== activeSchoolYear.id && req.user?.rol !== 'ADMIN') {
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
        
        where.periodoId = periodoId;
      } else {
        // Si el período no existe, no mostrar cursos
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
    }
    if (nivel) where.nivel = nivel;
    if (docenteId) where.docenteId = docenteId;

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          anioLectivo: {
            select: {
              id: true,
              nombre: true,
              activo: true,
            },
          },
          periodo: true, // Mantener para compatibilidad
          docente: {
            include: {
              user: {
                select: {
                  nombre: true,
                  apellido: true,
                  email: true,
                },
              },
            },
          },
          cursoSiguiente: {
            select: {
              id: true,
              nombre: true,
              nivel: true,
              paralelo: true,
            },
          },
          _count: {
            select: {
              estudiantes: true,
          course_subject_assignments: true,
            },
          },
        },
        orderBy: [
          { sortOrder: 'asc' },
          { nombre: 'asc' },
        ],
      }),
      prisma.course.count({ where }),
    ]);

    res.json({
      data: courses,
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
 * Obtener un curso por ID
 */
export const getCourseById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        anioLectivo: {
          select: {
            id: true,
            nombre: true,
            activo: true,
          },
        },
        periodo: true,
        docente: {
          include: { user: true },
        },
        estudiantes: {
          include: {
            user: {
              select: {
                nombre: true,
                apellido: true,
                email: true,
                numeroIdentificacion: true,
              },
            },
          },
          orderBy: {
            user: {
              apellido: 'asc',
            },
          },
        },
        course_subject_assignments: {
          include: {
            materia: true,
            docente: {
              include: { user: true },
            },
            horarios: true,
          },
        },
        cursoSiguiente: {
          select: {
            id: true,
            nombre: true,
            nivel: true,
            paralelo: true,
          },
        },
      },
    });

    if (!course) {
      return res.status(404).json({
        error: 'Curso no encontrado.',
      });
    }

    // Verificar que el curso pertenece a la institución
    const hasAccess = await verifyCourseBelongsToInstitution(req, prisma, id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'No tienes acceso a este curso.',
      });
    }

    const courseResponse = {
      ...course,
      asignacionesMaterias: course.course_subject_assignments,
    };
    delete courseResponse.course_subject_assignments;

    res.json(courseResponse);
  } catch (error) {
    next(error);
  }
};

/**
 * Crear un nuevo curso
 */
export const createCourse = async (req, res, next) => {
  try {
    const validatedData = createCourseSchema.parse(req.body);

    // Obtener la institución del usuario (debe ser la seleccionada en el header)
    const institutionId = getInstitutionFilter(req);
    
    // También verificar el header directamente como respaldo
    const headerInstitutionId = req.headers['x-institution-id'];
    
    console.log('🔍 [createCourse] Institución del filtro:', institutionId);
    console.log('🔍 [createCourse] Institución del header:', headerInstitutionId);
    console.log('🔍 [createCourse] req.institutionId:', req.institutionId);
    console.log('🔍 [createCourse] req.user.institucionId:', req.user?.institucionId);
    
    // Usar la institución del header si está disponible y el filtro no la tiene
    const finalInstitutionId = institutionId || headerInstitutionId;
    
    if (!finalInstitutionId && req.user?.rol !== 'ADMIN') {
      return res.status(400).json({
        error: 'No se pudo determinar la institución. Debe estar autenticado y tener una institución seleccionada.',
      });
    }
    
    console.log('✅ [createCourse] Institución final a usar:', finalInstitutionId);

    // Obtener el año escolar activo de la institución seleccionada
    let anioLectivoId = validatedData.anioLectivoId;
    if (!anioLectivoId) {
      // Cada institución tiene su propio año escolar activo
      const activeSchoolYear = await getActiveSchoolYear(req, prisma);
      if (!activeSchoolYear) {
        return res.status(400).json({
          error: 'No hay un año escolar activo configurado para esta institución. Por favor, crea y activa un año escolar para tu institución primero.',
        });
      }
      
      // Verificar que el año activo pertenece a la institución seleccionada
      if (finalInstitutionId && activeSchoolYear.institucionId !== finalInstitutionId) {
        return res.status(400).json({
          error: `El año escolar activo (${activeSchoolYear.nombre}) pertenece a otra institución. Por favor, crea y activa un año escolar para tu institución actual.`,
        });
      }
      
      anioLectivoId = activeSchoolYear.id;
      console.log('✅ [createCourse] Usando año escolar activo de la institución:', activeSchoolYear.id, activeSchoolYear.nombre);
    }
    
    console.log('✅ [createCourse] Año escolar final a usar:', anioLectivoId);

    // Verificar que el año escolar existe y pertenece a la institución del usuario
    const schoolYear = await prisma.schoolYear.findUnique({
      where: { id: anioLectivoId },
      include: {
        institucion: {
          select: { id: true, nombre: true },
        },
      },
    });

    if (!schoolYear) {
      return res.status(404).json({
        error: 'Año escolar no encontrado.',
      });
    }

    console.log('✅ [createCourse] Año escolar encontrado:', schoolYear.id, schoolYear.nombre);
    console.log('✅ [createCourse] El año escolar es GLOBAL - todas las instituciones lo comparten');


    const sortOrder = validatedData.sortOrder ?? 0;

    const courseData = {
      id: randomUUID(),
      nombre: validatedData.nombre,
      nivel: validatedData.nivel,
      paralelo: validatedData.paralelo ?? null,
      docenteId: validatedData.docenteId ?? null,
      capacidad: validatedData.capacidad ?? null,
      cursoSiguienteId: validatedData.cursoSiguienteId ?? null,
      sortOrder,
      anioLectivoId,
      periodoId: validatedData.periodoId ?? null, // Opcional
      updatedAt: new Date(),
    };
    
    console.log('✅ [createCourse] Datos del curso a crear:', {
      nombre: courseData.nombre,
      anioLectivoId: courseData.anioLectivoId,
      institucionDelAnio: schoolYear.institucion.id,
    });

    const course = await prisma.course.create({
      data: courseData,
      include: {
        anioLectivo: {
          select: {
            id: true,
            nombre: true,
            activo: true,
          },
        },
        periodo: true,
        docente: {
          include: { user: true },
        },
      },
    });

    res.status(201).json({
      message: 'Curso creado exitosamente.',
      course,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Actualizar un curso
 */
export const updateCourse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const validatedData = updateCourseSchema.parse(req.body);

    const course = await prisma.course.findUnique({
      where: { id },
    });

    if (!course) {
      return res.status(404).json({
        error: 'Curso no encontrado.',
      });
    }

    // Verificar que el curso pertenece a la institución
    const hasAccess = await verifyCourseBelongsToInstitution(req, prisma, id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'No tienes acceso a este curso.',
      });
    }

    // Si se actualiza el año escolar, verificar que pertenece a la institución
    if (validatedData.anioLectivoId && validatedData.anioLectivoId !== course.anioLectivoId) {
      const schoolYear = await prisma.schoolYear.findUnique({
        where: { id: validatedData.anioLectivoId },
        select: { institucionId: true },
      });
      const institutionId = getInstitutionFilter(req);
      if (schoolYear && institutionId && schoolYear.institucionId !== institutionId && req.user?.rol !== 'ADMIN') {
        return res.status(403).json({
          error: 'No tienes permiso para mover este curso a ese año escolar.',
        });
      }
    }

    const updateData = { ...validatedData };
    if (updateData.sortOrder !== undefined) {
      updateData.sortOrder = updateData.sortOrder ?? 0;
    }

    const updatedCourse = await prisma.course.update({
      where: { id },
      data: updateData,
      include: {
        anioLectivo: {
          select: {
            id: true,
            nombre: true,
            activo: true,
          },
        },
        periodo: true,
        docente: {
          include: { user: true },
        },
        _count: {
          select: {
            estudiantes: true,
          course_subject_assignments: true,
          },
        },
      },
    });

    res.json({
      message: 'Curso actualizado exitosamente.',
      course: updatedCourse,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Importar estudiantes desde un archivo/lista al curso
 */
export const importStudents = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { students } = importStudentsSchema.parse(req.body);

    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        anioLectivo: {
          select: { institucionId: true },
        },
      },
    });

    if (!course) {
      return res.status(404).json({
        error: 'Curso no encontrado.',
      });
    }

    const hasAccess = await verifyCourseBelongsToInstitution(req, prisma, id);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'No tienes permiso para importar estudiantes en este curso.',
      });
    }

    const institutionId = course.anioLectivo?.institucionId;
    if (!institutionId) {
      return res.status(400).json({
        error: 'El curso no tiene una institución asociada.',
      });
    }

    const results = {
      processed: students.length,
      nuevosUsuarios: [],
      asignados: 0,
      omitidos: [],
      errores: [],
    };

    for (let index = 0; index < students.length; index += 1) {
      const rawStudent = students[index];
      const rowNumber = index + 2; // Asumiendo encabezados en la primera fila

      try {
        const nombre = rawStudent.nombre.trim();
        const apellido = rawStudent.apellido.trim();
        const numeroIdentificacion = rawStudent.numeroIdentificacion.trim();
        const email = rawStudent.email?.trim().toLowerCase() || null;
        const telefono = rawStudent.telefono?.trim() || null;
        const direccion = rawStudent.direccion?.trim() || null;
        const genero = rawStudent.genero?.trim() || null;
        const fechaNacimientoInput = rawStudent.fechaNacimiento?.trim() || null;
        const passwordPlano =
          rawStudent.password?.trim() || numeroIdentificacion || '12345678';

        let fechaNacimiento = new Date('2005-01-01');
        if (fechaNacimientoInput) {
          const parsedDate = new Date(fechaNacimientoInput);
          if (!Number.isNaN(parsedDate.getTime())) {
            fechaNacimiento = parsedDate;
          }
        }

        const searchConditions = [];
        if (email) {
          searchConditions.push({ email });
        }
        if (numeroIdentificacion) {
          searchConditions.push({ numeroIdentificacion });
        }

        let user = null;
        if (searchConditions.length > 0) {
          user = await prisma.user.findFirst({
            where: {
              institucionId: institutionId,
              OR: searchConditions,
            },
          });
        }

        let createdPassword = null;
        let wasCreated = false;

        if (!user) {
          const finalEmail =
            email || `${numeroIdentificacion}@temporal-${institutionId}.local`.toLowerCase();

          const passwordHash = await bcrypt.hash(passwordPlano, 10);
          user = await prisma.user.create({
            data: {
              nombre,
              apellido,
              email: finalEmail,
              numeroIdentificacion,
              telefono,
              direccion,
              rol: 'ESTUDIANTE',
              estado: 'ACTIVO',
              institucionId: institutionId,
              passwordHash,
            },
          });
          wasCreated = true;
          createdPassword = passwordPlano;

          results.nuevosUsuarios.push({
            nombreCompleto: `${nombre} ${apellido}`,
            email: finalEmail,
            numeroIdentificacion,
            passwordTemporal: passwordPlano,
          });
        } else if (user.rol !== 'ESTUDIANTE') {
          results.omitidos.push({
            fila: rowNumber,
            nombreCompleto: `${nombre} ${apellido}`,
            motivo: 'Ya existe un usuario con este email o identificación y no es estudiante.',
          });
          continue;
        } else {
          // Actualizar información básica si el usuario ya existía
          const updateData = {
            nombre,
            apellido,
          };
          if (telefono) updateData.telefono = telefono;
          if (direccion) updateData.direccion = direccion;

          try {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                ...updateData,
                ...(email && email !== user.email ? { email } : {}),
              },
            });
          } catch (updateError) {
            // Si el email nuevo causa conflicto de unicidad, mantener el existente
            await prisma.user.update({
              where: { id: user.id },
              data: updateData,
            });
          }
        }

        // Asegurar la relación user_institutions
        await prisma.userInstitution.upsert({
          where: {
            userId_institucionId: {
              userId: user.id,
              institucionId: institutionId,
            },
          },
          create: {
            userId: user.id,
            institucionId: institutionId,
          },
          update: {},
        });

        // Crear o actualizar el registro de estudiante
        const existingStudent = await prisma.student.findUnique({
          where: { userId: user.id },
        });

        if (!existingStudent) {
          await prisma.student.create({
            data: {
              userId: user.id,
              grupoId: course.id,
              fechaNacimiento,
              nacionalidad: 'Ecuatoriana',
              genero,
            },
          });
          results.asignados += 1;
        } else if (existingStudent.grupoId !== course.id) {
          await prisma.student.update({
            where: { id: existingStudent.id },
            data: {
              grupoId: course.id,
              genero: genero ?? existingStudent.genero,
            },
          });
          results.asignados += 1;
        } else {
          results.omitidos.push({
            fila: rowNumber,
            nombreCompleto: `${nombre} ${apellido}`,
            motivo: 'El estudiante ya pertenece a este curso.',
          });
        }
      } catch (error) {
        results.errores.push({
          fila: rowNumber,
          error: error.message || 'Error desconocido al importar este estudiante.',
        });
      }
    }

    res.json({
      message: 'Importación procesada correctamente.',
      resumen: {
        procesados: results.processed,
        nuevosUsuarios: results.nuevosUsuarios.length,
        estudiantesAsignados: results.asignados,
        omitidos: results.omitidos.length,
        errores: results.errores.length,
      },
      nuevos: results.nuevosUsuarios,
      omitidos: results.omitidos,
      errores: results.errores,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Descargar plantilla CSV para importación de estudiantes
 */
export const getImportStudentsTemplate = (req, res) => {
  const headers = [
    'nombre',
    'apellido',
    'numeroIdentificacion',
    'email',
    'telefono',
    'direccion',
    'genero',
    'fechaNacimiento',
    'password',
  ];

  const sampleRows = [
    [
      'Juan',
      'Pérez',
      '0102030405',
      'juan.perez@correo.com',
      '0987654321',
      'Av. Siempre Viva 123',
      'Masculino',
      '2008-05-12',
      'Juan2025!',
    ],
    [
      'Ana',
      'Gómez',
      '0605040302',
      'ana.gomez@correo.com',
      '',
      '',
      'Femenino',
      '2007-11-28',
      '',
    ],
  ];

  const csvContent = [
    headers.join(','),
    ...sampleRows.map(row => row.map(value => `"${value}"`).join(',')),
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla_importacion_estudiantes.csv"');
  res.status(200).send(csvContent);
};

/**
 * Eliminar un curso
 */
export const deleteCourse = async (req, res, next) => {
  try {
    const { id } = req.params;

    const course = await prisma.course.findUnique({
      where: { id },
    });

    if (!course) {
      return res.status(404).json({
        error: 'Curso no encontrado.',
      });
    }

    await prisma.course.delete({
      where: { id },
    });

    res.json({
      message: 'Curso eliminado exitosamente.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Asignar estudiante a un curso
 */
export const assignStudentToCourse = async (req, res, next) => {
  try {
    const { id: courseId } = req.params;
    const { estudianteId } = req.body;

    if (!estudianteId) {
      return res.status(400).json({
        error: 'Se debe proporcionar el ID del estudiante.',
      });
    }

    // Verificar que el curso existe
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      return res.status(404).json({
        error: 'Curso no encontrado.',
      });
    }

    // Verificar capacidad del curso
    const currentCount = await prisma.student.count({
      where: { grupoId: courseId },
    });

    if (course.capacidad && currentCount >= course.capacidad) {
      return res.status(400).json({
        error: `El curso ha alcanzado su capacidad máxima (${course.capacidad} estudiantes).`,
      });
    }

    // Verificar si el estudianteId es un ID temporal (usuario sin registro Student)
    let student;
    let userId;
    
    if (estudianteId.startsWith('temp-')) {
      // Es un usuario sin registro Student, extraer el userId
      userId = estudianteId.replace('temp-', '');
      
      // Verificar que el usuario existe y es estudiante
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || user.rol !== 'ESTUDIANTE') {
        return res.status(404).json({
          error: 'Usuario estudiante no encontrado.',
        });
      }

      // Crear el registro Student si no existe
      const existingStudent = await prisma.student.findUnique({
        where: { userId },
      });

      if (existingStudent) {
        student = existingStudent;
        // Actualizar el curso del estudiante existente
        const updatedStudent = await prisma.student.update({
          where: { id: student.id },
          data: { grupoId: courseId },
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
        return res.json({
          message: 'Estudiante asignado al curso exitosamente.',
          student: updatedStudent,
        });
      } else {
        // Crear nuevo registro Student con el curso asignado
        const newStudent = await prisma.student.create({
          data: {
            userId,
            fechaNacimiento: new Date(),
            nacionalidad: 'Ecuatoriana',
            grupoId: courseId,
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
        return res.json({
          message: 'Estudiante creado y asignado al curso exitosamente.',
          student: newStudent,
        });
      }
    } else {
      // Es un ID de Student normal
      student = await prisma.student.findUnique({
        where: { id: estudianteId },
      });

      if (!student) {
        return res.status(404).json({
          error: 'Estudiante no encontrado.',
        });
      }

      // Asignar estudiante al curso
      const updatedStudent = await prisma.student.update({
        where: { id: student.id },
        data: { grupoId: courseId },
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

      return res.json({
        message: 'Estudiante asignado al curso exitosamente.',
        student: updatedStudent,
      });
    }

  } catch (error) {
    next(error);
  }
};

/**
 * Remover estudiante de un curso
 */
export const removeStudentFromCourse = async (req, res, next) => {
  try {
    const { id: courseId, estudianteId } = req.params;

    // Verificar que el curso existe y pertenece a la institución
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        anioLectivo: {
          select: {
            id: true,
            institucionId: true,
          },
        },
      },
    });

    if (!course) {
      return res.status(404).json({
        error: 'Curso no encontrado.',
      });
    }

    // Verificar que el curso pertenece a la institución seleccionada
    const institutionId = getInstitutionFilter(req);
    if (institutionId && course.anioLectivo?.institucionId !== institutionId && req.user?.rol !== 'ADMIN') {
      return res.status(403).json({
        error: 'No tienes permiso para modificar este curso.',
      });
    }

    // Verificar que el estudiante está en el curso
    const student = await prisma.student.findUnique({
      where: { id: estudianteId },
      include: {
        user: {
          select: {
            id: true,
            institucionId: true,
          },
        },
      },
    });

    if (!student) {
      return res.status(404).json({
        error: 'Estudiante no encontrado.',
      });
    }

    // Verificar que el estudiante pertenece a la institución seleccionada
    if (institutionId && student.user?.institucionId !== institutionId && req.user?.rol !== 'ADMIN') {
      return res.status(403).json({
        error: 'No tienes permiso para modificar este estudiante.',
      });
    }

    if (student.grupoId !== courseId) {
      return res.status(400).json({
        error: 'El estudiante no está asignado a este curso.',
      });
    }

    // Remover del curso
    const updatedStudent = await prisma.student.update({
      where: { id: estudianteId },
      data: { grupoId: null },
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
      message: 'Estudiante removido del curso exitosamente.',
      student: updatedStudent,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener estudiantes disponibles (sin curso en el año escolar activo de la institución)
 * Incluye estudiantes con registro Student y usuarios con rol ESTUDIANTE sin registro Student
 * Filtrado por institución y año lectivo activo
 */
export const getAvailableStudents = async (req, res, next) => {
  try {
    const { cursoId } = req.query;
    const institutionId = getInstitutionFilter(req);

    // Obtener el año escolar activo de la institución seleccionada
    const activeSchoolYear = await getActiveSchoolYear(req, prisma);
    if (!activeSchoolYear) {
      return res.status(400).json({
        error: 'No hay un año escolar activo configurado para esta institución.',
      });
    }

    // Verificar que el año activo pertenece a la institución seleccionada
    if (institutionId && activeSchoolYear.institucionId !== institutionId && req.user?.rol !== 'ADMIN') {
      return res.status(400).json({
        error: 'El año escolar activo no pertenece a la institución seleccionada.',
      });
    }

    // Obtener todos los cursos del año escolar activo de la institución
    // El año activo ya pertenece a la institución, así que solo filtrar por anioLectivoId
    const coursesInSchoolYear = await prisma.course.findMany({
      where: { 
        anioLectivoId: activeSchoolYear.id,
      },
      select: { id: true },
    });

    const courseIds = coursesInSchoolYear.map(c => c.id);

    // Construir condición para excluir estudiantes ya asignados
    // Siempre excluir el curso actual si se proporciona, además de todos los cursos del año activo
    const courseIdsToExclude = [...courseIds];
    if (cursoId && !courseIdsToExclude.includes(cursoId)) {
      courseIdsToExclude.push(cursoId);
    }

    // Obtener filtro de institución para estudiantes
    const institutionFilter = await getStudentInstitutionFilter(req, prisma);
    
    // Si no hay filtro de institución y no es ADMIN, no mostrar estudiantes
    if (Object.keys(institutionFilter).length === 0 && req.user?.rol !== 'ADMIN') {
      return res.json({
        data: [],
      });
    }
    
    // Si el filtro tiene un array vacío, no devolver nada
    if (institutionFilter.userId?.in && institutionFilter.userId.in.length === 0) {
      return res.json({
        data: [],
      });
    }
    
    // Construir condición para filtrar estudiantes por institución y año lectivo
    const whereCondition = {
      // Aplicar filtro de institución (userId)
      ...institutionFilter,
      // Filtrar por estado del usuario
      user: {
        estado: 'ACTIVO',
      },
      AND: [
        {
          OR: [
            { grupoId: null },
            { grupoId: { notIn: courseIdsToExclude.length > 0 ? courseIdsToExclude : [] } },
          ],
        },
        // Excluir explícitamente el curso actual
        ...(cursoId ? [{ grupoId: { not: cursoId } }] : []),
      ],
    };

    // Obtener estudiantes con registro Student sin curso o con curso fuera del período actual
    const studentsWithRecord = await prisma.student.findMany({
      where: whereCondition,
      include: {
        user: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            estado: true,
          },
        },
        grupo: {
          select: {
            id: true,
            nombre: true,
            anioLectivo: {
              select: {
                id: true,
                nombre: true,
              },
            },
            periodo: {
              select: {
                id: true,
                nombre: true,
              },
            },
          },
        },
      },
      orderBy: {
        user: {
          apellido: 'asc',
        },
      },
      take: 1000,
    });

    // Obtener IDs de usuarios que ya tienen registro Student (incluyendo los que están en el curso actual)
    const userIdsWithStudent = studentsWithRecord.map(s => s.userId);
    
    // También obtener IDs de estudiantes que están en el curso actual (para excluirlos)
    let studentsInCurrentCourse = [];
    if (cursoId) {
      studentsInCurrentCourse = await prisma.student.findMany({
        where: { grupoId: cursoId },
        select: { userId: true },
      });
    }
    const userIdsInCurrentCourse = studentsInCurrentCourse.map(s => s.userId);
    const allExcludedUserIds = [...new Set([...userIdsWithStudent, ...userIdsInCurrentCourse])];

    // Obtener usuarios con rol ESTUDIANTE activos que NO tienen registro Student
    // Y que no están en el curso actual
    // Filtrar por institución
    const userWhereCondition = {
      rol: 'ESTUDIANTE',
      estado: 'ACTIVO',
      id: {
        notIn: allExcludedUserIds.length > 0 ? allExcludedUserIds : [],
      },
    };

    // Aplicar filtro de institución
    if (institutionId) {
      userWhereCondition.institucionId = institutionId;
    } else if (req.user?.rol !== 'ADMIN') {
      // Si no hay institución y no es ADMIN, no mostrar usuarios
      return res.json({
        data: [],
      });
    }

    const usersWithoutStudent = await prisma.user.findMany({
      where: userWhereCondition,
      select: {
        id: true,
        nombre: true,
        apellido: true,
        email: true,
        estado: true,
      },
      orderBy: [
        { apellido: 'asc' },
        { nombre: 'asc' },
      ],
      take: 1000,
    });

    // Convertir usuarios sin Student a formato compatible
    const studentsFromUsers = usersWithoutStudent.map(user => ({
      id: `temp-${user.id}`, // ID temporal
      userId: user.id,
      user: {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        estado: user.estado,
      },
      grupo: null,
      grupoId: null,
      matricula: null,
      _isPending: true, // Flag para identificar que necesita registro Student
    }));

    // Combinar estudiantes con registro y usuarios pendientes
    const availableStudents = [...studentsWithRecord, ...studentsFromUsers];

    res.json({
      data: availableStudents,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Promover estudiantes de un curso al siguiente grado
 */
export const promoteStudents = async (req, res, next) => {
  try {
    const { id: cursoId } = req.params;
    const { periodoIdDestino } = req.body; // Opcional: período destino, si no se proporciona usa el del curso siguiente

    // Verificar que el curso existe y tiene curso siguiente
    const curso = await prisma.course.findUnique({
      where: { id: cursoId },
      include: {
        cursoSiguiente: true,
        estudiantes: {
          include: {
            user: {
              select: {
                nombre: true,
                apellido: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!curso) {
      return res.status(404).json({
        error: 'Curso no encontrado.',
      });
    }

    if (!curso.cursoSiguiente) {
      return res.status(400).json({
        error: 'Este curso no tiene un siguiente grado configurado.',
      });
    }

    // Verificar que el curso siguiente existe en el período destino
    let cursoDestino;
    if (periodoIdDestino) {
      // Buscar o crear el curso en el período destino
      cursoDestino = await prisma.course.findFirst({
        where: {
          nivel: curso.cursoSiguiente.nivel,
          paralelo: curso.cursoSiguiente.paralelo,
          periodoId: periodoIdDestino,
        },
      });

      if (!cursoDestino) {
        // Crear el curso en el período destino
        cursoDestino = await prisma.course.create({
          data: {
            nombre: curso.cursoSiguiente.nombre,
            nivel: curso.cursoSiguiente.nivel,
            paralelo: curso.cursoSiguiente.paralelo,
            periodoId: periodoIdDestino,
            capacidad: curso.cursoSiguiente.capacidad || curso.capacidad,
            docenteId: curso.cursoSiguiente.docenteId,
          },
        });
      }
    } else {
      // Usar el curso siguiente directamente (mismo período)
      cursoDestino = curso.cursoSiguiente;
    }

    // Verificar capacidad del curso destino
    const currentCount = await prisma.student.count({
      where: { grupoId: cursoDestino.id },
    });

    if (cursoDestino.capacidad && (currentCount + curso.estudiantes.length) > cursoDestino.capacidad) {
      return res.status(400).json({
        error: `El curso destino no tiene suficiente capacidad. Capacidad: ${cursoDestino.capacidad}, Estudiantes actuales: ${currentCount}, Estudiantes a promocionar: ${curso.estudiantes.length}`,
      });
    }

    // Promover todos los estudiantes
    const estudiantesPromocionados = await prisma.student.updateMany({
      where: {
        grupoId: cursoId,
      },
      data: {
        grupoId: cursoDestino.id,
      },
    });

    res.json({
      message: `${estudiantesPromocionados.count} estudiantes promocionados exitosamente al curso ${cursoDestino.nombre}.`,
      estudiantesPromocionados: estudiantesPromocionados.count,
      cursoOrigen: {
        id: curso.id,
        nombre: curso.nombre,
      },
      cursoDestino: {
        id: cursoDestino.id,
        nombre: cursoDestino.nombre,
        periodoId: cursoDestino.periodoId,
      },
    });
  } catch (error) {
    next(error);
  }
};

