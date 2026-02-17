/**
 * Aplica la estrategia de decimales: TRUNCATE (cortar sin redondear) o ROUND (redondeo matemático).
 * Truncar y redondear son distintos: ej. 4.996 con 2 decimales → TRUNCATE 4.99, ROUND 5.00.
 *
 * Usa un epsilon (1e-9) antes de Math.floor para compensar errores de representación
 * en punto flotante IEEE 754. Ej: 5.50 * 0.70 = 3.8499999999999996 en JS;
 * sin epsilon Math.floor(384.999...) = 384 (incorrecto), con epsilon = 385 (correcto).
 *
 * @param {number} value - Valor a aproximar
 * @param {number} decimals - Número de decimales
 * @param {'TRUNCATE'|'ROUND'} method - TRUNCATE = Math.floor; ROUND = Math.round
 * @returns {number}
 */
export function applyDecimalStrategy(value, decimals = 2, method = 'TRUNCATE') {
  if (value == null || isNaN(value)) return 0;
  const factor = Math.pow(10, decimals);
  const scaled = value * factor;
  const EPSILON = 1e-9;
  const rounded = method === 'ROUND' ? Math.round(scaled) : Math.floor(scaled + EPSILON);
  return rounded / factor;
}

/**
 * Truncar un número a N decimales (sin redondeo). Mantiene compatibilidad con código existente.
 */
export function truncate(number, decimals = 2) {
  return applyDecimalStrategy(number, decimals, 'TRUNCATE');
}

/**
 * Calcular promedio ponderado de calificaciones por subperíodo.
 * Acepta roundingConfig opcional para aplicar estrategia por tipo de promedio.
 */
export function calculateWeightedAverage(grades, roundingConfig) {
  if (!grades || grades.length === 0) {
    return {
      promedioSubPeriodo: 0,
      promedioPeriodo: 0,
      promedioFinal: 0,
      detalles: [],
    };
  }
  const gradesBySubPeriod = {};
  grades.forEach(grade => {
    if (grade.subPeriodo) {
      const subPeriodId = grade.subPeriodo.id;
      if (!gradesBySubPeriod[subPeriodId]) {
        gradesBySubPeriod[subPeriodId] = { subPeriodo: grade.subPeriodo, calificaciones: [] };
      }
      gradesBySubPeriod[subPeriodId].calificaciones.push(grade.calificacion);
    }
  });

  const subPeriodAverages = {};
  Object.keys(gradesBySubPeriod).forEach(subPeriodId => {
    const subPeriodData = gradesBySubPeriod[subPeriodId];
    subPeriodAverages[subPeriodId] = calculateSubPeriodAverage(subPeriodData.calificaciones, roundingConfig);
  });

  let sumaPonderada = 0;
  const detalles = [];
  const decimals = roundingConfig?.decimals ?? 2;
  const wM = roundingConfig?.weightedMethod ?? 'TRUNCATE';
  const pWM = roundingConfig?.periodWeightedMethod ?? 'TRUNCATE';

  // Sumar contribuciones ponderadas truncadas de cada subperíodo
  Object.keys(subPeriodAverages).forEach(subPeriodId => {
    const promedio = subPeriodAverages[subPeriodId];
    const ponderacion = gradesBySubPeriod[subPeriodId].subPeriodo.ponderacion;
    const contribucion = applyDecimalStrategy(promedio * (ponderacion / 100), decimals, wM);
    sumaPonderada += contribucion;
    detalles.push({
      subPeriodo: gradesBySubPeriod[subPeriodId].subPeriodo.nombre,
      promedio,
      ponderacion,
      contribucion,
    });
  });

  // Promedio del período = suma de contribuciones truncadas
  const promedioPeriodo = applyDecimalStrategy(sumaPonderada, decimals, wM);
  const periodo = grades[0]?.subPeriodo?.periodo;
  const promedioFinalRaw = periodo?.ponderacion ? promedioPeriodo * (periodo.ponderacion / 100) : promedioPeriodo;
  const promedioFinal = applyDecimalStrategy(promedioFinalRaw, decimals, pWM);

  return {
    promedioSubPeriodo: promedioPeriodo,
    promedioPeriodo,
    promedioFinal,
    detalles,
    aprobado: periodo ? promedioFinal >= (periodo.calificacionMinima || 7.0) : false,
  };
}

/**
 * Calcular promedio final considerando múltiples períodos.
 * @param {Array} periodAverages - Array de { periodoId, promedio, ponderacion }
 * @param {{ periodWeightedMethod: string, decimals: number }} [roundingConfig] - Config efectiva (opcional)
 * @returns {number} - Promedio final
 */
