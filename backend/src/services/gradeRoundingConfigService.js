/**
 * Servicio de dominio: resuelve la configuración efectiva de redondeo/truncamiento
 * para promedios (subperíodo, ponderado, ponderado del período).
 * Prioridad: configuración del período académico > configuración de la institución.
 * Si falta alguna configuración efectiva, se lanza error (configuración obligatoria).
 */

import prisma from '../config/database.js';

/** Código de error cuando falta configuración de redondeo (obligatoria para reportes) */
export const ERROR_MISSING_GRADE_ROUNDING_CONFIG = 'MISSING_GRADE_ROUNDING_CONFIG';

/** Claves de los tres tipos de promedio que deben estar configurados */
export const GRADE_ROUNDING_KEYS = {
  SUB_PERIOD: 'subPeriodMethod',
  WEIGHTED: 'weightedMethod',
  PERIOD_WEIGHTED: 'periodWeightedMethod',
};

/**
 * Resuelve la configuración efectiva: por cada campo usa el valor del período si está definido,
 * si no el de la institución. Si algún método o decimales queda sin definir, lanza.
 * @param {Object} options
 * @param {string} options.institutionId - ID de la institución
 * @param {string|null} [options.periodId] - ID del período (opcional); si no se pasa, solo se usa institución
 * @returns {Promise<{ subPeriodMethod: 'TRUNCATE'|'ROUND', weightedMethod: 'TRUNCATE'|'ROUND', periodWeightedMethod: 'TRUNCATE'|'ROUND', decimals: number }>}
 * @throws {Error} Con code === ERROR_MISSING_GRADE_ROUNDING_CONFIG y message descriptivo
 */
export async function getEffectiveGradeRoundingConfig({ institutionId, periodId }) {
  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
    select: {
      gradeRoundingSubPeriodMethod: true,
      gradeRoundingWeightedMethod: true,
      gradeRoundingPeriodWeightedMethod: true,
      gradeDecimals: true,
    },
  });

  if (!institution) {
    const err = new Error(`Institución no encontrada: ${institutionId}`);
    err.code = 'INSTITUTION_NOT_FOUND';
    throw err;
  }

  let period = null;
  if (periodId) {
    period = await prisma.period.findUnique({
      where: { id: periodId },
      select: {
        gradeRoundingSubPeriodMethod: true,
        gradeRoundingWeightedMethod: true,
        gradeRoundingPeriodWeightedMethod: true,
        gradeDecimals: true,
      },
    });
    if (!period) {
      const err = new Error(`Período no encontrado: ${periodId}`);
      err.code = 'PERIOD_NOT_FOUND';
      throw err;
    }
  }

  // Precedencia: período > institución por campo
  const subPeriodMethod = period?.gradeRoundingSubPeriodMethod ?? institution.gradeRoundingSubPeriodMethod;
  const weightedMethod = period?.gradeRoundingWeightedMethod ?? institution.gradeRoundingWeightedMethod;
  const periodWeightedMethod = period?.gradeRoundingPeriodWeightedMethod ?? institution.gradeRoundingPeriodWeightedMethod;
  const decimals = period?.gradeDecimals ?? institution.gradeDecimals ?? 2;

  const missing = [];
  if (subPeriodMethod == null) missing.push('promedio de subperíodo (truncar/redondear)');
  if (weightedMethod == null) missing.push('promedio ponderado (truncar/redondear)');
  if (periodWeightedMethod == null) missing.push('promedio ponderado del período (truncar/redondear)');
  if (decimals == null || typeof decimals !== 'number') missing.push('número de decimales');

  if (missing.length > 0) {
    const err = new Error(
      `Configuración de promedios obligatoria. Falta definir: ${missing.join(', ')}. ` +
      'Configure en Institución o en el Período académico.'
    );
    err.code = ERROR_MISSING_GRADE_ROUNDING_CONFIG;
    err.missing = missing;
    throw err;
  }

  return {
    subPeriodMethod,
    weightedMethod,
    periodWeightedMethod,
    decimals: Number(decimals),
  };
}

/**
 * Resuelve la configuración efectiva a partir de entidades ya cargadas (sin BD).
 * Precedencia: período > institución. Útil cuando se tienen varios períodos en memoria.
 * @param {Object} institution - { gradeRoundingSubPeriodMethod, gradeRoundingWeightedMethod, gradeRoundingPeriodWeightedMethod, gradeDecimals }
 * @param {Object|null} period - Mismo shape; si es null solo se usa institución
 * @returns {{ subPeriodMethod, weightedMethod, periodWeightedMethod, decimals }}
 * @throws {Error} Si falta algún campo obligatorio
 */
export function getEffectiveGradeRoundingConfigFromEntities(institution, period = null) {
  const subPeriodMethod = period?.gradeRoundingSubPeriodMethod ?? institution?.gradeRoundingSubPeriodMethod;
  const weightedMethod = period?.gradeRoundingWeightedMethod ?? institution?.gradeRoundingWeightedMethod;
  const periodWeightedMethod = period?.gradeRoundingPeriodWeightedMethod ?? institution?.gradeRoundingPeriodWeightedMethod;
  const decimals = period?.gradeDecimals ?? institution?.gradeDecimals ?? 2;

  const missing = [];
  if (subPeriodMethod == null) missing.push('promedio de subperíodo (truncar/redondear)');
  if (weightedMethod == null) missing.push('promedio ponderado (truncar/redondear)');
  if (periodWeightedMethod == null) missing.push('promedio ponderado del período (truncar/redondear)');
  if (decimals == null || typeof decimals !== 'number') missing.push('número de decimales');

  if (missing.length > 0) {
    const err = new Error(
      `Configuración de promedios obligatoria. Falta definir: ${missing.join(', ')}. ` +
      'Configure en Institución o en el Período académico.'
    );
    err.code = ERROR_MISSING_GRADE_ROUNDING_CONFIG;
    err.missing = missing;
    throw err;
  }

  return {
    subPeriodMethod,
    weightedMethod,
    periodWeightedMethod,
    decimals: Number(decimals),
  };
}

/**
 * Valida que un objeto de configuración efectiva tenga los tres métodos y decimales.
 * Útil para tests o validación sin BD.
 * @param {Object} config
 * @returns {{ valid: boolean, missing: string[] }}
 */
export function validateGradeRoundingConfig(config) {
  const missing = [];
  if (!config?.subPeriodMethod) missing.push('subPeriodMethod');
  if (!config?.weightedMethod) missing.push('weightedMethod');
  if (!config?.periodWeightedMethod) missing.push('periodWeightedMethod');
  if (config?.decimals == null || typeof config.decimals !== 'number') missing.push('decimals');
  return {
    valid: missing.length === 0,
    missing,
  };
}
