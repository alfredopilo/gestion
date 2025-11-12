import prisma from '../config/database.js';
import { createAttendanceSchema } from '../utils/validators.js';
import { getAttendanceInstitutionFilter } from '../utils/institutionFilter.js';

/**
 * Obtener registros de asistencia
 */
export const getAttendance = async (req, res, next) => {
  try {
    const { estudianteId, fechaInicio, fechaFin, estado, grupoId, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (estudianteId) {
      where.estudianteId = estudianteId;
    } else if (!grupoId) {
      // Filtrar por institución si no se especifica estudiante ni grupo
      const institutionFilter = await getAttendanceInstitutionFilter(req, prisma);
      if (Object.keys(institutionFilter).length > 0) {
        if (institutionFilter.estudianteId?.in && institutionFilter.estudianteId.in.length === 0) {
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
    if (estado) where.estado = estado;

    if (fechaInicio || fechaFin) {
      where.fecha = {};
      if (fechaInicio) where.fecha.gte = new Date(fechaInicio);
      if (fechaFin) where.fecha.lte = new Date(fechaFin);
    }

    // Si se filtra por grupo, obtener los estudiantes del grupo
    if (grupoId) {
      const estudiantes = await prisma.student.findMany({
        where: { grupoId },
        select: { id: true },
      });
      where.estudianteId = { in: estudiantes.map(e => e.id) };
    }

    const [attendance, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          estudiante: {
            include: {
              user: {
                select: {
                  nombre: true,
                  apellido: true,
                },
              },
              grupo: {
                select: {
                  nombre: true,
                  nivel: true,
                  paralelo: true,
                },
              },
            },
          },
        },
        orderBy: { fecha: 'desc' },
      }),
      prisma.attendance.count({ where }),
    ]);

    res.json({
      data: attendance,
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
 * Registrar asistencia
 */
export const createAttendance = async (req, res, next) => {
  try {
    const validatedData = createAttendanceSchema.parse(req.body);

    // Convertir fecha si es necesario
    if (typeof validatedData.fecha === 'string') {
      validatedData.fecha = new Date(validatedData.fecha);
    }

    const attendance = await prisma.attendance.upsert({
      where: {
        estudianteId_fecha: {
          estudianteId: validatedData.estudianteId,
          fecha: validatedData.fecha,
        },
      },
      update: {
        estado: validatedData.estado,
        justificacion: validatedData.justificacion,
        observaciones: validatedData.observaciones,
      },
      create: validatedData,
      include: {
        estudiante: {
          include: {
            user: {
              select: {
                nombre: true,
                apellido: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json({
      message: 'Asistencia registrada exitosamente.',
      attendance,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Carga masiva de asistencia
 */
export const bulkCreateAttendance = async (req, res, next) => {
  try {
    const { asistencia } = req.body;

    if (!Array.isArray(asistencia) || asistencia.length === 0) {
      return res.status(400).json({
        error: 'Debe proporcionar un array de registros de asistencia.',
      });
    }

    // Validar cada registro
    for (const att of asistencia) {
      createAttendanceSchema.parse(att);
      if (typeof att.fecha === 'string') {
        att.fecha = new Date(att.fecha);
      }
    }

    // Usar transacción
    const results = await prisma.$transaction(
      asistencia.map(att =>
        prisma.attendance.upsert({
          where: {
            estudianteId_fecha: {
              estudianteId: att.estudianteId,
              fecha: att.fecha,
            },
          },
          update: {
            estado: att.estado,
            justificacion: att.justificacion,
            observaciones: att.observaciones,
          },
          create: att,
        })
      )
    );

    res.json({
      message: `${results.length} registros de asistencia procesados exitosamente.`,
      count: results.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener resumen de asistencia por estudiante
 */
export const getAttendanceSummary = async (req, res, next) => {
  try {
    const { estudianteId, fechaInicio, fechaFin } = req.query;

    if (!estudianteId) {
      return res.status(400).json({
        error: 'Debe proporcionar el ID del estudiante.',
      });
    }

    const where = { estudianteId };
    if (fechaInicio || fechaFin) {
      where.fecha = {};
      if (fechaInicio) where.fecha.gte = new Date(fechaInicio);
      if (fechaFin) where.fecha.lte = new Date(fechaFin);
    }

    const attendance = await prisma.attendance.findMany({
      where,
      orderBy: { fecha: 'asc' },
    });

    // Calcular resumen
    const total = attendance.length;
    const asistencias = attendance.filter(a => a.estado === 'ASISTENCIA').length;
    const faltas = attendance.filter(a => a.estado === 'FALTA').length;
    const justificadas = attendance.filter(a => a.estado === 'JUSTIFICADA').length;
    const tardes = attendance.filter(a => a.estado === 'TARDE').length;

    const porcentajeAsistencia = total > 0 ? ((asistencias + tardes + justificadas) / total) * 100 : 0;

    res.json({
      estudianteId,
      resumen: {
        total,
        asistencias,
        faltas,
        justificadas,
        tardes,
        porcentajeAsistencia: Math.round(porcentajeAsistencia * 100) / 100,
      },
      registros: attendance,
    });
  } catch (error) {
    next(error);
  }
};

