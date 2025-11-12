import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../config/database.js';
import { createUserSchema, updateUserSchema } from '../utils/validators.js';
import { getUserInstitutionFilter } from '../utils/institutionFilter.js';

/**
 * Obtener todos los usuarios
 */
export const getUsers = async (req, res, next) => {
  try {
    const { rol, estado, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (rol) where.rol = rol;
    if (estado) where.estado = estado;
    
    // Filtrar por institución (excepto para ADMIN)
    if (req.user.rol !== 'ADMIN') {
      const institutionFilter = getUserInstitutionFilter(req);
      Object.assign(where, institutionFilter);
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          nombre: true,
          apellido: true,
          email: true,
          rol: true,
          estado: true,
          telefono: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      data: users,
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
 * Obtener un usuario por ID
 */
export const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log('=== OBTENER USUARIO POR ID ===');
    console.log('ID:', id);

    // Primero obtener el usuario básico
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        email: true,
        numeroIdentificacion: true,
        rol: true,
        estado: true,
        telefono: true,
        direccion: true,
        institucionId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: 'Usuario no encontrado.',
      });
    }

    // Obtener las instituciones del usuario por separado
    let institucionesTransformadas = [];
    try {
      const userInstitutions = await prisma.userInstitution.findMany({
        where: { userId: id },
        select: {
          institucion: {
            select: {
              id: true,
              nombre: true,
              activa: true,
            },
          },
        },
      });

      // Transformar y filtrar instituciones
      institucionesTransformadas = userInstitutions
        .map(ui => ui?.institucion)
        .filter(Boolean); // Filtrar valores null/undefined
    } catch (institutionError) {
      console.error('Error al obtener instituciones del usuario:', institutionError);
      // Continuar con instituciones vacías si hay error
      institucionesTransformadas = [];
    }

    const userWithInstitutions = {
      ...user,
      instituciones: institucionesTransformadas,
    };

    console.log('Usuario encontrado:', userWithInstitutions);
    res.json(userWithInstitutions);
  } catch (error) {
    console.error('Error en getUserById:', error);
    console.error('Stack:', error.stack);
    next(error);
  }
};

/**
 * Crear un nuevo usuario
 */
