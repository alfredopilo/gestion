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

/**
 * Obtener el equivalente de una escala de calificación según un promedio numérico
 * @param {Object} gradeScale - Objeto de escala de calificación con detalles
 * @param {number} promedio - Promedio numérico a convertir
 * @returns {string|null} - Título del equivalente en la escala o null si no hay escala
 */
export function getGradeScaleEquivalent(gradeScale, promedio) {
  if (!gradeScale || !gradeScale.detalles || gradeScale.detalles.length === 0) {
    return null;
  }

  if (promedio === null || promedio === undefined || isNaN(promedio)) {
    return null;
  }

  // Ordenar detalles por valor (ascendente)
  const detallesOrdenados = [...gradeScale.detalles].sort((a, b) => a.valor - b.valor);

  // Buscar el equivalente exacto primero
  const exactMatch = detallesOrdenados.find(d => d.valor === promedio);
  if (exactMatch) {
    return exactMatch.titulo;
  }

  // Si no hay coincidencia exacta, buscar el más cercano
  // Para valores menores al mínimo, usar el mínimo
  if (promedio < detallesOrdenados[0].valor) {
    return detallesOrdenados[0].titulo;
  }

  // Para valores mayores al máximo, usar el máximo
  if (promedio > detallesOrdenados[detallesOrdenados.length - 1].valor) {
    return detallesOrdenados[detallesOrdenados.length - 1].titulo;
  }

  // Buscar el valor más cercano
  let closestDetail = detallesOrdenados[0];
  let minDiff = Math.abs(promedio - detallesOrdenados[0].valor);

  for (const detail of detallesOrdenados) {
    const diff = Math.abs(promedio - detail.valor);
    if (diff < minDiff) {
      minDiff = diff;
      closestDetail = detail;
    }
  }

  return closestDetail.titulo;
}

/**
 * Calcular promedio final considerando supletorios
 * Reemplaza períodos bajos con la calificación de supletorio
 * @param {Array} periodAverages - Array de { periodoId, promedio, ponderacion, calificacionMinima }
 * @param {number} supplementaryAverage - Calificación de supletorio
 * @returns {Object} - { promedioFinal: number, periodAveragesAdjusted: Array, periodsReplaced: Array }
 */
export function calculateFinalAverageWithSupplementary(periodAverages, supplementaryAverage) {
  if (!periodAverages || periodAverages.length === 0) {
    return {
      promedioFinal: 0,
      periodAveragesAdjusted: [],
      periodsReplaced: [],
    };
  }

  // Crear copia del array de promedios
  const adjustedAverages = periodAverages.map((pa, index) => ({ ...pa, originalIndex: index }));

  // Identificar períodos que están por debajo del mínimo
  const periodsBelowMinimum = adjustedAverages.filter(pa => pa.promedio < pa.calificacionMinima);

  // Ordenar por promedio más bajo primero
  const sortedPeriodsToReplace = [...periodsBelowMinimum].sort((a, b) => a.promedio - b.promedio);

  // Reemplazar períodos más bajos con supletorio
  const periodsReplaced = [];
  sortedPeriodsToReplace.forEach(period => {
    const originalPromedio = period.promedio;
    adjustedAverages[period.originalIndex] = {
      ...period,
      promedio: supplementaryAverage,
      promedioPonderado: truncate(supplementaryAverage * (period.ponderacion / 100)),
      reemplazadoPorSupletorio: true,
      promedioOriginal: originalPromedio,
    };
    periodsReplaced.push({
      periodoId: period.periodoId,
      periodoNombre: period.periodoNombre,
      promedioOriginal: originalPromedio,
      promedioSupletorio: supplementaryAverage,
    });
  });

  // Calcular promedio final con los períodos ajustados
  const promedioFinal = calculateFinalAverage(adjustedAverages.map(pa => ({
    promedio: pa.promedio,
    ponderacion: pa.ponderacion,
  })));

  return {
    promedioFinal,
    periodAveragesAdjusted: adjustedAverages,
    periodsReplaced,
  };
}

