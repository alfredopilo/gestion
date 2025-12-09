import prisma from '../config/database.js';
import { getStudentInstitutionFilter } from '../utils/institutionFilter.js';

/**
 * Obtener todas las notificaciones de un estudiante
 */
export const getNotifications = async (req, res, next) => {
  try {
    const { leido } = req.query;
    
    // Verificar que el usuario sea estudiante
    if (req.user?.rol !== 'ESTUDIANTE') {
      return res.status(403).json({
        error: 'Acceso denegado. Solo los estudiantes pueden ver notificaciones.',
      });
    }

    // Obtener el ID del estudiante desde la base de datos
    const student = await prisma.student.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });

    if (!student) {
      return res.status(404).json({
        error: 'Registro de estudiante no encontrado.',
      });
    }

    const studentId = student.id;

    const where = {
      estudianteId: studentId,
    };

    if (leido !== undefined) {
      where.leido = leido === 'true';
    }

    const notifications = await prisma.notification.findMany({
      where,
      include: {
        insumo: {
          include: {
            materia: {
              select: {
                id: true,
                nombre: true,
                codigo: true,
              },
            },
            curso: {
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener conteo de notificaciones no leídas
 */
export const getUnreadCount = async (req, res, next) => {
  try {
    // Verificar que el usuario sea estudiante
    if (req.user?.rol !== 'ESTUDIANTE') {
      return res.status(403).json({
        error: 'Acceso denegado. Solo los estudiantes pueden ver notificaciones.',
      });
    }

    // Obtener el ID del estudiante desde la base de datos
    const student = await prisma.student.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });

    if (!student) {
      return res.status(404).json({
        error: 'Registro de estudiante no encontrado.',
      });
    }

    const studentId = student.id;

    const count = await prisma.notification.count({
      where: {
        estudianteId: studentId,
        leido: false,
      },
    });

    res.json({
      count,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Marcar una notificación como leída
 */
export const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Verificar que el usuario sea estudiante
    if (req.user?.rol !== 'ESTUDIANTE') {
      return res.status(403).json({
        error: 'Acceso denegado. Solo los estudiantes pueden marcar notificaciones.',
      });
    }

    // Obtener el ID del estudiante desde la base de datos
    const student = await prisma.student.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });

    if (!student) {
      return res.status(404).json({
        error: 'Registro de estudiante no encontrado.',
      });
    }

    const studentId = student.id;

    // Verificar que la notificación pertenece al estudiante
    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      return res.status(404).json({
        error: 'Notificación no encontrada.',
      });
    }

    if (notification.estudianteId !== studentId) {
      return res.status(403).json({
        error: 'No tienes permiso para modificar esta notificación.',
      });
    }

    const updatedNotification = await prisma.notification.update({
      where: { id },
      data: {
        leido: true,
      },
    });

    res.json({
      message: 'Notificación marcada como leída.',
      notification: updatedNotification,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Marcar todas las notificaciones como leídas
 */
export const markAllAsRead = async (req, res, next) => {
  try {
    // Verificar que el usuario sea estudiante
    if (req.user?.rol !== 'ESTUDIANTE') {
      return res.status(403).json({
        error: 'Acceso denegado. Solo los estudiantes pueden marcar notificaciones.',
      });
    }

    // Obtener el ID del estudiante desde la base de datos
    const student = await prisma.student.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });

    if (!student) {
      return res.status(404).json({
        error: 'Registro de estudiante no encontrado.',
      });
    }

    const studentId = student.id;

    await prisma.notification.updateMany({
      where: {
        estudianteId: studentId,
        leido: false,
      },
      data: {
        leido: true,
      },
    });

    res.json({
      message: 'Todas las notificaciones han sido marcadas como leídas.',
    });
  } catch (error) {
    next(error);
  }
};

