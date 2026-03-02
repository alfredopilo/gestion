/**
 * Tests unitarios para validadores de Nivel (createNivelSchema, updateNivelSchema).
 */
import { describe, it, expect } from '@jest/globals';
import { createNivelSchema, updateNivelSchema } from '../src/utils/validators.js';

describe('createNivelSchema', () => {
  it('acepta datos válidos', () => {
    const data = { nombreNivel: 'Bachillerato', numeroHorasClases: 40 };
    expect(() => createNivelSchema.parse(data)).not.toThrow();
    expect(createNivelSchema.parse(data)).toEqual(data);
  });

  it('rechaza nombreNivel con menos de 2 caracteres', () => {
    expect(() => createNivelSchema.parse({ nombreNivel: 'A', numeroHorasClases: 40 })).toThrow();
  });

  it('rechaza numeroHorasClases menor a 1', () => {
    expect(() => createNivelSchema.parse({ nombreNivel: 'Primaria', numeroHorasClases: 0 })).toThrow();
    expect(() => createNivelSchema.parse({ nombreNivel: 'Primaria', numeroHorasClases: -1 })).toThrow();
  });

  it('acepta numeroHorasClases mínimo 1', () => {
    expect(createNivelSchema.parse({ nombreNivel: 'Nivel', numeroHorasClases: 1 })).toEqual({
      nombreNivel: 'Nivel',
      numeroHorasClases: 1,
    });
  });
});

describe('updateNivelSchema', () => {
  it('acepta todos los campos opcionales', () => {
    expect(updateNivelSchema.parse({})).toEqual({});
    expect(updateNivelSchema.parse({ nombreNivel: 'Nuevo nombre' })).toEqual({ nombreNivel: 'Nuevo nombre' });
    expect(updateNivelSchema.parse({ numeroHorasClases: 35 })).toEqual({ numeroHorasClases: 35 });
  });

  it('rechaza numeroHorasClases menor a 1 si se proporciona', () => {
    expect(() => updateNivelSchema.parse({ numeroHorasClases: 0 })).toThrow();
  });
});
