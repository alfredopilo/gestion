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
          include: {
            periodo: true,
            docente: {
              include: { user: true },
            },
            course_subject_assignments: {
              include: {
                materia: true,
                docente: {
                  include: { user: true },
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

