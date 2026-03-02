import prisma from '../config/database.js';
import { getCourseInstitutionFilter, getInstitutionFilter } from '../utils/institutionFilter.js';
import {
  groupAttendanceByStudentAndDate,
  computeHorasFaltantes,
  isSinAsistenciaTodoElDia,
  hasHorasFaltantes,
} from '../utils/inspectionCalculations.js';
import { sendInspectionNotifications } from '../services/inspectionNotificationService.js';

/**
 * Normaliza fecha a YYYY-MM-DD en timezone local para comparaciones.
 */
function toDateOnly(d) {
  const date = new Date(d);
  return date.toISOString().split('T')[0];
}

/**
 * Obtiene los datos del reporte de inspección (lógica compartida).
 * @returns {Promise<{ resumen, alertasSinAsistencia, alertasHorasFaltantes, detalle, indicadores } | { error: string }>}
 */
async function fetchInspectionData(req) {
  const { fecha, fechaDesde, fechaHasta, cursoId } = req.query;

  const singleDay = fecha;
  const range = fechaDesde && fechaHasta;
  if (!singleDay && !range) {
    return { error: 'Proporcione "fecha" (día) o "fechaDesde" y "fechaHasta" (rango).' };
  }

  let dates = [];
  if (singleDay) {
    dates = [new Date(singleDay)];
  } else {
    const start = new Date(fechaDesde);
    const end = new Date(fechaHasta);
    if (start > end) {
      return { error: 'fechaDesde debe ser anterior o igual a fechaHasta.' };
    }
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }
  }

  const courseFilter = await getCourseInstitutionFilter(req, prisma);
  const whereCourse = { ...courseFilter };
  if (cursoId) whereCourse.id = cursoId;

  const courses = await prisma.course.findMany({
    where: whereCourse,
    include: {
      nivel: { select: { id: true, nombreNivel: true, numeroHorasClases: true } },
      estudiantes: {
        select: {
          id: true,
          userId: true,
          user: { select: { nombre: true, apellido: true, numeroIdentificacion: true } },
          representanteId: true,
          representante: { select: { userId: true } },
        },
      },
    },
  });

  if (courses.length === 0) {
    return {
      resumen: { totalEstudiantes: 0, totalAlertasSinAsistencia: 0, totalAlertasHorasFaltantes: 0, fechas: [] },
      alertasSinAsistencia: [],
      alertasHorasFaltantes: [],
      detalle: [],
      indicadores: {},
    };
  }

  const cursoIds = courses.map(c => c.id);
  const estudianteIds = courses.flatMap(c => c.estudiantes.map(e => e.id));

  const dateStrs = dates.map(d => toDateOnly(d));
  const attendance = await prisma.attendance.findMany({
    where: {
      estudianteId: { in: estudianteIds },
      cursoId: { in: cursoIds },
      fecha: { gte: dates[0], lte: dates[dates.length - 1] },
    },
    select: { estudianteId: true, cursoId: true, fecha: true, estado: true },
  });

  const attendanceByKey = groupAttendanceByStudentAndDate(attendance);

  const alertasSinAsistencia = [];
  const alertasHorasFaltantes = [];
  const detalle = [];
  let totalAlertasSin = 0;
  let totalAlertasHoras = 0;

  for (const course of courses) {
    const numeroHorasClases = course.nivel?.numeroHorasClases ?? 40;
    for (const estudiante of course.estudiantes) {
      for (const date of dates) {
        const key = `${estudiante.id}|${toDateOnly(date)}`;
        const horasRegistradas = attendanceByKey.get(key) || 0;
        const { horasFaltantes } = computeHorasFaltantes(numeroHorasClases, horasRegistradas);

        detalle.push({
          fecha: toDateOnly(date),
          cursoId: course.id,
          cursoNombre: course.nombre,
          nivelNombre: course.nivel?.nombreNivel,
          numeroHorasClases,
          estudianteId: estudiante.id,
          estudianteNombre: `${estudiante.user?.apellido || ''} ${estudiante.user?.nombre || ''}`.trim(),
          numeroIdentificacion: estudiante.user?.numeroIdentificacion,
          horasRegistradas,
          horasFaltantes,
          sinAsistenciaTodoElDia: isSinAsistenciaTodoElDia(horasRegistradas),
        });

        if (isSinAsistenciaTodoElDia(horasRegistradas)) {
          totalAlertasSin += 1;
          alertasSinAsistencia.push({
            fecha: toDateOnly(date),
            cursoId: course.id,
            cursoNombre: course.nombre,
            estudianteId: estudiante.id,
            estudianteNombre: `${estudiante.user?.apellido || ''} ${estudiante.user?.nombre || ''}`.trim(),
            numeroIdentificacion: estudiante.user?.numeroIdentificacion,
            representanteUserId: estudiante.representante?.userId,
          });
        }
        if (hasHorasFaltantes(horasFaltantes)) {
          totalAlertasHoras += 1;
          alertasHorasFaltantes.push({
            fecha: toDateOnly(date),
            cursoId: course.id,
            cursoNombre: course.nombre,
            estudianteId: estudiante.id,
            estudianteNombre: `${estudiante.user?.apellido || ''} ${estudiante.user?.nombre || ''}`.trim(),
            numeroIdentificacion: estudiante.user?.numeroIdentificacion,
            horasEsperadas: numeroHorasClases,
            horasRegistradas,
            horasFaltantes,
            representanteUserId: estudiante.representante?.userId,
          });
        }
      }
    }
  }

  const totalEstudiantes = courses.reduce((acc, c) => acc + c.estudiantes.length, 0);
  const totalRegistros = dates.length * totalEstudiantes;
  const indicadores = {
    totalEstudiantes,
    totalDias: dates.length,
    totalAlertasSinAsistencia: totalAlertasSin,
    totalAlertasHorasFaltantes: totalAlertasHoras,
    porcentajeSinAsistencia: totalRegistros > 0 ? Math.round((totalAlertasSin / totalRegistros) * 100) : 0,
    porcentajeConHorasFaltantes: totalRegistros > 0 ? Math.round((totalAlertasHoras / totalRegistros) * 100) : 0,
  };

  return {
    resumen: {
      totalEstudiantes,
      totalAlertasSinAsistencia: totalAlertasSin,
      totalAlertasHorasFaltantes: totalAlertasHoras,
      fechas: dateStrs,
    },
    alertasSinAsistencia,
    alertasHorasFaltantes,
    detalle,
    indicadores,
  };
}

