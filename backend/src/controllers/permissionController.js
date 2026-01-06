import prisma from '../config/database.js';
import { z } from 'zod';

/**
 * Schema de validación para permisos
 */
const permissionSchema = z.object({
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  descripcion: z.string().optional(),
  modulo: z.string().min(2, 'El módulo es requerido'),
  accion: z.string().min(2, 'La acción es requerida'),
});

const rolePermissionsSchema = z.object({
  permissions: z.array(z.string().uuid()).min(1, 'Debe proporcionar al menos un permiso'),
});

/**
 * Obtener todos los permisos
 */
export const getAllPermissions = async (req, res) => {
  try {
    const { modulo, accion, page = 1, limit = 100 } = req.query;
    
    const where = {};
    if (modulo) where.modulo = modulo;
    if (accion) where.accion = accion;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [permissions, total] = await Promise.all([
      prisma.permission.findMany({
        where,
        orderBy: [
          { modulo: 'asc' },
          { accion: 'asc' },
        ],
        skip,
        take: parseInt(limit),
      }),
      prisma.permission.count({ where }),
    ]);

    res.json({
      permissions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error al obtener permisos:', error);
    res.status(500).json({ error: 'Error al obtener permisos' });
  }
};

/**
 * Crear un nuevo permiso
 */
export const createPermission = async (req, res) => {
  try {
    const validatedData = permissionSchema.parse(req.body);

    const permission = await prisma.permission.create({
      data: validatedData,
    });

    res.status(201).json(permission);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Datos inválidos', 
        details: error.errors 
      });
    }
    
    if (error.code === 'P2002') {
      return res.status(409).json({ 
        error: 'Ya existe un permiso con ese nombre' 
      });
    }

    console.error('Error al crear permiso:', error);
    res.status(500).json({ error: 'Error al crear permiso' });
  }
};

/**
 * Actualizar un permiso
 */
export const updatePermission = async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = permissionSchema.parse(req.body);

    const permission = await prisma.permission.update({
      where: { id },
      data: validatedData,
    });

    res.json(permission);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Datos inválidos', 
        details: error.errors 
      });
    }
    
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Permiso no encontrado' });
    }

    if (error.code === 'P2002') {
      return res.status(409).json({ 
        error: 'Ya existe un permiso con ese nombre' 
      });
    }

    console.error('Error al actualizar permiso:', error);
    res.status(500).json({ error: 'Error al actualizar permiso' });
  }
};

/**
 * Eliminar un permiso
 */
export const deletePermission = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.permission.delete({
      where: { id },
    });

    res.json({ message: 'Permiso eliminado correctamente' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Permiso no encontrado' });
    }

    console.error('Error al eliminar permiso:', error);
    res.status(500).json({ error: 'Error al eliminar permiso' });
  }
};

/**
 * Obtener permisos de un rol específico
 */
export const getRolePermissions = async (req, res) => {
  try {
    const { rol } = req.params;

    // Validar que el rol sea válido
    const validRoles = ['ADMIN', 'PROFESOR', 'ESTUDIANTE', 'REPRESENTANTE', 'SECRETARIA'];
    if (!validRoles.includes(rol)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }

    const rolePermissions = await prisma.rolePermission.findMany({
      where: { rol },
      include: {
        permission: true,
      },
    });

    const permissions = rolePermissions.map(rp => rp.permission);

    res.json({ rol, permissions });
  } catch (error) {
    console.error('Error al obtener permisos del rol:', error);
    res.status(500).json({ error: 'Error al obtener permisos del rol' });
  }
};

/**
 * Actualizar permisos de un rol
 */
export const updateRolePermissions = async (req, res) => {
  try {
    const { rol } = req.params;
    const validatedData = rolePermissionsSchema.parse(req.body);

    // Validar que el rol sea válido
    const validRoles = ['ADMIN', 'PROFESOR', 'ESTUDIANTE', 'REPRESENTANTE', 'SECRETARIA'];
    if (!validRoles.includes(rol)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }

    // Validar que todos los permisos existen
    const permissionsCount = await prisma.permission.count({
      where: {
        id: { in: validatedData.permissions },
      },
    });

    if (permissionsCount !== validatedData.permissions.length) {
      return res.status(400).json({ 
        error: 'Algunos permisos no existen' 
      });
    }

    // Eliminar permisos actuales del rol
    await prisma.rolePermission.deleteMany({
      where: { rol },
    });

    // Crear nuevos permisos
    const rolePermissions = await prisma.rolePermission.createMany({
      data: validatedData.permissions.map(permissionId => ({
        rol,
        permissionId,
      })),
    });

    // Obtener los permisos actualizados
    const updatedPermissions = await prisma.rolePermission.findMany({
      where: { rol },
      include: {
        permission: true,
      },
    });

    res.json({
      rol,
      permissions: updatedPermissions.map(rp => rp.permission),
      message: 'Permisos del rol actualizados correctamente',
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: 'Datos inválidos', 
        details: error.errors 
      });
    }

    console.error('Error al actualizar permisos del rol:', error);
    res.status(500).json({ error: 'Error al actualizar permisos del rol' });
  }
};

/**
 * Obtener todos los módulos disponibles
 */
export const getModules = async (req, res) => {
  try {
    const modules = await prisma.permission.findMany({
      select: {
        modulo: true,
      },
      distinct: ['modulo'],
      orderBy: {
        modulo: 'asc',
      },
    });

    res.json(modules.map(m => m.modulo));
  } catch (error) {
    console.error('Error al obtener módulos:', error);
    res.status(500).json({ error: 'Error al obtener módulos' });
  }
};

/**
 * Obtener todas las acciones disponibles
 */
export const getActions = async (req, res) => {
  try {
    const actions = await prisma.permission.findMany({
      select: {
        accion: true,
      },
      distinct: ['accion'],
      orderBy: {
        accion: 'asc',
      },
    });

    res.json(actions.map(a => a.accion));
  } catch (error) {
    console.error('Error al obtener acciones:', error);
    res.status(500).json({ error: 'Error al obtener acciones' });
  }
};
