/**
 * Tests unitarios para applyDecimalStrategy, truncate y diferencias truncar vs redondear
 */
import { describe, it, expect } from '@jest/globals';
import {
  applyDecimalStrategy,
  truncate,
  calculateSubPeriodAverage,
  calculatePeriodAverageFromSubPeriods,
  calculateGeneralAverageFromPeriods,
} from '../src/utils/gradeCalculations.js';

describe('applyDecimalStrategy', () => {
  it('trunca a 2 decimales: 4.996 → 4.99', () => {
    expect(applyDecimalStrategy(4.996, 2, 'TRUNCATE')).toBe(4.99);
  });

  it('redondea a 2 decimales: 4.996 → 5.00', () => {
    expect(applyDecimalStrategy(4.996, 2, 'ROUND')).toBe(5);
  });

  it('trunca 4.999 a 4.99', () => {
    expect(applyDecimalStrategy(4.999, 2, 'TRUNCATE')).toBe(4.99);
  });

  it('redondea 4.999 a 5.00', () => {
    expect(applyDecimalStrategy(4.999, 2, 'ROUND')).toBe(5);
  });

  it('trunca 4.995 a 4.99 (sin redondear al entero)', () => {
    expect(applyDecimalStrategy(4.995, 2, 'TRUNCATE')).toBe(4.99);
  });

  it('redondea 4.995 a 5.00', () => {
    expect(applyDecimalStrategy(4.995, 2, 'ROUND')).toBe(5);
  });

  it('trunca con 3 decimales: 1.2345 → 1.234', () => {
    expect(applyDecimalStrategy(1.2345, 3, 'TRUNCATE')).toBe(1.234);
  });

  it('ROUND con 1 decimal: 7.36 → 7.4', () => {
    expect(applyDecimalStrategy(7.36, 1, 'ROUND')).toBe(7.4);
  });

  it('devuelve 0 para null/NaN', () => {
    expect(applyDecimalStrategy(null, 2, 'TRUNCATE')).toBe(0);
    expect(applyDecimalStrategy(NaN, 2, 'ROUND')).toBe(0);
  });
});

describe('applyDecimalStrategy - precisión punto flotante (IEEE 754)', () => {
  it('TRUNCATE 5.50 * 0.70 = 3.85, no 3.84 (caso BERMELLO)', () => {
    const val = 5.50 * 0.70;
    expect(applyDecimalStrategy(val, 2, 'TRUNCATE')).toBe(3.85);
  });

  it('TRUNCATE (6.18 + 3.60) / 2 = 4.89, no 4.88 (caso QUIJIJE)', () => {
    const val = (6.18 + 3.60) / 2;
    expect(applyDecimalStrategy(val, 2, 'TRUNCATE')).toBe(4.89);
  });

  it('TRUNCATE 6.00 * 0.70 = 4.20, no 4.19 (caso MEDINA)', () => {
    const val = 6.00 * 0.70;
    expect(applyDecimalStrategy(val, 2, 'TRUNCATE')).toBe(4.2);
  });

  it('TRUNCATE 4.89 * 0.70 = 3.42, no 3.41 (caso QUIJIJE pond.)', () => {
    const val = 4.89 * 0.70;
    expect(applyDecimalStrategy(val, 2, 'TRUNCATE')).toBe(3.42);
  });

  it('TRUNCATE 4.886 sigue dando 4.88 (no redondea por error)', () => {
    expect(applyDecimalStrategy(4.886, 2, 'TRUNCATE')).toBe(4.88);
  });

  it('TRUNCATE 3.849 sigue dando 3.84', () => {
    expect(applyDecimalStrategy(3.849, 2, 'TRUNCATE')).toBe(3.84);
  });

  it('TRUNCATE 4.199 sigue dando 4.19', () => {
    expect(applyDecimalStrategy(4.199, 2, 'TRUNCATE')).toBe(4.19);
  });
});

describe('truncate', () => {
  it('comportamiento idéntico a TRUNCATE con 2 decimales', () => {
    expect(truncate(4.996)).toBe(4.99);
    expect(truncate(7.889)).toBe(7.88);
  });

  it('acepta decimales custom', () => {
    expect(truncate(1.2345, 3)).toBe(1.234);
  });
});

describe('calculateSubPeriodAverage con roundingConfig', () => {
  it('sin config usa truncate por defecto', () => {
    expect(calculateSubPeriodAverage([7, 8, 9])).toBe(8);
    expect(calculateSubPeriodAverage([7.5, 8.5])).toBe(8); // 8.0 truncado
  });

  it('con config ROUND redondea el promedio', () => {
    const cfg = { subPeriodMethod: 'ROUND', decimals: 2 };
    expect(calculateSubPeriodAverage([7.33, 7.33, 7.34], cfg)).toBe(7.33); // 7.333... → 7.33
    expect(calculateSubPeriodAverage([7.335, 7.335], cfg)).toBe(7.34); // 7.335 → 7.34
  });

  it('con config TRUNCATE trunca el promedio', () => {
    const cfg = { subPeriodMethod: 'TRUNCATE', decimals: 2 };
    expect(calculateSubPeriodAverage([7.335, 7.335], cfg)).toBe(7.33);
  });

  it('array vacío retorna 0', () => {
    expect(calculateSubPeriodAverage([])).toBe(0);
    expect(calculateSubPeriodAverage([], { subPeriodMethod: 'ROUND', decimals: 2 })).toBe(0);
  });
});