/**
 * ============================================================================
 * FUNCIONES CENTRALIZADAS PARA CÁLCULO ESTANDARIZADO DE PROMEDIOS
 * ============================================================================
 * 
 * Estas funciones implementan la fórmula estándar de cálculo de promedios
 * que debe usarse en TODOS los reportes, boletines y consultas del sistema.
 * 
 * FÓRMULA ESTÁNDAR:
 * 1. Promedio Subperíodo = truncate(sum(calificaciones) / count(calificaciones))
 * 2. Promedio Ponderado Subperíodo = truncate(PromedioSubperíodo * (ponderación_sub / 100))
 * 3. Promedio Período = truncate((sum(PromediosPonderadosSubperiodos) / sum(ponderaciones_sub / 100)))
 * 4. Promedio Ponderado Período = truncate(PromedioPeriodo * (ponderación_periodo / 100))
 * 5. Promedio General = truncate(sum(PromediosPonderadosPeriodos))
 */

/**
 * Calcula el promedio de calificaciones para un subperíodo específico
 * @param {Array} calificaciones - Array de números (calificaciones)
 * @returns {number} - Promedio truncado a 2 decimales
 */
export function calculateSubPeriodAverage(calificaciones) {
  if (!calificaciones || calificaciones.length === 0) {
    return 0;
  }
  
  const sum = calificaciones.reduce((acc, cal) => acc + cal, 0);
  const average = sum / calificaciones.length;
  return truncate(average);
}

/**
 * Calcula el promedio ponderado de un período basándose en sus subperíodos
 * IMPORTANTE: Esta función NO debe truncar el promedio ponderado internamente
 * para evitar pérdida de precisión en cálculos intermedios
 * @param {Object} subPeriodAverages - Objeto { subPeriodoId: { promedio, ponderacion } }
 * @param {number} periodoPonderacion - Ponderación del período (default 100)
 * @returns {Object} - { promedio: number, promedioPonderado: number }
 */
export function calculatePeriodAverageFromSubPeriods(subPeriodAverages, periodoPonderacion = 100) {
  if (!subPeriodAverages || Object.keys(subPeriodAverages).length === 0) {
    return {
      promedio: 0,
      promedioPonderado: 0,
    };
  }
  
  let sumaPonderada = 0;
  let sumaPonderacion = 0;
  
  Object.values(subPeriodAverages).forEach(({ promedio, ponderacion }) => {
    sumaPonderada += promedio * (ponderacion / 100);
    sumaPonderacion += ponderacion / 100;
  });
  
  const promedioPeriodo = sumaPonderacion > 0 ? sumaPonderada / sumaPonderacion : 0;
  const promedioPeriodoTruncado = truncate(promedioPeriodo);
  // NO truncar el promedioPonderado aquí para evitar doble truncamiento
  // El truncamiento final se hace en calculateGeneralAverageFromPeriods
  const promedioPonderado = promedioPeriodoTruncado * (periodoPonderacion / 100);
  
  return {
    promedio: promedioPeriodoTruncado,
    promedioPonderado: promedioPonderado, // Sin truncate aquí
  };
}

/**
 * Calcula el promedio general sumando promedios ponderados de períodos
 * @param {Array} promediosPonderadosPeriodos - Array de números (promedios ponderados)
 * @returns {number} - Promedio general truncado
 */
export function calculateGeneralAverageFromPeriods(promediosPonderadosPeriodos) {
  if (!promediosPonderadosPeriodos || promediosPonderadosPeriodos.length === 0) {
    return 0;
  }
  
  const suma = promediosPonderadosPeriodos.reduce((acc, promedio) => acc + promedio, 0);
  return truncate(suma);
}

/**
 * Función completa que calcula promedios por subperíodo, período y general para una materia
 * Esta es la función principal que debe usarse en reportes y boletines
 * 
 * @param {Array} materiaGrades - Array de calificaciones de una materia
 * @returns {Object} - {
 *   promediosSubPeriodo: { [subPeriodoId]: { promedio, promedioPonderado, ponderacion, subPeriodoNombre } },
 *   promediosPeriodo: { [periodoId]: { promedio, promedioPonderado, ponderacion, periodoNombre } },
 *   promedioGeneral: number
 * }
 */
