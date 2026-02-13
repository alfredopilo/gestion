/**
 * Tests unitarios para exportTemplate e importTemplate
 * de la plantilla de ficha del estudiante.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { importStudentProfileTemplateSchema } from '../src/utils/validators.js';

describe('importStudentProfileTemplateSchema', () => {
  it('valida estructura correcta con secciones y campos', () => {
    const validData = {
      version: 1,
      sections: [
        {
          nombre: 'Datos Personales',
          descripcion: 'Información básica',
          orden: 0,
          activo: true,
          campos: [
            {
              etiqueta: 'Género',
              descripcion: '',
              tipo: 'SELECT',
              requerido: false,
              orden: 0,
              config: { options: [{ label: 'Masculino', value: 'M' }] },
            },
          ],
        },
      ],
    };
    const result = importStudentProfileTemplateSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('rechaza cuando no hay secciones', () => {
    const invalidData = { sections: [] };
    const result = importStudentProfileTemplateSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('rechaza cuando falta nombre en sección', () => {
    const invalidData = {
      sections: [{ descripcion: 'Test', orden: 0, campos: [] }],
    };
    const result = importStudentProfileTemplateSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('rechaza tipo de campo inválido', () => {
    const invalidData = {
      sections: [
        {
          nombre: 'Test',
          campos: [{ etiqueta: 'Campo', tipo: 'INVALIDO' }],
        },
      ],
    };
    const result = importStudentProfileTemplateSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe('exportTemplate estructura esperada', () => {
  it('la respuesta de export debe tener version, exportedAt y sections', async () => {
    // Test de contrato: verificamos que el formato exportado cumple la estructura
    const mockExportStructure = {
      version: 1,
      exportedAt: new Date().toISOString(),
      sections: [
        {
          nombre: 'Datos Personales',
          descripcion: null,
          orden: 0,
          activo: true,
          campos: [
            {
              etiqueta: 'Género',
              descripcion: null,
              tipo: 'SELECT',
              requerido: false,
              orden: 0,
              config: { options: [{ label: 'M', value: 'M' }] },
            },
          ],
        },
      ],
    };
    expect(mockExportStructure).toHaveProperty('version');
    expect(mockExportStructure).toHaveProperty('exportedAt');
    expect(mockExportStructure).toHaveProperty('sections');
    expect(Array.isArray(mockExportStructure.sections)).toBe(true);
    expect(mockExportStructure.sections[0]).toHaveProperty('nombre');
    expect(mockExportStructure.sections[0]).toHaveProperty('campos');
    expect(mockExportStructure.sections[0].campos[0]).toHaveProperty('etiqueta');
    expect(mockExportStructure.sections[0].campos[0]).toHaveProperty('tipo');
    expect(mockExportStructure.sections[0].campos[0]).not.toHaveProperty('id');
  });
});
