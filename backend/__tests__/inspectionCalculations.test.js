/**
 * Tests unitarios para el módulo de inspección de asistencia:
 * agrupación de asistencia, cálculo de horas faltantes y clasificación de alertas.
 */
import { describe, it, expect } from '@jest/globals';
import {
  groupAttendanceByStudentAndDate,
  computeHorasFaltantes,
  isSinAsistenciaTodoElDia,
  hasHorasFaltantes,
} from '../src/utils/inspectionCalculations.js';

describe('groupAttendanceByStudentAndDate', () => {
  it('agrupa por estudiante y fecha y cuenta solo ASISTENCIA y TARDE', () => {
    const records = [
      { estudianteId: 'e1', fecha: new Date('2025-02-26'), estado: 'ASISTENCIA' },
      { estudianteId: 'e1', fecha: new Date('2025-02-26'), estado: 'TARDE' },
      { estudianteId: 'e1', fecha: new Date('2025-02-26'), estado: 'FALTA' },
      { estudianteId: 'e1', fecha: new Date('2025-02-27'), estado: 'ASISTENCIA' },
      { estudianteId: 'e2', fecha: new Date('2025-02-26'), estado: 'ASISTENCIA' },
    ];
    const map = groupAttendanceByStudentAndDate(records);
    expect(map.get('e1|2025-02-26')).toBe(2);
    expect(map.get('e1|2025-02-27')).toBe(1);
    expect(map.get('e2|2025-02-26')).toBe(1);
  });

  it('ignora FALTA y JUSTIFICADA', () => {
    const records = [
      { estudianteId: 'e1', fecha: new Date('2025-02-26'), estado: 'FALTA' },
      { estudianteId: 'e1', fecha: new Date('2025-02-26'), estado: 'JUSTIFICADA' },
    ];
    const map = groupAttendanceByStudentAndDate(records);
    expect(map.has('e1|2025-02-26')).toBe(false);
  });

  it('devuelve Map vacío para array vacío', () => {
    const map = groupAttendanceByStudentAndDate([]);
    expect(map.size).toBe(0);
  });
});

describe('computeHorasFaltantes', () => {
  it('calcula horas faltantes correctamente', () => {
    expect(computeHorasFaltantes(40, 35)).toEqual({ horasRegistradas: 35, horasFaltantes: 5 });
    expect(computeHorasFaltantes(40, 40)).toEqual({ horasRegistradas: 40, horasFaltantes: 0 });
    expect(computeHorasFaltantes(40, 0)).toEqual({ horasRegistradas: 0, horasFaltantes: 40 });
  });

  it('trata null/undefined horasRegistradas como 0', () => {
    expect(computeHorasFaltantes(40, null)).toEqual({ horasRegistradas: 0, horasFaltantes: 40 });
    expect(computeHorasFaltantes(40, undefined)).toEqual({ horasRegistradas: 0, horasFaltantes: 40 });
  });

  it('no devuelve horasFaltantes negativas si registradas > esperadas', () => {
    expect(computeHorasFaltantes(40, 45)).toEqual({ horasRegistradas: 45, horasFaltantes: 0 });
  });
});

describe('isSinAsistenciaTodoElDia', () => {
  it('retorna true cuando horasRegistradas es 0', () => {
    expect(isSinAsistenciaTodoElDia(0)).toBe(true);
    expect(isSinAsistenciaTodoElDia(null)).toBe(true);
    expect(isSinAsistenciaTodoElDia(undefined)).toBe(true);
  });

  it('retorna false cuando hay al menos una hora', () => {
    expect(isSinAsistenciaTodoElDia(1)).toBe(false);
    expect(isSinAsistenciaTodoElDia(40)).toBe(false);
  });
});

describe('hasHorasFaltantes', () => {
  it('retorna true cuando horasFaltantes > 0', () => {
    expect(hasHorasFaltantes(1)).toBe(true);
    expect(hasHorasFaltantes(40)).toBe(true);
  });

  it('retorna false cuando horasFaltantes es 0 o null', () => {
    expect(hasHorasFaltantes(0)).toBe(false);
    expect(hasHorasFaltantes(null)).toBe(false);
    expect(hasHorasFaltantes(undefined)).toBe(false);
  });
});
