/**
 * Tests unitarios para exportación e importación de periodos académicos
 */
import { describe, it, expect } from '@jest/globals';
import { importPeriodSchema, importPeriodsConfigSchema } from '../src/utils/validators.js';

describe('importPeriodSchema - validación del schema de importación', () => {
  it('acepta estructura válida con periodo y subperíodos', () => {
    const validData = {
      version: '1.0',
      exportDate: '2026-02-14T12:00:00.000Z',
      period: {
        nombre: 'Primer Trimestre',
        fechaInicio: '2025-03-31T05:00:00.000Z',
        fechaFin: '2026-01-02T04:59:59.999Z',
        calificacionMinima: 7.0,
        ponderacion: 33.33,
        activo: true,
        esSupletorio: false,
        orden: 1,
        anioEscolar: '2025-2026',
      },
      subPeriods: [
        { nombre: 'Tareas', ponderacion: 70, orden: 1, fechaInicio: null, fechaFin: null },
        { nombre: 'Examen', ponderacion: 30, orden: 2 },
      ],
    };
    const result = importPeriodSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe('1.0');
      expect(result.data.period.nombre).toBe('Primer Trimestre');
      expect(result.data.subPeriods).toHaveLength(2);
    }
  });

  it('acepta periodo sin subperíodos (array vacío por defecto)', () => {
    const validData = {
      version: '1.0',
      period: {
        nombre: 'Supletorio',
        fechaInicio: '2026-01-19T05:00:00.000Z',
        fechaFin: '2026-01-30T04:59:59.999Z',
        calificacionMinima: 8,
        activo: false,
        esSupletorio: true,
      },
    };
    const result = importPeriodSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subPeriods).toEqual([]);
    }
  });

  it('acepta subperíodos con fechas opcionales nulas', () => {
    const validData = {
      version: '1.0',
      period: {
        nombre: 'Test',
        fechaInicio: '2025-01-01T00:00:00.000Z',
        fechaFin: '2025-06-30T23:59:59.999Z',
        calificacionMinima: 7,
        activo: true,
        esSupletorio: false,
      },
      subPeriods: [
        { nombre: 'Parcial 1', ponderacion: 50, orden: 1, fechaInicio: null, fechaFin: null },
      ],
    };
    const result = importPeriodSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('rechaza cuando version no cumple formato x.y', () => {
    const invalidData = {
      version: 'invalid',
      period: {
        nombre: 'Test',
        fechaInicio: '2025-01-01T00:00:00.000Z',
        fechaFin: '2025-06-30T23:59:59.999Z',
        calificacionMinima: 7,
        activo: true,
        esSupletorio: false,
      },
    };
    const result = importPeriodSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('rechaza cuando falta el objeto period', () => {
    const invalidData = {
      version: '1.0',
      subPeriods: [],
    };
    const result = importPeriodSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('rechaza cuando nombre del periodo tiene menos de 2 caracteres', () => {
    const invalidData = {
      version: '1.0',
      period: {
        nombre: 'A',
        fechaInicio: '2025-01-01T00:00:00.000Z',
        fechaFin: '2025-06-30T23:59:59.999Z',
        calificacionMinima: 7,
        activo: true,
        esSupletorio: false,
      },
    };
    const result = importPeriodSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('rechaza cuando calificacionMinima está fuera de rango', () => {
    const invalidData = {
      version: '1.0',
      period: {
        nombre: 'Test',
        fechaInicio: '2025-01-01T00:00:00.000Z',
        fechaFin: '2025-06-30T23:59:59.999Z',
        calificacionMinima: 15,
        activo: true,
        esSupletorio: false,
      },
    };
    const result = importPeriodSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('rechaza cuando ponderación del subperíodo es negativa', () => {
    const invalidData = {
      version: '1.0',
      period: {
        nombre: 'Test',
        fechaInicio: '2025-01-01T00:00:00.000Z',
        fechaFin: '2025-06-30T23:59:59.999Z',
        calificacionMinima: 7,
        activo: true,
        esSupletorio: false,
      },
      subPeriods: [
        { nombre: 'Parcial', ponderacion: -10, orden: 1 },
      ],
    };
    const result = importPeriodSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('acepta version 2.0 (formato numérico)', () => {
    const validData = {
      version: '2.0',
      period: {
        nombre: 'Periodo Test',
        fechaInicio: '2025-01-01T00:00:00.000Z',
        fechaFin: '2025-06-30T23:59:59.999Z',
        calificacionMinima: 7,
        activo: true,
        esSupletorio: false,
      },
    };
    const result = importPeriodSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });
});

describe('importPeriodsConfigSchema - formato múltiple (exportación completa)', () => {
  it('acepta estructura con array de periodos', () => {
    const validData = {
      version: '1.0',
      exportDate: '2026-02-14T12:00:00.000Z',
      periods: [
        {
          period: {
            nombre: 'Primer Trimestre',
            fechaInicio: '2025-03-31T05:00:00.000Z',
            fechaFin: '2026-01-02T04:59:59.999Z',
            calificacionMinima: 7,
            ponderacion: 33.33,
            activo: true,
            esSupletorio: false,
            orden: 1,
            anioEscolar: '2025-2026',
          },
          subPeriods: [
            { nombre: 'Tareas', ponderacion: 70, orden: 1 },
            { nombre: 'Examen', ponderacion: 30, orden: 2 },
          ],
        },
      ],
    };
    const result = importPeriodsConfigSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.periods).toHaveLength(1);
      expect(result.data.periods[0].period.nombre).toBe('Primer Trimestre');
      expect(result.data.periods[0].subPeriods).toHaveLength(2);
    }
  });

  it('acepta múltiples periodos en el array', () => {
    const validData = {
      version: '1.0',
      periods: [
        {
          period: {
            nombre: 'Primer Trimestre',
            fechaInicio: '2025-01-01T00:00:00.000Z',
            fechaFin: '2025-04-30T23:59:59.999Z',
            calificacionMinima: 7,
            activo: true,
            esSupletorio: false,
          },
          subPeriods: [],
        },
        {
          period: {
            nombre: 'Segundo Trimestre',
            fechaInicio: '2025-05-01T00:00:00.000Z',
            fechaFin: '2025-08-31T23:59:59.999Z',
            calificacionMinima: 7,
            activo: false,
            esSupletorio: false,
          },
          subPeriods: [],
        },
      ],
    };
    const result = importPeriodsConfigSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.periods).toHaveLength(2);
    }
  });
});

describe('Estructura de exportación - lógica de datos', () => {
  it('la estructura exportada no debe incluir IDs internos', () => {
    const periodMock = {
      id: 'uuid-period-123',
      nombre: 'Primer Trimestre',
      fechaInicio: new Date('2025-03-31'),
      fechaFin: new Date('2026-01-02'),
      calificacionMinima: 7,
      ponderacion: 33.33,
      activo: true,
      esSupletorio: false,
      orden: 1,
      anioEscolar: '2025-2026',
      subPeriodos: [
        { id: 'uuid-sp-1', nombre: 'Tareas', ponderacion: 70, orden: 1, fechaInicio: null, fechaFin: null },
      ],
    };

    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      period: {
        nombre: periodMock.nombre,
        fechaInicio: periodMock.fechaInicio,
        fechaFin: periodMock.fechaFin,
        calificacionMinima: periodMock.calificacionMinima ?? 7.0,
        ponderacion: periodMock.ponderacion ?? 50.0,
        activo: periodMock.activo,
        esSupletorio: periodMock.esSupletorio ?? false,
        orden: periodMock.orden ?? 1,
        anioEscolar: periodMock.anioEscolar,
      },
      subPeriods: (periodMock.subPeriodos || []).map((sp) => ({
        nombre: sp.nombre,
        ponderacion: sp.ponderacion,
        orden: sp.orden ?? 1,
        fechaInicio: sp.fechaInicio ?? null,
        fechaFin: sp.fechaFin ?? null,
      })),
    };

    expect(exportData.period).not.toHaveProperty('id');
    expect(exportData.subPeriods[0]).not.toHaveProperty('id');
    expect(exportData).toHaveProperty('version', '1.0');
    expect(exportData).toHaveProperty('period');
    expect(exportData).toHaveProperty('subPeriods');
    expect(exportData.subPeriods).toHaveLength(1);
    expect(exportData.subPeriods[0].nombre).toBe('Tareas');
  });

  it('periodo sin subperíodos exporta array vacío', () => {
    const periodMock = {
      nombre: 'Supletorio',
      subPeriodos: [],
    };

    const subPeriods = (periodMock.subPeriodos || []).map((sp) => ({
      nombre: sp.nombre,
      ponderacion: sp.ponderacion,
      orden: sp.orden ?? 1,
      fechaInicio: sp.fechaInicio ?? null,
      fechaFin: sp.fechaFin ?? null,
    }));

    expect(subPeriods).toEqual([]);
  });
});

describe('Validación de suma de ponderaciones - lógica de importación', () => {
  it('suma de ponderaciones válida (100%)', () => {
    const subPeriods = [
      { ponderacion: 70 },
      { ponderacion: 30 },
    ];
    const suma = subPeriods.reduce((s, sp) => s + sp.ponderacion, 0);
    expect(suma).toBe(100);
  });

  it('suma de ponderaciones inválida (>100%)', () => {
    const subPeriods = [
      { ponderacion: 70 },
      { ponderacion: 50 },
    ];
    const suma = subPeriods.reduce((s, sp) => s + sp.ponderacion, 0);
    expect(suma).toBeGreaterThan(100);
  });

  it('suma con tolerancia por redondeo', () => {
    const subPeriods = [
      { ponderacion: 33.33 },
      { ponderacion: 33.33 },
      { ponderacion: 33.34 },
    ];
    const suma = subPeriods.reduce((s, sp) => s + sp.ponderacion, 0);
    expect(suma).toBeLessThanOrEqual(100.01);
  });
});

describe('Conversión de fechas en importación', () => {
  it('convierte string ISO a Date correctamente', () => {
    const fechaStr = '2025-03-31T05:00:00.000Z';
    const fecha = new Date(fechaStr);
    expect(fecha).toBeInstanceOf(Date);
    expect(fecha.getFullYear()).toBe(2025);
    expect(fecha.getMonth()).toBe(2);
  });

  it('maneja null para fechas opcionales de subperíodos', () => {
    const sp = { fechaInicio: null, fechaFin: null };
    const fechaInicio = sp.fechaInicio && sp.fechaInicio !== null
      ? (typeof sp.fechaInicio === 'string' ? new Date(sp.fechaInicio) : sp.fechaInicio)
      : null;
    const fechaFin = sp.fechaFin && sp.fechaFin !== null
      ? (typeof sp.fechaFin === 'string' ? new Date(sp.fechaFin) : sp.fechaFin)
      : null;
    expect(fechaInicio).toBeNull();
    expect(fechaFin).toBeNull();
  });
});