export const createUser = async (req, res, next) => {
  try {
    console.log('=== CREAR USUARIO ===');
    console.log('Body recibido:', JSON.stringify(req.body, null, 2));

    const validatedData = createUserSchema.parse(req.body);
    const { password, instituciones, ...userData } = validatedData;

    // Limpiar cualquier campo con nombre incorrecto que pueda venir del validador
    if (userData.hasOwnProperty('numeroldentificacion')) {
      userData.numeroIdentificacion = userData.numeroldentificacion;
      delete userData.numeroldentificacion;
    }

    console.log('Datos validados:', JSON.stringify({ instituciones, ...userData }, null, 2));
    console.log('Claves de userData:', Object.keys(userData));

    // Validar que el array de instituciones tenga al menos 1 elemento
    if (!instituciones || instituciones.length === 0) {
      return res.status(400).json({
        error: 'Debe seleccionar al menos una institución.',
      });
    }

    // Usar el primer elemento del array como institución principal si no se proporciona institucionId
    const institucionId = userData.institucionId || instituciones[0];
    
    // Validar que institucionId sea un UUID válido
    if (!institucionId || typeof institucionId !== 'string') {
      return res.status(400).json({
        error: 'ID de institución inválido.',
      });
    }

    userData.institucionId = institucionId;

    // Verificar que el email no exista
    const existingUser = await prisma.user.findUnique({
      where: { email: userData.email },
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'Ya existe un usuario con este email.',
      });
    }

    // Verificar que el número de identificación sea único en la institución principal
    // Solo verificar si el número de identificación está presente
    if (userData.numeroIdentificacion && typeof userData.numeroIdentificacion === 'string' && userData.numeroIdentificacion.trim() !== '') {
      try {
        const numeroIdentificacionLimpio = userData.numeroIdentificacion.trim();
        
        // Verificar que institucionId sea un UUID válido antes de la consulta
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(institucionId)) {
          return res.status(400).json({
            error: 'ID de institución con formato inválido.',
          });
        }

        // Usar una consulta SQL raw para evitar problemas con el cliente de Prisma
        const existingUser = await prisma.$queryRaw`
          SELECT id FROM users 
          WHERE numero_identificacion = ${numeroIdentificacionLimpio} 
          AND institucion_id = ${institucionId}::uuid
          LIMIT 1
        `;

        if (existingUser && Array.isArray(existingUser) && existingUser.length > 0) {
          return res.status(409).json({
            error: 'Ya existe un usuario con este número de identificación en esta institución.',
          });
        }
      } catch (prismaError) {
        console.error('Error al verificar número de identificación:', prismaError);
        console.error('Error completo:', prismaError);
        // Continuar con la creación del usuario si falla la verificación
        console.warn('Advertencia: No se pudo verificar la unicidad del número de identificación. Continuando...');
      }
    }

    // Verificar que todas las instituciones existan
    const existingInstitutions = await prisma.institution.findMany({
      where: {
        id: { in: instituciones },
      },
      select: { id: true },
    });

    if (existingInstitutions.length !== instituciones.length) {
      return res.status(404).json({
        error: 'Una o más instituciones no existen.',
      });
    }

    // Hashear contraseña
    const passwordHash = await bcrypt.hash(password, 10);

    // Construir explícitamente el objeto de datos para asegurar nombres correctos
    // Usar notación de corchetes para evitar cualquier problema de serialización
    const userCreateData = {};
    userCreateData['nombre'] = userData.nombre;
    userCreateData['apellido'] = userData.apellido;
    userCreateData['email'] = userData.email;
    userCreateData['numeroIdentificacion'] = userData.numeroIdentificacion || null;
    userCreateData['rol'] = userData.rol;
    userCreateData['estado'] = userData.estado || 'ACTIVO';
    userCreateData['telefono'] = userData.telefono || null;
    userCreateData['direccion'] = userData.direccion || null;
    userCreateData['institucionId'] = institucionId;
    userCreateData['passwordHash'] = passwordHash;

    // Remover campos undefined/null vacíos
    Object.keys(userCreateData).forEach(key => {
      if (userCreateData[key] === undefined || userCreateData[key] === '') {
        if (key !== 'numeroIdentificacion' && key !== 'telefono' && key !== 'direccion') {
          delete userCreateData[key];
        } else {
          userCreateData[key] = null;
        }
      }
    });

    // Verificar que el nombre del campo sea correcto antes de enviar a Prisma
    if (userCreateData.hasOwnProperty('numeroldentificacion')) {
      userCreateData['numeroIdentificacion'] = userCreateData['numeroldentificacion'];
      delete userCreateData['numeroldentificacion'];
    }

    console.log('Datos para crear usuario:', JSON.stringify(userCreateData, null, 2));
    console.log('Claves del objeto userCreateData:', Object.keys(userCreateData));

    // Crear usuario con institución principal
    const user = await prisma.user.create({
      data: userCreateData,
      select: {
        id: true,
        nombre: true,
        apellido: true,
        email: true,
        numeroIdentificacion: true,
        rol: true,
        estado: true,
        institucionId: true,
        createdAt: true,
      },
    });

    console.log('Usuario creado:', user.id);

    // Crear las relaciones con todas las instituciones
    try {
      const validInstitutionIds = instituciones.filter(id => 
        typeof id === 'string' && id.length > 0
      );

      if (validInstitutionIds.length > 0) {
        await prisma.userInstitution.createMany({
          data: validInstitutionIds.map(institucionId => ({
            id: randomUUID(),
            userId: user.id,
            institucionId,
          })),
        });
        console.log('Instituciones asignadas:', validInstitutionIds.length);
      }
    } catch (institutionError) {
      console.error('Error al asignar instituciones:', institutionError);
      // Revertir la creación del usuario si falla la asignación de instituciones
      await prisma.user.delete({ where: { id: user.id } });
      throw institutionError;
    }

    // Si el rol es PROFESOR, crear también el registro Teacher
    if (userData.rol === 'PROFESOR') {
      try {
        await prisma.teacher.create({
          data: {
            userId: user.id,
          },
        });
        console.log('Registro Teacher creado');
      } catch (teacherError) {
        console.error('Error al crear Teacher:', teacherError);
      }
    }
    
    // Si el rol es ESTUDIANTE, crear también el registro Student con valores mínimos
    if (userData.rol === 'ESTUDIANTE') {
      try {
        await prisma.student.create({
          data: {
            userId: user.id,
            fechaNacimiento: new Date(), // Fecha por defecto, se puede actualizar después
            nacionalidad: 'Ecuatoriana',
          },
        });
        console.log('Registro Student creado');
      } catch (studentError) {
        console.error('Error al crear Student:', studentError);
      }
    }

    res.status(201).json({
      message: 'Usuario creado exitosamente.',
      user,
    });
  } catch (error) {
    console.error('Error en createUser:', error);
    if (error.name === 'ZodError') {
      console.error('Errores de validación:', error.issues);
    }
    next(error);
  }
};

