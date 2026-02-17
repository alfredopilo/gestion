/**
 * Tests unitarios para el servicio de configuración de redondeo
 * Resolución de precedencia período > institución y validación obligatoria
 */
import { describe, it, expect } from '@jest/globals';
import {
  getEffectiveGradeRoundingConfigFromEntities,
  validateGradeRoundingConfig,
  ERROR_MISSING_GRADE_ROUNDING_CONFIG,
} from '../src/services/gradeRoundingConfigService.js';

describe('getEffectiveGradeRoundingConfigFromEntities', () => {
  const institutionFull = {
    gradeRoundingSubPeriodMethod: 'TRUNCATE',
    gradeRoundingWeightedMethod: 'ROUND',
    gradeRoundingPeriodWeightedMethod: 'TRUNCATE',
    gradeDecimals: 2,
  };

  it('devuelve configuración de institución cuando period es null', () => {
    const result = getEffectiveGradeRoundingConfigFromEntities(institutionFull, null);
    expect(result.subPeriodMethod).toBe('TRUNCATE');
    expect(result.weightedMethod).toBe('ROUND');
    expect(result.periodWeightedMethod).toBe('TRUNCATE');
    expect(result.decimals).toBe(2);
  });

  it('prioridad período sobre institución cuando período tiene valores', () => {
    const period = {
      gradeRoundingSubPeriodMethod: 'ROUND',
      gradeRoundingWeightedMethod: 'TRUNCATE',
      gradeRoundingPeriodWeightedMethod: 'ROUND',
      gradeDecimals: 3,
    };
    const result = getEffectiveGradeRoundingConfigFromEntities(institutionFull, period);
    expect(result.subPeriodMethod).toBe('ROUND');
    expect(result.weightedMethod).toBe('TRUNCATE');
    expect(result.periodWeightedMethod).toBe('ROUND');
    expect(result.decimals).toBe(3);
  });

  it('usa institución para campos no definidos en período', () => {
    const period = {
      gradeRoundingSubPeriodMethod: 'ROUND',
      gradeRoundingWeightedMethod: null,
      gradeRoundingPeriodWeightedMethod: null,
      gradeDecimals: null,
    };
    const result = getEffectiveGradeRoundingConfigFromEntities(institutionFull, period);
    expect(result.subPeriodMethod).toBe('ROUND');
    expect(result.weightedMethod).toBe('ROUND');
    expect(result.periodWeightedMethod).toBe('TRUNCATE');
    expect(result.decimals).toBe(2);
  });

  it('lanza con ERROR_MISSING_GRADE_ROUNDING_CONFIG si falta método en institución', () => {
    const institutionIncomplete = {
      gradeRoundingSubPeriodMethod: 'TRUNCATE',
      gradeRoundingWeightedMethod: null,
      gradeRoundingPeriodWeightedMethod: null,
      gradeDecimals: 2,
    };
    expect(() => getEffectiveGradeRoundingConfigFromEntities(institutionIncomplete, null)).toThrow();
    try {
      getEffectiveGradeRoundingConfigFromEntities(institutionIncomplete, null);
    } catch (err) {
      expect(err.code).toBe(ERROR_MISSING_GRADE_ROUNDING_CONFIG);
      expect(err.missing).toBeDefined();
      expect(Array.isArray(err.missing)).toBe(true);
    }
  });

  it('lanza si institución es null y no hay período completo', () => {
    expect(() => getEffectiveGradeRoundingConfigFromEntities(null, null)).toThrow();
  });
});

describe('validateGradeRoundingConfig', () => {
  it('valid es true cuando todos los campos están presentes', () => {
    const config = {
      subPeriodMethod: 'TRUNCATE',
      weightedMethod: 'ROUND',
      periodWeightedMethod: 'TRUNCATE',
      decimals: 2,
    };
    const result = validateGradeRoundingConfig(config);
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('valid es false cuando falta subPeriodMethod', () => {
    const config = {
      weightedMethod: 'ROUND',
      periodWeightedMethod: 'TRUNCATE',
      decimals: 2,
    };
    const result = validateGradeRoundingConfig(config);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('subPeriodMethod');
  });

  it('valid es false cuando decimals no es número', () => {
    const config = {
      subPeriodMethod: 'TRUNCATE',
      weightedMethod: 'ROUND',
      periodWeightedMethod: 'TRUNCATE',
      decimals: null,
    };
    const result = validateGradeRoundingConfig(config);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('decimals');
  });
});
