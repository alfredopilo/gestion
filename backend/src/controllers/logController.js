import prisma from '../config/database.js';

/**
 * Obtener logs de acceso con filtros y paginación
 */
export const getAccessLogs = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      action, 
      userId, 
      startDate, 
      endDate,
      email,
      search
    } = req.query;
    
    const where = {};
    
    // Filtrar por acción
    if (action) {
      where.action = action;
    }
    
    // Filtrar por usuario ID
    if (userId) {
      where.userId = userId;
    }
    
    // Filtrar por email
    if (email) {
      where.email = {
        contains: email,
        mode: 'insensitive',
      };
    }
    
    // Filtrar por búsqueda general (email o acción)
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { action: { contains: search, mode: 'insensitive' } },
        { ipAddress: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    // Filtrar por rango de fechas
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        where.timestamp.lte = endDateTime;
      }
    }
    
    const [logs, total] = await Promise.all([
      prisma.accessLog.findMany({
        where,
        include: {
          user: {
            select: {
              nombre: true,
              apellido: true,
              email: true,
              rol: true,
              numeroIdentificacion: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.accessLog.count({ where }),
    ]);
    
    res.json({
      data: logs,
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
 * Obtener estadísticas de login
 */
export const getLoginStats = async (req, res, next) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    // Estadísticas por acción
    const statsByAction = await prisma.accessLog.groupBy({
      by: ['action'],
      where: {
        timestamp: { gte: startDate },
        action: { in: ['LOGIN', 'LOGIN_FAILED', 'LOGOUT'] },
      },
      _count: { action: true },
    });
    
    // Estadísticas por día
    const logsByDay = await prisma.$queryRaw`
      SELECT 
        DATE(timestamp) as date,
        action,
        COUNT(*) as count
      FROM access_logs
      WHERE 
        timestamp >= ${startDate}
        AND action IN ('LOGIN', 'LOGIN_FAILED', 'LOGOUT')
      GROUP BY DATE(timestamp), action
      ORDER BY date DESC
    `;
    
    // Top usuarios con más actividad
    const topUsers = await prisma.accessLog.groupBy({
      by: ['userId'],
      where: {
        timestamp: { gte: startDate },
        userId: { not: null },
      },
      _count: { userId: true },
      orderBy: {
        _count: {
          userId: 'desc',
        },
      },
      take: 10,
    });
    
    // Obtener información de los top usuarios
    const userIds = topUsers.map(u => u.userId).filter(id => id);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        email: true,
        rol: true,
      },
    });
    
    const topUsersWithInfo = topUsers.map(tu => ({
      ...tu,
      user: users.find(u => u.id === tu.userId),
    }));
    
    // Intentos de login fallidos recientes
    const recentFailedLogins = await prisma.accessLog.findMany({
      where: {
        action: 'LOGIN_FAILED',
        timestamp: { gte: startDate },
      },
      orderBy: { timestamp: 'desc' },
      take: 20,
      select: {
        email: true,
        timestamp: true,
        ipAddress: true,
        details: true,
      },
    });
    
    res.json({
      statsByAction,
      logsByDay,
      topUsers: topUsersWithInfo,
      recentFailedLogins,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener acciones disponibles (para filtros)
 */
export const getAvailableActions = async (req, res, next) => {
  try {
    const actions = await prisma.accessLog.groupBy({
      by: ['action'],
      _count: { action: true },
      orderBy: {
        _count: {
          action: 'desc',
        },
      },
    });
    
    res.json(actions);
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener logs de un usuario específico
 */
export const getUserLogs = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    const [logs, total] = await Promise.all([
      prisma.accessLog.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.accessLog.count({ where: { userId } }),
    ]);
    
    res.json({
      data: logs,
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
 * Exportar logs a CSV
 */
export const exportLogsToCSV = async (req, res, next) => {
  try {
    const { startDate, endDate, action } = req.query;
    
    const where = {};
    if (action) where.action = action;
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        where.timestamp.lte = endDateTime;
      }
    }
    
    const logs = await prisma.accessLog.findMany({
      where,
      include: {
        user: {
          select: {
            nombre: true,
            apellido: true,
            email: true,
            rol: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: 10000, // Límite de 10,000 registros por exportación
    });
    
    // Crear CSV
    let csv = 'ID,Fecha,Hora,Usuario,Email,Rol,Acción,IP,User Agent\n';
    logs.forEach(log => {
      const fecha = new Date(log.timestamp).toLocaleDateString('es-EC');
      const hora = new Date(log.timestamp).toLocaleTimeString('es-EC');
      const usuario = log.user ? `${log.user.nombre} ${log.user.apellido}` : 'N/A';
      const email = log.email || 'N/A';
      const rol = log.user?.rol || 'N/A';
      const action = log.action;
      const ip = log.ipAddress || 'N/A';
      const userAgent = log.userAgent || 'N/A';
      
      csv += `"${log.id}","${fecha}","${hora}","${usuario}","${email}","${rol}","${action}","${ip}","${userAgent}"\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="logs-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
};