export function calculateFinalAverage(periodAverages, roundingConfig) {
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
  if (roundingConfig?.periodWeightedMethod != null && roundingConfig?.decimals != null) {
    return applyDecimalStrategy(promedioFinal, roundingConfig.decimals, roundingConfig.periodWeightedMethod);
  }
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
 * Calcular promedio final considerando supletorios. Acepta roundingConfig opcional.
 */
export function calculateFinalAverageWithSupplementary(periodAverages, supplementaryAverage, roundingConfig) {
  if (!periodAverages || periodAverages.length === 0) {
    return {
      promedioFinal: 0,
      periodAveragesAdjusted: [],
      periodsReplaced: [],
    };
  }
  const adjustedAverages = periodAverages.map((pa, index) => ({ ...pa, originalIndex: index }));
  const periodsBelowMinimum = adjustedAverages.filter(pa => pa.promedio < pa.calificacionMinima);
  const sortedPeriodsToReplace = [...periodsBelowMinimum].sort((a, b) => a.promedio - b.promedio);
  const decimals = roundingConfig?.decimals ?? 2;
  const pWM = roundingConfig?.periodWeightedMethod ?? 'TRUNCATE';

  const periodsReplaced = [];
  sortedPeriodsToReplace.forEach(period => {
    const originalPromedio = period.promedio;
    const promedioPonderado = roundingConfig
      ? applyDecimalStrategy(supplementaryAverage * (period.ponderacion / 100), decimals, pWM)
      : truncate(supplementaryAverage * (period.ponderacion / 100));
    adjustedAverages[period.originalIndex] = {
      ...period,
      promedio: supplementaryAverage,
      promedioPonderado,
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

  const promedioFinal = calculateFinalAverage(
    adjustedAverages.map(pa => ({ promedio: pa.promedio, ponderacion: pa.ponderacion })),
    roundingConfig
  );
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
 * Calcula el promedio de calificaciones para un subperíodo específico.
 * Si se pasa roundingConfig se usa la estrategia configurada (truncar/redondear); si no, se trunca a 2 decimales.
 * @param {Array} calificaciones - Array de números (calificaciones)
 * @param {{ subPeriodMethod: 'TRUNCATE'|'ROUND', decimals: number }} [roundingConfig] - Config efectiva (opcional)
 * @returns {number} - Promedio con decimales aplicados según configuración
 */
export function calculateSubPeriodAverage(calificaciones, roundingConfig) {
  if (!calificaciones || calificaciones.length === 0) {
    return 0;
  }
  const sum = calificaciones.reduce((acc, cal) => acc + cal, 0);
  const average = sum / calificaciones.length;
  if (roundingConfig?.subPeriodMethod != null && roundingConfig?.decimals != null) {
    return applyDecimalStrategy(average, roundingConfig.decimals, roundingConfig.subPeriodMethod);
  }
  return truncate(average);
}

/**
 * Calcula el promedio de un período sumando las contribuciones ponderadas ya truncadas de cada subperíodo.
 * Lógica: Prom. Período = Σ truncar(promedioSub_i × ponderacion_i / 100).
 * Luego: Prom. Pond. Período = truncar(Prom. Período × periodoPonderacion / 100).
 *
 * Cada contribución se trunca ANTES de sumar para coincidir con lo mostrado en "Prom. Pond. Sub".
 *
 * @param {Object} subPeriodAverages - Objeto { subPeriodoId: { promedio, ponderacion } }
 * @param {number} periodoPonderacion - Ponderación del período (default 100)
 * @param {{ weightedMethod: string, periodWeightedMethod: string, decimals: number }} [roundingConfig]
 * @returns {Object} - { promedio: number, promedioPonderado: number }
 */
export function calculatePeriodAverageFromSubPeriods(subPeriodAverages, periodoPonderacion = 100, roundingConfig) {
  if (!subPeriodAverages || Object.keys(subPeriodAverages).length === 0) {
    return {
      promedio: 0,
      promedioPonderado: 0,
    };
  }
  const decimals = roundingConfig?.decimals ?? 2;
  const wM = roundingConfig?.weightedMethod ?? 'TRUNCATE';
  const pWM = roundingConfig?.periodWeightedMethod ?? 'TRUNCATE';

  // Sumar las contribuciones ponderadas truncadas de cada subperíodo
  let sumaPonderada = 0;
  Object.values(subPeriodAverages).forEach(({ promedio, ponderacion }) => {
    const contribucionRaw = promedio * (ponderacion / 100);
    const contribucionTruncada = applyDecimalStrategy(contribucionRaw, decimals, wM);
    sumaPonderada += contribucionTruncada;
  });

  // El promedio del período es la suma directa de las contribuciones truncadas
  const promedioPeriodo = applyDecimalStrategy(sumaPonderada, decimals, wM);

  // Promedio ponderado del período: aplicar ponderación del período al promedio
  const promedioPonderadoRaw = promedioPeriodo * (periodoPonderacion / 100);
  const promedioPonderado = applyDecimalStrategy(promedioPonderadoRaw, decimals, pWM);

  return {
    promedio: promedioPeriodo,
    promedioPonderado,
  };
}

/**
 * Calcula el promedio general sumando promedios ponderados de períodos.
 * Si se pasa roundingConfig con periodWeightedMethod/decimals, aplica esa estrategia al resultado.
 * @param {Array} promediosPonderadosPeriodos - Array de números (promedios ponderados)
 * @param {{ periodWeightedMethod: string, decimals: number }} [roundingConfig] - Config efectiva (opcional)
 * @returns {number} - Promedio general con decimales según configuración
 */
export function calculateGeneralAverageFromPeriods(promediosPonderadosPeriodos, roundingConfig) {
  if (!promediosPonderadosPeriodos || promediosPonderadosPeriodos.length === 0) {
    return 0;
  }
  const suma = promediosPonderadosPeriodos.reduce((acc, promedio) => acc + promedio, 0);
  if (roundingConfig?.periodWeightedMethod != null && roundingConfig?.decimals != null) {
    return applyDecimalStrategy(suma, roundingConfig.decimals, roundingConfig.periodWeightedMethod);
  }
  return truncate(suma);
}

/**
 * Función completa que calcula promedios por subperíodo, período y general para una materia.
 * roundingConfigByPeriodId: objeto { [periodoId]: { subPeriodMethod, weightedMethod, periodWeightedMethod, decimals } }
 * para aplicar la estrategia por período. Si no se pasa o falta un período, se usa truncate por defecto.
 *
 * @param {Array} materiaGrades - Array de calificaciones de una materia
 * @param {Object} [roundingConfigByPeriodId] - Config efectiva por periodoId (opcional)
 * @returns {Object} - promediosSubPeriodo, promediosPeriodo, promedioGeneral
 */
export function calculateAveragesByMateria(materiaGrades, roundingConfigByPeriodId) {
  if (!materiaGrades || materiaGrades.length === 0) {
    return {
      promediosSubPeriodo: {},
      promediosPeriodo: {},
      promedioGeneral: null,
    };
  }
  const gradesBySubPeriod = {};
  materiaGrades.forEach(grade => {
    const subPeriodo = grade.subPeriodo || grade.insumo?.subPeriodo;
    if (subPeriodo) {
      const subPeriodoId = subPeriodo.id;
      if (!gradesBySubPeriod[subPeriodoId]) {
        gradesBySubPeriod[subPeriodoId] = { subPeriodo, calificaciones: [] };
      }
      gradesBySubPeriod[subPeriodoId].calificaciones.push(grade.calificacion);
    }
  });

  const promediosSubPeriodo = {};
  Object.keys(gradesBySubPeriod).forEach(subPeriodoId => {
    const data = gradesBySubPeriod[subPeriodoId];
    if (data.calificaciones.length > 0) {
      const periodoId = data.subPeriodo.periodo?.id;
      const roundingConfig = periodoId && roundingConfigByPeriodId?.[periodoId] ? roundingConfigByPeriodId[periodoId] : undefined;
      const promedio = calculateSubPeriodAverage(data.calificaciones, roundingConfig);
      const ponderacion = data.subPeriodo.ponderacion || 0;
      const promedioPonderadoRaw = promedio * (ponderacion / 100);
      const promedioPonderado = roundingConfig?.weightedMethod != null && roundingConfig?.decimals != null
        ? applyDecimalStrategy(promedioPonderadoRaw, roundingConfig.decimals, roundingConfig.weightedMethod)
        : promedioPonderadoRaw;
      promediosSubPeriodo[subPeriodoId] = {
        subPeriodoNombre: data.subPeriodo.nombre,
        promedio,
        promedioPonderado,
        ponderacion,
      };
    }
  });

  const gradesByPeriod = {};
  Object.keys(gradesBySubPeriod).forEach(subPeriodoId => {
    const data = gradesBySubPeriod[subPeriodoId];
    const periodoId = data.subPeriodo.periodo?.id;
    if (periodoId) {
      if (!gradesByPeriod[periodoId]) {
        gradesByPeriod[periodoId] = { periodo: data.subPeriodo.periodo, subPeriodos: [] };
      }
      gradesByPeriod[periodoId].subPeriodos.push({
        subPeriodoId,
        promedio: promediosSubPeriodo[subPeriodoId]?.promedio || 0,
        ponderacion: data.subPeriodo.ponderacion || 0,
      });
    }
  });

  const promediosPeriodo = {};
  let firstConfig = null;
  Object.keys(gradesByPeriod).forEach(periodoId => {
    const data = gradesByPeriod[periodoId];
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
    const roundingConfig = roundingConfigByPeriodId?.[periodoId];
    if (roundingConfig && !firstConfig) firstConfig = roundingConfig;
    const { promedio, promedioPonderado } = calculatePeriodAverageFromSubPeriods(
      subPeriodAveragesForPeriod,
      periodoPonderacion,
      roundingConfig
    );
    promediosPeriodo[periodoId] = {
      periodoNombre: data.periodo.nombre,
      promedio,
      promedioPonderado,
      ponderacion: periodoPonderacion,
    };
  });

  const promediosPonderadosPeriodos = Object.values(promediosPeriodo).map(p => p.promedioPonderado);
  const promedioGeneral = calculateGeneralAverageFromPeriods(promediosPonderadosPeriodos, firstConfig ?? undefined);
  return {
    promediosSubPeriodo,
    promediosPeriodo,
    promedioGeneral: promediosPonderadosPeriodos.length > 0 ? promedioGeneral : null,
  };
}

