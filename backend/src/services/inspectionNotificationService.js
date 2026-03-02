/**
 * Envío de notificaciones a padres por alertas de inspección (asistencia).
 * Crea notificación in-app para el estudiante, mensaje in-app para el representante y email al padre.
 */

import prisma from '../config/database.js';
import { sendEmail } from './emailService.js';

/**
 * Agrupa alertas por (estudianteId, fecha) para crear una sola notificación por estudiante por día.
 */
function groupAlertsByStudentAndDate(alertasSinAsistencia, alertasHorasFaltantes) {
  const byKey = new Map();
  for (const a of alertasSinAsistencia) {
    const key = `${a.estudianteId}|${a.fecha}`;
    if (!byKey.has(key)) byKey.set(key, { ...a, tipo: 'sin_asistencia', horasFaltantes: null });
  }
  for (const a of alertasHorasFaltantes) {
    const key = `${a.estudianteId}|${a.fecha}`;
    if (byKey.has(key)) {
      byKey.get(key).horasFaltantes = a.horasFaltantes;
      byKey.get(key).tipo = 'ambos';
    } else {
      byKey.set(key, { ...a, tipo: 'horas_faltantes' });
    }
  }
  return Array.from(byKey.values());
}

/**
 * Envía notificaciones por las alertas de inspección.
 * @param {Object} data - resultado de fetchInspectionData (alertasSinAsistencia, alertasHorasFaltantes)
 * @param {string} institutionId - ID de la institución (para email)
 * @param {string} emisorUserId - ID del usuario que dispara el envío (para Mensaje)
 * @returns {{ notificationsCreated: number, mensajesCreated: number, emailsSent: number, errors: string[] }}
 */
export async function sendInspectionNotifications(data, institutionId, emisorUserId) {
  const errors = [];
  let notificationsCreated = 0;
  let mensajesCreated = 0;
  let emailsSent = 0;

  const allAlerts = [
    ...data.alertasSinAsistencia.map(a => ({ ...a, _tipo: 'sin_asistencia' })),
    ...data.alertasHorasFaltantes.map(a => ({ ...a, _tipo: 'horas_faltantes' })),
  ];

  const byStudentDate = groupAlertsByStudentAndDate(
    data.alertasSinAsistencia,
    data.alertasHorasFaltantes,
  );

  for (const item of byStudentDate) {
    try {
      const titulo = 'Alerta de asistencia';
      const mensaje =
        item.tipo === 'sin_asistencia'
          ? `El estudiante ${item.estudianteNombre} no registró asistencia el ${item.fecha} en ${item.cursoNombre}.`
          : item.tipo === 'horas_faltantes'
            ? `El estudiante ${item.estudianteNombre} tiene ${item.horasFaltantes} hora(s) faltantes el ${item.fecha} en ${item.cursoNombre}.`
            : `El estudiante ${item.estudianteNombre} no registró asistencia completa el ${item.fecha} en ${item.cursoNombre} (${item.horasFaltantes} horas faltantes).`;

      await prisma.notification.create({
        data: {
          estudianteId: item.estudianteId,
          titulo,
          mensaje,
          tipo: 'GENERAL',
        },
      });
      notificationsCreated += 1;
    } catch (e) {
      errors.push(`Notification estudiante ${item.estudianteId}: ${e.message}`);
    }
  }

  const byParent = new Map();
  for (const a of allAlerts) {
    const uid = a.representanteUserId;
    if (!uid) continue;
    if (!byParent.has(uid)) byParent.set(uid, []);
    byParent.get(uid).push(a);
  }

  for (const [receptorUserId, alerts] of byParent) {
    const first = alerts[0];
    const estudianteNombres = [...new Set(alerts.map(a => a.estudianteNombre))];
    const asunto = 'Faltas de asistencia - Sistema de Gestión Escolar';
    const lineas = alerts.map(
      a =>
        `- ${a.estudianteNombre} (${a.cursoNombre}): ${a._tipo === 'sin_asistencia' ? 'Sin asistencia' : `${a.horasFaltantes} horas faltantes`} el ${a.fecha}`,
    );
    const cuerpo = `Se le informa sobre las siguientes incidencias de asistencia:\n\n${lineas.join('\n')}\n\nSaludos.`;

    try {
      await prisma.mensaje.create({
        data: {
          emisorId: emisorUserId,
          receptorId: receptorUserId,
          asunto,
          cuerpo,
          tipoMensaje: 'INDIVIDUAL',
        },
      });
      mensajesCreated += 1;
    } catch (e) {
      errors.push(`Mensaje padre ${receptorUserId}: ${e.message}`);
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: receptorUserId },
        select: { email: true },
      });
      if (user?.email && institutionId) {
        const html = `<p>Se le informa sobre las siguientes incidencias de asistencia:</p><ul>${alerts.map(a => `<li>${a.estudianteNombre} (${a.cursoNombre}): ${a._tipo === 'sin_asistencia' ? 'Sin asistencia' : `${a.horasFaltantes} horas faltantes`} el ${a.fecha}</li>`).join('')}</ul><p>Saludos.</p>`;
        await sendEmail(institutionId, user.email, asunto, html);
        emailsSent += 1;
      }
    } catch (e) {
      errors.push(`Email padre ${receptorUserId}: ${e.message}`);
    }
  }

  return {
    notificationsCreated,
    mensajesCreated,
    emailsSent,
    errors,
  };
}
