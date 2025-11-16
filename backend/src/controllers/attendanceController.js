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
            curso: {
              select: {
                id: true,
                nombre: true,
                nivel: true,
                paralelo: true,
              },
            },
            materia: {
              select: {
                id: true,
                nombre: true,
                codigo: true,
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

    // Construir clave única según campos disponibles
    const whereClause = {
      estudianteId: validatedData.estudianteId,
      fecha: validatedData.fecha,
      cursoId: validatedData.cursoId || null,
      materiaId: validatedData.materiaId || null,
      hora: validatedData.hora || null,
    };

    const attendance = await prisma.attendance.upsert({
      where: {
        estudianteId_fecha_cursoId_materiaId_hora: whereClause,
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
      asistencia.map(att => {
        const fecha = typeof att.fecha === 'string' ? new Date(att.fecha) : att.fecha;
        const whereClause = {
          estudianteId: att.estudianteId,
          fecha: fecha,
          cursoId: att.cursoId || null,
          materiaId: att.materiaId || null,
          hora: att.hora || null,
        };
        return prisma.attendance.upsert({
          where: {
            estudianteId_fecha_cursoId_materiaId_hora: whereClause,
          },
          update: {
            estado: att.estado,
            justificacion: att.justificacion,
            observaciones: att.observaciones,
          },
          create: att,
        });
      })
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

/**
 * Obtener clases de un curso para una fecha específica
 */
export const getCourseClassesForDate = async (req, res, next) => {
  try {
    const { cursoId, fecha } = req.query;

    if (!cursoId || !fecha) {
      return res.status(400).json({
        error: 'Debe proporcionar cursoId y fecha.',
      });
    }

    // Obtener el día de la semana de la fecha (usar solo fecha, sin hora para evitar problemas de zona horaria)
    const fechaStr = fecha.split('T')[0]; // Asegurar formato YYYY-MM-DD
    const [year, month, day] = fechaStr.split('-').map(Number);
    const fechaObj = new Date(year, month - 1, day); // month - 1 porque Date usa 0-indexed months
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const diaSemana = diasSemana[fechaObj.getDay()];

    // Construir filtro de asignaciones
    const whereClause = {
      cursoId,
    };

    // Si es PROFESOR, filtrar solo sus asignaciones
    if (req.user.rol === 'PROFESOR') {
      const teacher = await prisma.teacher.findUnique({
        where: { userId: req.user.id },
        select: { id: true },
      });
      
      if (teacher) {
        whereClause.docenteId = teacher.id;
      } else {
        // Si no es profesor válido, retornar vacío
        return res.json({ data: [] });
      }
    }

    // Obtener asignaciones del curso con horarios para ese día
    const assignments = await prisma.courseSubjectAssignment.findMany({
      where: whereClause,
      include: {
        materia: true,
        docente: {
          include: {
            user: true,
          },
        },
        horarios: {
          where: {
            diaSemana: diaSemana,
          },
          orderBy: {
            hora: 'asc',
          },
        },
      },
    });

    // Filtrar solo las que tienen horarios para ese día
    const classes = assignments
      .filter(a => a.horarios.length > 0)
      .flatMap(assignment =>
        assignment.horarios.map(horario => ({
          assignmentId: assignment.id,
          materia: {
            id: assignment.materia.id,
            nombre: assignment.materia.nombre,
            codigo: assignment.materia.codigo,
          },
          docente: {
            id: assignment.docente.id,
            nombre: assignment.docente.user?.nombre,
            apellido: assignment.docente.user?.apellido,
          },
          hora: horario.hora,
          diaSemana: horario.diaSemana,
        }))
      )
      .sort((a, b) => a.hora - b.hora);

    res.json({ data: classes });
  } catch (error) {
    next(error);
  }
};

