/**
 * Cálculos para el módulo de inspección de asistencia.
 * Horas esperadas = numeroHorasClases del nivel del curso.
 * Horas registradas = conteo de asistencias (ASISTENCIA, TARDE) por estudiante por fecha.
 */

const ESTADOS_PRESENTE = ['ASISTENCIA', 'TARDE'];

/**
 * Agrupa registros de asistencia por (estudianteId, fecha) y cuenta horas presentes.
 * @param {Array<{estudianteId: string, fecha: Date, estado: string}>} attendanceRecords
 * @returns {Map<string, number>} clave "estudianteId|YYYY-MM-DD" -> cantidad de horas presentes
 */
export function groupAttendanceByStudentAndDate(attendanceRecords) {
  const map = new Map();
  for (const r of attendanceRecords) {
    if (!ESTADOS_PRESENTE.includes(r.estado)) continue;
    const key = `${r.estudianteId}|${r.fecha.toISOString().split('T')[0]}`;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

/**
 * Calcula horas faltantes para un estudiante en una fecha.
 * @param {number} numeroHorasClases - horas esperadas (del nivel)
 * @param {number} horasRegistradas - horas con asistencia/tarde
 * @returns {{ horasRegistradas: number, horasFaltantes: number }}
 */
export function computeHorasFaltantes(numeroHorasClases, horasRegistradas) {
  const horasFaltantes = Math.max(0, numeroHorasClases - (horasRegistradas || 0));
  return {
    horasRegistradas: horasRegistradas || 0,
    horasFaltantes,
  };
}

/**
 * Determina si hay alerta de sin asistencia todo el día (horasRegistradas === 0).
 */
export function isSinAsistenciaTodoElDia(horasRegistradas) {
  return (horasRegistradas || 0) === 0;
}

/**
 * Determina si hay alerta de horas faltantes (horasFaltantes > 0).
 */
export function hasHorasFaltantes(horasFaltantes) {
  return (horasFaltantes || 0) > 0;
}