export function calculateAveragesByMateria(materiaGrades) {
  if (!materiaGrades || materiaGrades.length === 0) {
    return {
      promediosSubPeriodo: {},
      promediosPeriodo: {},
      promedioGeneral: null,
    };
  }
  
  // PASO 1: Agrupar calificaciones por subperíodo
  const gradesBySubPeriod = {};
  materiaGrades.forEach(grade => {
    const subPeriodo = grade.subPeriodo || grade.insumo?.subPeriodo;
    if (subPeriodo) {
      const subPeriodoId = subPeriodo.id;
      if (!gradesBySubPeriod[subPeriodoId]) {
        gradesBySubPeriod[subPeriodoId] = {
          subPeriodo: subPeriodo,
          calificaciones: [],
        };
      }
      gradesBySubPeriod[subPeriodoId].calificaciones.push(grade.calificacion);
    }
  });
  
  // PASO 2: Calcular promedios por subperíodo
  const promediosSubPeriodo = {};
  Object.keys(gradesBySubPeriod).forEach(subPeriodoId => {
    const data = gradesBySubPeriod[subPeriodoId];
    if (data.calificaciones.length > 0) {
      const promedio = calculateSubPeriodAverage(data.calificaciones);
      const ponderacion = data.subPeriodo.ponderacion || 0;
      // NO truncar promedioPonderado aquí para evitar acumulación de errores
      const promedioPonderado = promedio * (ponderacion / 100);
      
      promediosSubPeriodo[subPeriodoId] = {
        subPeriodoNombre: data.subPeriodo.nombre,
        promedio: promedio,
        promedioPonderado: promedioPonderado, // Sin truncate
        ponderacion: ponderacion,
      };
    }
  });
  
  // PASO 3: Agrupar por período y calcular promedios por período
  const gradesByPeriod = {};
  Object.keys(gradesBySubPeriod).forEach(subPeriodoId => {
    const data = gradesBySubPeriod[subPeriodoId];
    const periodoId = data.subPeriodo.periodo?.id;
    if (periodoId) {
      if (!gradesByPeriod[periodoId]) {
        gradesByPeriod[periodoId] = {
          periodo: data.subPeriodo.periodo,
          subPeriodos: [],
        };
      }
      gradesByPeriod[periodoId].subPeriodos.push({
        subPeriodoId,
        promedio: promediosSubPeriodo[subPeriodoId]?.promedio || 0,
        ponderacion: data.subPeriodo.ponderacion || 0,
      });
    }
  });
  
  // PASO 4: Calcular promedios por período
  const promediosPeriodo = {};
  Object.keys(gradesByPeriod).forEach(periodoId => {
    const data = gradesByPeriod[periodoId];
    
    // Construir objeto de promedios de subperíodos para este período
    const subPeriodAveragesForPeriod = {};
    data.subPeriodos.forEach(sub => {
      const subPromedio = promediosSubPeriodo[sub.subPeriodoId];
      if (subPromedio) {
        subPeriodAveragesForPeriod[sub.subPeriodoId] = {
          promedio: subPromedio.promedio,
          ponderacion: subPromedio.ponderacion,
        };
      }
    });
    
    const periodoPonderacion = data.periodo.ponderacion || 100;
    const { promedio, promedioPonderado } = calculatePeriodAverageFromSubPeriods(
      subPeriodAveragesForPeriod,
      periodoPonderacion
    );
    
    promediosPeriodo[periodoId] = {
      periodoNombre: data.periodo.nombre,
      promedio: promedio,
      promedioPonderado: promedioPonderado,
      ponderacion: periodoPonderacion,
    };
  });
  
  // PASO 5: Calcular promedio general
  const promediosPonderadosPeriodos = Object.values(promediosPeriodo).map(p => p.promedioPonderado);
  const promedioGeneral = calculateGeneralAverageFromPeriods(promediosPonderadosPeriodos);
  
  return {
    promediosSubPeriodo,
    promediosPeriodo,
    promedioGeneral: promediosPonderadosPeriodos.length > 0 ? promedioGeneral : null,
  };
}

