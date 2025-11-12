/**
 * Truncar un número a 2 decimales (sin redondeo)
 */
export function truncate(number, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.floor(number * factor) / factor;
}

/**
 * Calcular promedio ponderado de calificaciones por subperíodo
 * @param {Array} grades - Array de calificaciones con subPeriodo incluido
 * @returns {Object} - { promedioSubPeriodo: number, promedioPeriodo: number, promedioFinal: number }
 */
export function calculateWeightedAverage(grades) {
  if (!grades || grades.length === 0) {
    return {
      promedioSubPeriodo: 0,
      promedioPeriodo: 0,
      promedioFinal: 0,
      detalles: [],
    };
  }

  // Agrupar calificaciones por subperíodo
  const gradesBySubPeriod = {};
  grades.forEach(grade => {
    if (grade.subPeriodo) {
      const subPeriodId = grade.subPeriodo.id;
      if (!gradesBySubPeriod[subPeriodId]) {
        gradesBySubPeriod[subPeriodId] = {
          subPeriodo: grade.subPeriodo,
          calificaciones: [],
        };
      }
      gradesBySubPeriod[subPeriodId].calificaciones.push(grade.calificacion);
    }
  });

  // Calcular promedio de cada subperíodo (truncado)
  const subPeriodAverages = {};
  Object.keys(gradesBySubPeriod).forEach(subPeriodId => {
    const subPeriodData = gradesBySubPeriod[subPeriodId];
    const sum = subPeriodData.calificaciones.reduce((acc, cal) => acc + cal, 0);
    const average = sum / subPeriodData.calificaciones.length;
    subPeriodAverages[subPeriodId] = truncate(average);
  });

  // Calcular promedio ponderado del período
  let sumaPonderada = 0;
  let sumaPonderacion = 0;
  const detalles = [];

  Object.keys(subPeriodAverages).forEach(subPeriodId => {
    const promedio = subPeriodAverages[subPeriodId];
    const ponderacion = gradesBySubPeriod[subPeriodId].subPeriodo.ponderacion;
    const periodoPonderacion = gradesBySubPeriod[subPeriodId].subPeriodo.periodo?.ponderacion || 100;
    
    sumaPonderada += promedio * (ponderacion / 100);
    sumaPonderacion += ponderacion / 100;
    
    detalles.push({
      subPeriodo: gradesBySubPeriod[subPeriodId].subPeriodo.nombre,
      promedio: promedio,
      ponderacion: ponderacion,
      contribucion: truncate(promedio * (ponderacion / 100)),
    });
  });

  const promedioPeriodo = sumaPonderacion > 0 ? sumaPonderada / sumaPonderacion : 0;
  const promedioPeriodoTruncado = truncate(promedioPeriodo);

  // Si hay ponderación del período, aplicar al promedio final
  const periodo = grades[0]?.subPeriodo?.periodo;
  const promedioFinal = periodo?.ponderacion 
    ? truncate(promedioPeriodoTruncado * (periodo.ponderacion / 100))
    : promedioPeriodoTruncado;

  return {
    promedioSubPeriodo: promedioPeriodoTruncado,
    promedioPeriodo: promedioPeriodoTruncado,
    promedioFinal: promedioFinal,
    detalles: detalles,
    aprobado: periodo ? promedioFinal >= (periodo.calificacionMinima || 7.0) : false,
  };
}

/**
 * Calcular promedio final considerando múltiples períodos
 * @param {Array} periodAverages - Array de { periodoId, promedio, ponderacion }
 * @returns {number} - Promedio final truncado
 */
export function calculateFinalAverage(periodAverages) {
  if (!periodAverages || periodAverages.length === 0) {
    return 0;
  }

  let sumaPonderada = 0;
  let sumaPonderacion = 0;

  periodAverages.forEach(({ promedio, ponderacion }) => {
    sumaPonderada += promedio * (ponderacion / 100);
    sumaPonderacion += ponderacion / 100;
  });

  const promedioFinal = sumaPonderacion > 0 ? sumaPonderada / sumaPonderacion : 0;
  return truncate(promedioFinal);
}

