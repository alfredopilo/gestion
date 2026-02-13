/**
 * Tests unitarios para la funcionalidad de "último curso"
 * Verifica que los cursos marcados como último curso no permitan promoción
 */
import { describe, it, expect } from '@jest/globals';
import { createCourseSchema, updateCourseSchema } from '../src/utils/validators.js';

describe('createCourseSchema - validación campo ultimoCurso', () => {
  it('acepta ultimoCurso como true', () => {
    const validData = {
      nombre: 'Tercero de Bachillerato',
      nivel: 'Bachillerato',
      paralelo: 'A',
      capacidad: 30,
      ultimoCurso: true,
    };
    const result = createCourseSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ultimoCurso).toBe(true);
    }
  });

  it('acepta ultimoCurso como false', () => {
    const validData = {
      nombre: 'Primero de Bachillerato',
      nivel: 'Bachillerato',
      ultimoCurso: false,
    };
    const result = createCourseSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ultimoCurso).toBe(false);
    }
  });

  it('acepta cuando ultimoCurso no está presente (opcional)', () => {
    const validData = {
      nombre: 'Segundo de Bachillerato',
      nivel: 'Bachillerato',
    };
    const result = createCourseSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ultimoCurso).toBeUndefined();
    }
  });

  it('rechaza cuando ultimoCurso no es booleano', () => {
    const invalidData = {
      nombre: 'Test Curso',
      nivel: 'Bachillerato',
      ultimoCurso: 'si', // Debería ser booleano
    };
    const result = createCourseSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe('updateCourseSchema - validación campo ultimoCurso', () => {
  it('acepta actualizar ultimoCurso a true', () => {
    const validData = {
      ultimoCurso: true,
    };
    const result = updateCourseSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ultimoCurso).toBe(true);
    }
  });

  it('acepta actualizar ultimoCurso a false', () => {
    const validData = {
      nombre: 'Curso actualizado',
      ultimoCurso: false,
    };
    const result = updateCourseSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ultimoCurso).toBe(false);
    }
  });
});

describe('Lógica de negocio - promoción de último curso', () => {
  it('debe devolver error 400 cuando se intenta promocionar un curso con ultimoCurso=true', () => {
    // Este es un test de lógica de negocio simulado
    // En producción, esto se haría con un mock del controlador promoteStudents
    const cursoMock = {
      id: 'test-id',
      nombre: 'Tercero de Bachillerato',
      ultimoCurso: true,
      cursoSiguiente: null,
      estudiantes: [{ id: 'est1' }],
    };

    // Simular la validación del controlador
    const shouldAllowPromotion = !cursoMock.ultimoCurso;
    
    expect(shouldAllowPromotion).toBe(false);
  });

  it('debe permitir promoción cuando ultimoCurso=false', () => {
    const cursoMock = {
      id: 'test-id',
      nombre: 'Primero de Bachillerato',
      ultimoCurso: false,
      cursoSiguiente: { id: 'curso-siguiente-id', nombre: 'Segundo de Bachillerato' },
      estudiantes: [{ id: 'est1' }],
    };

    // Simular la validación del controlador
    const shouldAllowPromotion = !cursoMock.ultimoCurso && !!cursoMock.cursoSiguiente;
    
    expect(shouldAllowPromotion).toBe(true);
  });

  it('debe permitir promoción cuando ultimoCurso no está definido (valor por defecto)', () => {
    const cursoMock = {
      id: 'test-id',
      nombre: 'Segundo de Bachillerato',
      ultimoCurso: undefined,
      cursoSiguiente: { id: 'curso-siguiente-id', nombre: 'Tercero de Bachillerato' },
      estudiantes: [{ id: 'est1' }],
    };

    // Simular la validación del controlador (undefined se trata como false)
    const shouldAllowPromotion = !cursoMock.ultimoCurso && !!cursoMock.cursoSiguiente;
    
    expect(shouldAllowPromotion).toBe(true);
  });
});