describe('calculatePeriodAverageFromSubPeriods', () => {
  // Caso real: promedio del período = suma de contribuciones truncadas
  it('promedio del período = suma de Prom. Pond. Sub truncados (caso ANCHUNDIA)', () => {
    const cfg = {
      weightedMethod: 'TRUNCATE',
      periodWeightedMethod: 'TRUNCATE',
      decimals: 2,
    };
    // Tareas: truncate(6.02*0.7) = 4.21
    // Proyecto: truncate(8.34*0.2) = 1.66
    // Examen: truncate(8.6*0.1) = 0.86
    // Suma = 4.21 + 1.66 + 0.86 = 6.73 (coincide con Excel)
    const subPeriodAverages = {
      sp1: { promedio: 6.02, ponderacion: 70 },
      sp2: { promedio: 8.34, ponderacion: 20 },
      sp3: { promedio: 8.6,  ponderacion: 10 },
    };
    const result = calculatePeriodAverageFromSubPeriods(subPeriodAverages, 100, cfg);
    expect(result.promedio).toBe(6.73);
  });

  it('aplica ponderación del período al promedio', () => {
    const cfg = {
      weightedMethod: 'TRUNCATE',
      periodWeightedMethod: 'TRUNCATE',
      decimals: 2,
    };
    const subPeriodAverages = {
      sp1: { promedio: 6.02, ponderacion: 70 },
      sp2: { promedio: 8.34, ponderacion: 20 },
      sp3: { promedio: 8.6,  ponderacion: 10 },
    };
    // promedio = 6.73, ponderación período = 33.33%
    // promedioPonderado = truncate(6.73 * 0.3333) = truncate(2.243...) = 2.24
    const result = calculatePeriodAverageFromSubPeriods(subPeriodAverages, 33.33, cfg);
    expect(result.promedio).toBe(6.73);
    expect(result.promedioPonderado).toBe(2.24);
  });

  it('sin config usa TRUNCATE por defecto', () => {
    const subPeriodAverages = {
      sp1: { promedio: 8, ponderacion: 50 },
      sp2: { promedio: 7, ponderacion: 50 },
    };
    // truncate(8*0.5) + truncate(7*0.5) = 4 + 3.5 = 7.5
    const result = calculatePeriodAverageFromSubPeriods(subPeriodAverages, 100);
    expect(result.promedio).toBe(7.5);
    expect(result.promedioPonderado).toBe(7.5);
  });

  it('subPeriodAverages vacío retorna ceros', () => {
    const result = calculatePeriodAverageFromSubPeriods({}, 100);
    expect(result.promedio).toBe(0);
    expect(result.promedioPonderado).toBe(0);
  });

  // Verifica que truncar antes de sumar evita la diferencia de 0.01
  it('no da 0.01 de más vs Excel al sumar contribuciones sin truncar', () => {
    const cfg = {
      weightedMethod: 'TRUNCATE',
      periodWeightedMethod: 'TRUNCATE',
      decimals: 2,
    };
    // Sin truncar: 8.666*0.5 + 7.333*0.5 = 4.333 + 3.6665 = 7.9995 → truncate = 7.99
    // Con truncar: truncate(4.333)=4.33, truncate(3.6665)=3.66, sum=7.99 → ok mismo resultado aquí
    // Pero: 6.02*0.7 = 4.214, sin truncar suma da 4.214+..., con truncar da 4.21+...
    const subPeriodAverages = {
      sp1: { promedio: 6.02, ponderacion: 70 },  // 4.214 sin truncar, 4.21 truncado
      sp2: { promedio: 8.34, ponderacion: 20 },  // 1.668 sin truncar, 1.66 truncado
      sp3: { promedio: 8.6,  ponderacion: 10 },  // 0.86 ambos
    };
    // Sin truncar antes: 4.214+1.668+0.86=6.742 → truncate→6.74 (incorrecto)
    // Con truncar antes: 4.21+1.66+0.86=6.73 → truncate→6.73 (correcto)
    const result = calculatePeriodAverageFromSubPeriods(subPeriodAverages, 100, cfg);
    expect(result.promedio).toBe(6.73); // no 6.74
  });
});

describe('calculateGeneralAverageFromPeriods con roundingConfig', () => {
  it('sin config trunca la suma', () => {
    expect(calculateGeneralAverageFromPeriods([7.5, 8.5])).toBe(16); // 16.0
  });

  it('con config ROUND redondea la suma', () => {
    const cfg = { periodWeightedMethod: 'ROUND', decimals: 2 };
    expect(calculateGeneralAverageFromPeriods([7.505, 8.505], cfg)).toBe(16.01);
  });
});
