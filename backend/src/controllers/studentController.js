import prisma from '../config/database.js';
import { createStudentSchema } from '../utils/validators.js';
import { getStudentInstitutionFilter, verifyStudentBelongsToInstitution } from '../utils/institutionFilter.js';

/**
 * Obtener todos los estudiantes
 * Incluye usuarios con rol ESTUDIANTE que aún no tienen registro Student
 */
export const getStudents = async (req, res, next) => {
  try {
    const { grupoId, page = 1, limit = 1000 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (grupoId) {
      where.grupoId = grupoId;
    } else {
      // Filtrar por institución activa o del usuario si no se especifica grupo
      const institutionFilter = await getStudentInstitutionFilter(req, prisma);
      // Solo aplicar filtro si no está vacío
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
        orderBy: { createdAt: 'desc' },
      }),
      prisma.student.count({ where }),
    ]);

    // Obtener IDs de usuarios que ya tienen registro Student
    const studentsWithUser = students.map(s => s.userId);
    
    // Obtener usuarios con rol ESTUDIANTE que no tienen registro Student
    // Filtrar también por institución
    const institutionFilter = await getStudentInstitutionFilter(req, prisma);
    const userIdsFromInstitution = institutionFilter.userId?.in || [];
    
    const userWhere = {
      rol: 'ESTUDIANTE',
      estado: 'ACTIVO',
      id: {
        notIn: studentsWithUser.length > 0 ? studentsWithUser : [],
        ...(userIdsFromInstitution.length > 0 ? { in: userIdsFromInstitution } : {}),
      },
    };
    
    // Si hay filtro de institución, aplicar el filtro in además del notIn
    if (userIdsFromInstitution.length > 0) {
      userWhere.id = {
        notIn: studentsWithUser.length > 0 ? studentsWithUser : [],
        in: userIdsFromInstitution,
      };
    }
    
    const usersWithoutStudent = await prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        nombre: true,
        apellido: true,
        email: true,
        telefono: true,
        estado: true,
      },
      orderBy: { createdAt: 'desc' },
    });

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

