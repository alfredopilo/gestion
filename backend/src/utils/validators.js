import { z } from 'zod';

// Esquemas de validación

export const createUserSchema = z.preprocess(
  (data) => {
    // Preprocesar: remover institucionId si es undefined/null/string vacío
    if (typeof data === 'object' && data !== null) {
      const cleaned = { ...data };
      if (cleaned.institucionId === undefined || cleaned.institucionId === null || cleaned.institucionId === '') {
        delete cleaned.institucionId;
      }
      return cleaned;
    }
    return data;
  },
  z.object({
    nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    apellido: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
    email: z.string().email('Email inválido'),
    numeroIdentificacion: z.string().min(1, 'El número de identificación es requerido'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
    rol: z.enum(['ADMIN', 'PROFESOR', 'ESTUDIANTE', 'REPRESENTANTE', 'SECRETARIA']),
    telefono: z.string().optional().nullable(),
    direccion: z.string().optional().nullable(),
    institucionId: z.string().uuid('ID de institución inválido').optional(), // Opcional, se usará el primero del array
    instituciones: z.array(z.string().uuid()).min(1, 'Debe seleccionar al menos una institución'), // Requerido con al menos 1 elemento
  }).passthrough()
);

export const updateUserSchema = z.object({
  nombre: z.string().min(2).optional(),
  apellido: z.string().min(2).optional(),
  email: z.string().email().optional(),
  numeroIdentificacion: z.string().min(1).optional(),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
  estado: z.enum(['ACTIVO', 'INACTIVO', 'SUSPENDIDO']).optional(),
  institucionId: z.string().uuid().optional(),
  instituciones: z.array(z.string().uuid()).optional(), // Array de IDs de instituciones adicionales
});

// Schema para actualizar perfil del usuario autenticado (no puede cambiar estado ni institucionId)
export const updateProfileSchema = z.object({
  nombre: z.string().min(2).optional(),
  apellido: z.string().min(2).optional(),
  email: z.string().email().optional(),
  numeroIdentificacion: z.string().min(1).optional(),
  telefono: z.string().optional().nullable(),
  direccion: z.string().optional().nullable(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional(),
});

export const loginSchema = z.object({
  numeroIdentificacion: z.string().min(1, 'Número de identificación requerido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
}).strip(); // Ignorar campos adicionales

export const createStudentSchema = z.object({
  userId: z.string().uuid(),
  representanteId: z.string().uuid().optional(),
  fechaNacimiento: z.string().or(z.date()),
  lugarNacimiento: z.string().optional(),
  nacionalidad: z.string().optional(),
  genero: z.string().optional(),
  grupoId: z.string().uuid().optional(),
  matricula: z.string().optional(),
});

export const createCourseSchema = z.object({
  nombre: z.string().min(2),
  nivel: z.string().min(2),
  paralelo: z.string().optional(),
  docenteId: z.string().uuid().optional().nullable(),
  anioLectivoId: z.string().uuid().optional(), // Opcional, se usará el activo si no se proporciona
  periodoId: z.string().uuid().optional(), // Opcional, para compatibilidad
  capacidad: z.number().int().positive().optional(),
  cursoSiguienteId: z.string().uuid().optional().nullable(),
  sortOrder: z.number().int().optional().nullable(),
});

export const updateCourseSchema = z.object({
  nombre: z.string().min(2).optional(),
  nivel: z.string().min(2).optional(),
  paralelo: z.string().optional().nullable(),
  docenteId: z.string().uuid().optional().nullable(),
  anioLectivoId: z.string().uuid().optional(),
  periodoId: z.string().uuid().optional().nullable(), // Opcional, para compatibilidad
  capacidad: z.number().int().positive().optional().nullable(),
  cursoSiguienteId: z.string().uuid().optional().nullable(),
  sortOrder: z.number().int().optional().nullable(),
});

export const createSubjectSchema = z.object({
  nombre: z.string().min(2),
  codigo: z.string().min(2),
  creditos: z.number().int().positive().optional(),
  horas: z.number().int().positive().optional(),
  anioLectivoId: z.string().uuid('ID de año lectivo inválido').optional(), // Opcional, se usará el activo si no se proporciona
});

export const createCourseSubjectAssignmentSchema = z.object({
  materiaId: z.string().uuid(),
  cursoId: z.string().uuid(),
  docenteId: z.string().uuid(),
});

export const updateCourseSubjectAssignmentSchema = z.object({
  docenteId: z.string().uuid(),
});

const importStudentSchema = z.object({
  nombre: z.string().min(2, 'El nombre es obligatorio'),
  apellido: z.string().min(2, 'El apellido es obligatorio'),
  numeroIdentificacion: z.string().min(3, 'El número de identificación es obligatorio'),
  email: z
    .string()
    .email('Email inválido')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  telefono: z
    .string()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  direccion: z
    .string()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  genero: z
    .string()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  fechaNacimiento: z
    .string()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  password: z
    .string()
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export const importStudentsSchema = z.object({
  students: z.array(importStudentSchema).min(1, 'Debes proporcionar al menos un estudiante'),
});

export const createPeriodSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  anioLectivoId: z.string().uuid('ID de año lectivo inválido'),
  anioEscolar: z.string().min(4, 'El año escolar debe tener al menos 4 caracteres').optional(),
  fechaInicio: z.union([z.string().datetime(), z.date()]),
  fechaFin: z.union([z.string().datetime(), z.date()]),
  calificacionMinima: z.number().min(0).max(10).default(7.0),
  ponderacion: z.number().min(0).max(100).optional(),
  activo: z.boolean().default(true),
  orden: z.number().int().positive().optional(),
});

export const updatePeriodSchema = z.object({
  nombre: z.string().min(2).optional(),
  anioEscolar: z.string().min(4).optional(),
  fechaInicio: z.union([z.string().datetime(), z.date()]).optional(),
  fechaFin: z.union([z.string().datetime(), z.date()]).optional(),
  calificacionMinima: z.number().min(0).max(10).optional(),
  ponderacion: z.number().min(0).max(100).optional(),
  activo: z.boolean().optional(),
  orden: z.number().int().positive().optional(),
  anioLectivoId: z.string().uuid().optional(),
});

// Esquemas para Institution
export const createInstitutionSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  codigo: z.string().optional().nullable(),
  logo: z.string().optional().nullable(),
  direccion: z.string().optional().nullable(),
  telefono: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  rector: z.string().optional().nullable(),
  activa: z.boolean().default(true),
});

export const updateInstitutionSchema = z.object({
  nombre: z.string().min(2).optional(),
  codigo: z.string().optional().nullable(),
  logo: z.string().optional().nullable(),
  direccion: z.string().optional().nullable(),
  telefono: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  rector: z.string().optional().nullable(),
  activa: z.boolean().optional(),
});

// Esquemas para SchoolYear
// Helper para validar fechas en formato YYYY-MM-DD
const dateStringSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido. Use YYYY-MM-DD (ej: 2025-11-01)')
  .refine((val) => {
    // Verificar que sea una fecha válida
    const date = new Date(val);
    return !isNaN(date.getTime());
  }, {
    message: 'La fecha proporcionada no es válida'
  });

// Schema base sin institucionId (para validación inicial)
const createSchoolYearBaseSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').min(4, 'El nombre debe tener al menos 4 caracteres (ej: 2025-2026)'),
  fechaInicio: dateStringSchema,
  fechaFin: dateStringSchema,
  activo: z.boolean().optional().default(false),
});