/**
 * Reporte de inspección: diario o por rango de fechas.
 * Query: fecha (día) O fechaDesde + fechaHasta (rango). Opcional: cursoId.
 */
export const getInspectionReport = async (req, res, next) => {
  try {
    const data = await fetchInspectionData(req);
    if (data.error) {
      return res.status(400).json({ error: data.error });
    }
    res.json(data);
  } catch (error) {
    next(error);
  }
};

/**
 * Indicadores de asistencia para el módulo de inspección.
 * Mismos filtros que el reporte; devuelve solo KPIs agregados.
 */
export const getInspectionIndicators = async (req, res, next) => {
  try {
    const data = await fetchInspectionData(req);
    if (data.error) {
      return res.status(400).json({ error: data.error });
    }
    res.json({ indicadores: data.indicadores, resumen: data.resumen });
  } catch (error) {
    next(error);
  }
};

/**
 * Enviar notificaciones a padres por alertas de asistencia (in-app + email).
 * Mismos query params que el reporte: fecha o fechaDesde/fechaHasta, opcional cursoId.
 */
export const notifyInspectionAlerts = async (req, res, next) => {
  try {
    const data = await fetchInspectionData(req);
    if (data.error) {
      return res.status(400).json({ error: data.error });
    }
    const institutionId = getInstitutionFilter(req);
    const result = await sendInspectionNotifications(
      data,
      institutionId || undefined,
      req.user?.id,
    );
    res.json({
      message: 'Notificaciones enviadas.',
      ...result,
    });
  } catch (error) {
    next(error);
  }
};
