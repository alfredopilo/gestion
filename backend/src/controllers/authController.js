import bcrypt from 'bcryptjs';
import prisma from '../config/database.js';
import { generateToken } from '../utils/jwt.js';
import { loginSchema, updateProfileSchema } from '../utils/validators.js';
import { logAction, logLoginFailed } from '../middleware/logging.js';

/**
 * Login de usuario
 */
export const login = async (req, res, next) => {
  try {
    // Validar datos (strip elimina campos adicionales automáticamente)
    const validatedData = loginSchema.parse(req.body);
    const { numeroIdentificacion, password } = validatedData;

    // Buscar usuario por número de identificación (buscar en todas las instituciones)
    // El número de identificación debería ser único por usuario
    const user = await prisma.user.findFirst({
      where: {
        numeroIdentificacion: numeroIdentificacion.trim(),
      },
    });

    if (!user) {
      // Registrar intento de login fallido
      await logLoginFailed(numeroIdentificacion, 'Usuario no encontrado', req);
      return res.status(401).json({
        error: 'Credenciales inválidas.',
      });
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      // Registrar intento de login fallido
      await logLoginFailed(user.email, 'Contraseña incorrecta', req);
      return res.status(401).json({
        error: 'Credenciales inválidas.',
      });
    }

    // Verificar que el usuario esté activo
    if (user.estado !== 'ACTIVO') {
      // Registrar intento de login con usuario inactivo
      await logLoginFailed(user.email, `Usuario con estado: ${user.estado}`, req);
      return res.status(403).json({
        error: 'Usuario inactivo. Contacte al administrador.',
      });
    }

    // Generar token
    const token = generateToken(user.id, user.rol);

    // Obtener información adicional según el rol
    let additionalInfo = {};
    if (user.rol === 'ESTUDIANTE') {
      const student = await prisma.student.findUnique({
        where: { userId: user.id },
        include: { 
          grupo: {
            include: {
              periodo: true,
            }
          }
        },
      });
      additionalInfo = { student };
    } else if (user.rol === 'PROFESOR') {
      const teacher = await prisma.teacher.findUnique({
        where: { userId: user.id },
        include: {
          courses: {
            include: { periodo: true },
          },
          course_subject_assignments: {
            include: {
              materia: true,
              curso: {
                include: { periodo: true },
              },
            },
          },
        },
      });
      additionalInfo = { teacher };
    } else if (user.rol === 'REPRESENTANTE') {
      const representante = await prisma.representante.findUnique({
        where: { userId: user.id },
        include: {
          students: {
            where: {
              retirado: false,
            },
            include: {
              user: {
                select: {
                  nombre: true,
                  apellido: true,
                  email: true,
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
            },
          },
        },
      });
      additionalInfo = { representante };
    }

    // Registrar login exitoso
    await logAction(user.id, 'LOGIN', {
      email: user.email,
      rol: user.rol,
      institucionId: user.institucionId,
    }, req);

    res.json({
      message: 'Login exitoso',
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        rol: user.rol,
        institucionId: user.institucionId,
        ...additionalInfo,
      },
    });
  } catch (error) {
    // Si es un error de validación o autenticación, registrar el intento fallido
    if (req.body?.numeroIdentificacion) {
      await logLoginFailed(req.body.numeroIdentificacion, error.message, req);
    }
    next(error);
  }
};

/**
 * Obtener perfil del usuario autenticado
 */
export const getProfile = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
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
        createdAt: true,
      },
    });

    // Obtener información adicional según el rol
    let additionalInfo = {};
    if (req.user.rol === 'ESTUDIANTE') {
      const student = await prisma.student.findUnique({
        where: { userId: user.id },
        include: {
          grupo: {
            include: {
              periodo: true,
              docente: {
                include: { user: true },
              },
            },
          },
          representante: {
            include: { user: true },
          },
        },
      });
      additionalInfo = { student };
    } else if (req.user.rol === 'PROFESOR') {
      const teacher = await prisma.teacher.findUnique({
        where: { userId: user.id },
        include: {
          courses: {
            include: { periodo: true },
          },
          course_subject_assignments: {
            include: {
              materia: true,
              curso: {
                include: { periodo: true },
              },
            },
          },
        },
      });
      additionalInfo = { teacher };
    } else if (req.user.rol === 'REPRESENTANTE') {
      const representante = await prisma.representante.findUnique({
        where: { userId: user.id },
        include: {
          students: {
            where: {
              retirado: false,
            },
            include: {
              user: {
                select: {
                  nombre: true,
                  apellido: true,
                  email: true,
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
            },
          },
        },
      });
      additionalInfo = { representante };
    }

    res.json({
      ...user,
      ...additionalInfo,
      permissions: req.user.permissions || [],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Actualizar perfil del usuario autenticado
 */
export const updateProfile = async (req, res, next) => {
  try {
    const validatedData = updateProfileSchema.parse(req.body);
    
    // Obtener usuario actual
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    // Preparar datos para actualizar
    const updateData = { ...validatedData };
    
    // Si se proporciona email, verificar que no exista otro usuario con ese email
    if (updateData.email && updateData.email !== currentUser.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: updateData.email },
      });
      
      if (existingUser) {
        return res.status(409).json({
          error: 'Ya existe un usuario con este email.',
        });
      }
    }

    // Si se proporciona número de identificación, verificar que no exista otro usuario con ese número en la misma institución
    if (updateData.numeroIdentificacion && updateData.numeroIdentificacion !== currentUser.numeroIdentificacion) {
      const numeroIdentificacionLimpio = updateData.numeroIdentificacion.trim();
      const existingUser = await prisma.$queryRaw`
        SELECT id FROM users 
        WHERE numero_identificacion = ${numeroIdentificacionLimpio} 
        AND institucion_id = ${currentUser.institucionId}::uuid
        AND id != ${currentUser.id}::uuid
        LIMIT 1
      `;
      
      if (existingUser && Array.isArray(existingUser) && existingUser.length > 0) {
        return res.status(409).json({
          error: 'Ya existe un usuario con este número de identificación en esta institución.',
        });
      }
    }

    // Si se proporciona nueva contraseña, hashearla
    if (updateData.password) {
      updateData.passwordHash = await bcrypt.hash(updateData.password, 10);
      delete updateData.password;
    }

    // Actualizar usuario
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
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
        createdAt: true,
      },
    });

    res.json({
      message: 'Perfil actualizado exitosamente.',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cambiar contraseña
 */
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({
        error: 'La nueva contraseña debe tener al menos 6 caracteres.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Contraseña actual incorrecta.',
      });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash: newPasswordHash },
    });

    res.json({
      message: 'Contraseña actualizada exitosamente.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout de usuario (registra la acción)
 */
export const logout = async (req, res, next) => {
  try {
    // Registrar logout
    await logAction(req.user.id, 'LOGOUT', {
      email: req.user.email,
      rol: req.user.rol,
    }, req);

    res.json({
      message: 'Sesión cerrada exitosamente.',
    });
  } catch (error) {
    next(error);
  }
};