// Schema base con validación de fechas
export const createSchoolYearBasicSchema = createSchoolYearBaseSchema.refine((data) => {
  // Validar que fechaFin sea posterior a fechaInicio
  const inicio = new Date(data.fechaInicio);
  const fin = new Date(data.fechaFin);
  return fin > inicio;
}, {
  message: 'La fecha de fin debe ser posterior a la fecha de inicio',
  path: ['fechaFin'],
});

// Schema completo con institucionId (opcional para que el backend lo determine)
export const createSchoolYearSchema = createSchoolYearBaseSchema.extend({
  institucionId: z.string().uuid('ID de institución inválido').optional().nullable(),
}).refine((data) => {
  // Validar que fechaFin sea posterior a fechaInicio
  const inicio = new Date(data.fechaInicio);
  const fin = new Date(data.fechaFin);
  return fin > inicio;
}, {
  message: 'La fecha de fin debe ser posterior a la fecha de inicio',
  path: ['fechaFin'],
});

export const updateSchoolYearSchema = z.object({
  nombre: z.string().min(4).optional(),
  fechaInicio: dateStringSchema.optional(),
  fechaFin: dateStringSchema.optional(),
  activo: z.boolean().optional(),
});

export const createSubPeriodSchema = z.object({
  periodoId: z.string().uuid(),
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  ponderacion: z.number().min(0).max(100),
  orden: z.number().int().positive(),
  fechaInicio: z.union([z.string().datetime(), z.date()]).optional(),
  fechaFin: z.union([z.string().datetime(), z.date()]).optional(),
});

export const updateSubPeriodSchema = z.object({
  nombre: z.string().min(2).optional(),
  ponderacion: z.number().min(0).max(100).optional(),
  orden: z.number().int().positive().optional(),
  fechaInicio: z.union([z.string().datetime(), z.date()]).optional(),
  fechaFin: z.union([z.string().datetime(), z.date()]).optional(),
});

export const createGradeSchema = z.object({
  estudianteId: z.string().uuid(),
  materiaId: z.string().uuid(),
  subPeriodoId: z.string().uuid().optional(),
  parcial: z.string().optional(), // Mantener para compatibilidad
  tipoEvaluacion: z.string().optional(), // Ej: "Tarea", "Examen", "Proyecto"
  descripcion: z.string().optional(), // Descripción de la evaluación
  calificacion: z.number().min(0).max(10),
  observaciones: z.string().optional(),
}).refine(data => data.subPeriodoId || data.parcial, {
  message: 'Debe proporcionar subPeriodoId o parcial',
  path: ['subPeriodoId'],
});

export const createAttendanceSchema = z.object({
  estudianteId: z.string().uuid(),
  fecha: z.string().or(z.date()),
  estado: z.enum(['ASISTENCIA', 'FALTA', 'JUSTIFICADA', 'TARDE']),
  justificacion: z.string().optional(),
  observaciones: z.string().optional(),
});

export const createPaymentSchema = z.object({
  estudianteId: z.string().uuid(),
  concepto: z.string().min(2),
  monto: z.number().positive(),
  descuento: z.number().min(0).optional(),
  fechaPago: z.string().or(z.date()).optional(),
  fechaVencimiento: z.string().or(z.date()).optional(),
  estado: z.enum(['PENDIENTE', 'PAGADO', 'VENCIDO', 'CANCELADO']).optional(),
  observaciones: z.string().optional(),
});