/**
 * Actualizar un usuario
 */
export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log('=== ACTUALIZAR USUARIO ===');
    console.log('ID:', id);
    console.log('Body recibido:', JSON.stringify(req.body, null, 2));
    
    const validatedData = updateUserSchema.parse(req.body);
    const { instituciones, ...userData } = validatedData;

    console.log('Datos validados:', JSON.stringify({ instituciones, ...userData }, null, 2));

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({
        error: 'Usuario no encontrado.',
      });
    }

    // Verificar que el email no esté en uso por otro usuario
    if (userData.email && userData.email !== user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email },
      });

      if (existingUser) {
        return res.status(409).json({
          error: 'Ya existe un usuario con este email.',
        });
      }
    }

    // Verificar que el número de identificación sea único en la institución
    if (userData.numeroIdentificacion && userData.numeroIdentificacion !== user.numeroIdentificacion) {
      const institucionId = userData.institucionId || user.institucionId;
      const existingUserByIdentification = await prisma.user.findFirst({
        where: {
          numeroIdentificacion: userData.numeroIdentificacion,
          institucionId: institucionId,
          id: { not: id },
        },
      });

      if (existingUserByIdentification) {
        return res.status(409).json({
          error: 'Ya existe un usuario con este número de identificación en esta institución.',
        });
      }
    }

    // Verificar que la institución existe si se está cambiando
    if (userData.institucionId && userData.institucionId !== user.institucionId) {
      const institution = await prisma.institution.findUnique({
        where: { id: userData.institucionId },
      });

      if (!institution) {
        return res.status(404).json({
          error: 'Institución no encontrada.',
        });
      }
    }

    // Actualizar usuario
    // Primero actualizar las instituciones si se proporcionan
    let primaryInstitutionIdFromList = null;

    if (instituciones !== undefined) {
      try {
        // Eliminar todas las relaciones existentes
        await prisma.userInstitution.deleteMany({
          where: { userId: id },
        });
        
        // Crear las nuevas relaciones si hay instituciones
        if (instituciones && Array.isArray(instituciones) && instituciones.length > 0) {
          // Filtrar IDs válidos (UUIDs)
          const validInstitutionIds = instituciones.filter(id => 
            typeof id === 'string' && id.length > 0
          );
          
          if (validInstitutionIds.length > 0) {
            await prisma.userInstitution.createMany({
              data: validInstitutionIds.map(institucionId => ({
                userId: id,
                institucionId,
              })),
            });

            primaryInstitutionIdFromList = validInstitutionIds[0];
          }
        }
      } catch (institutionError) {
        console.error('Error al actualizar instituciones:', institutionError);
        // Continuar con la actualización del usuario aunque falle la actualización de instituciones
      }
    }

    if (primaryInstitutionIdFromList) {
      userData.institucionId = primaryInstitutionIdFromList;
    }

    // Actualizar el usuario (solo campos que no sean undefined)
    const updateData = {};
    Object.keys(userData).forEach(key => {
      if (userData[key] !== undefined) {
        updateData[key] = userData[key];
      }
    });

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        nombre: true,
        apellido: true,
        email: true,
        numeroIdentificacion: true,
        rol: true,
        estado: true,
        telefono: true,
        direccion: true,
        institucionId: true,
        updatedAt: true,
      },
    });

    res.json({
      message: 'Usuario actualizado exitosamente.',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Error en updateUser:', error);
    if (error.name === 'ZodError') {
      console.error('Errores de validación:', error.issues);
    }
    next(error);
  }
};

/**
 * Eliminar un usuario
 */
export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // No permitir eliminar el propio usuario
    if (id === req.user.id) {
      return res.status(400).json({
        error: 'No puedes eliminar tu propia cuenta.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            grupoId: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        error: 'Usuario no encontrado.',
      });
    }

    if (user.student?.grupoId) {
      return res.status(400).json({
        error: 'No puedes eliminar este usuario porque el estudiante está asignado a un curso. Remuévelo del curso primero.',
      });
    }

    await prisma.user.delete({
      where: { id },
    });

    res.json({
      message: 'Usuario eliminado exitosamente.',
    });
  } catch (error) {
    next(error);
  }
};

