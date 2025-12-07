import prisma from '../config/database.js';
import { randomUUID } from 'crypto';
import { calculateStudentGeneralAverage } from './supplementaryLogic.js';
import { truncate } from './gradeCalculations.js';

const MINIMUM_GRADE_TO_PASS = 7.0;

/**
 * Calcula el estado de promoción de un estudiante
 * Un estudiante pasa si aprueba TODAS las materias (cada materia >= 7.0)
 * @param {string} studentId - ID del estudiante
 * @param {string} anioLectivoId - ID del año lectivo
 * @param {string} cursoId - ID del curso del estudiante
 * @returns {Promise<{pasa: boolean, materias: Array, promedioGeneral: number}>}
 */
export async function calculateStudentPromotionStatus(studentId, anioLectivoId, cursoId) {
  // Obtener todas las materias asignadas al curso del estudiante
  const course = await prisma.course.findUnique({
    where: { id: cursoId },
    include: {
      course_subject_assignments: {
        include: {
          materia: true,
        },
      },
    },
  });

  if (!course || !course.course_subject_assignments || course.course_subject_assignments.length === 0) {
    return {
      pasa: false,
      materias: [],
      promedioGeneral: 0,
      motivo: 'No hay materias asignadas al curso',
    };
  }

  const materiasInfo = [];
  let todasAprobadas = true;
  let sumaPromedios = 0;
  let materiasConCalificaciones = 0;

  // Calcular promedio de cada materia
  for (const assignment of course.course_subject_assignments) {
    const materia = assignment.materia;
    
    // Calcular promedio general de la materia para el estudiante
    const { promedioGeneral } = await calculateStudentGeneralAverage(
      studentId,
      materia.id,
      anioLectivoId
    );

    const aprobado = promedioGeneral >= MINIMUM_GRADE_TO_PASS;
    
    if (!aprobado) {
      todasAprobadas = false;
    }

    sumaPromedios += promedioGeneral;
    if (promedioGeneral > 0) {
      materiasConCalificaciones++;
    }

    materiasInfo.push({
      materiaId: materia.id,
      materiaNombre: materia.nombre,
      materiaCodigo: materia.codigo,
      promedio: promedioGeneral,
      aprobado: aprobado,
      calificacionMinima: MINIMUM_GRADE_TO_PASS,
    });
  }

  // Calcular promedio general (promedio de promedios de todas las materias)
  // CRÍTICO: Se debe truncar el resultado para consistencia con otros cálculos
  const promedioGeneral = materiasConCalificaciones > 0 
    ? truncate(sumaPromedios / materiasConCalificaciones)
    : 0;

  return {
    pasa: todasAprobadas && materiasConCalificaciones > 0,
    materias: materiasInfo,
    promedioGeneral: promedioGeneral,
    motivo: todasAprobadas 
      ? 'Aprobó todas las materias' 
      : 'No aprobó todas las materias',
  };
}

/**
 * Ajusta las fechas de un período al nuevo año
 * @param {Object} period - Período original
 * @param {number} nuevoAno - Año nuevo (ej: 2026)
 * @returns {Object} - Período con fechas ajustadas
 */
export function adjustPeriodDates(period, nuevoAno) {
  const fechaInicio = new Date(period.fechaInicio);
  const fechaFin = new Date(period.fechaFin);

  // Obtener el año original del período
  const anoOriginal = fechaInicio.getFullYear();

  // Calcular la diferencia de años
  const diferenciaAnos = nuevoAno - anoOriginal;

  // Ajustar fechas sumando la diferencia de años
  const nuevaFechaInicio = new Date(fechaInicio);
  nuevaFechaInicio.setFullYear(fechaInicio.getFullYear() + diferenciaAnos);

  const nuevaFechaFin = new Date(fechaFin);
  nuevaFechaFin.setFullYear(fechaFin.getFullYear() + diferenciaAnos);

  return {
    ...period,
    fechaInicio: nuevaFechaInicio,
    fechaFin: nuevaFechaFin,
  };
}

/**
 * Copia un curso al nuevo año lectivo
 * @param {Object} course - Curso original
 * @param {string} nuevoAnioLectivoId - ID del nuevo año lectivo
 * @param {Object} cursosMapeo - Mapeo de cursoId antiguo -> cursoId nuevo para cursoSiguienteId
 * @param {Object} prismaClient - Cliente de Prisma (puede ser transacción)
 * @returns {Promise<Object>} - Nuevo curso creado
 */
export async function copyCourseToNewYear(course, nuevoAnioLectivoId, cursosMapeo, prismaClient = prisma) {
  // Mapear cursoSiguienteId al nuevo curso correspondiente
  const nuevoCursoSiguienteId = course.cursoSiguienteId && cursosMapeo[course.cursoSiguienteId]
    ? cursosMapeo[course.cursoSiguienteId]
    : null;

  const nuevoCurso = await prismaClient.course.create({
    data: {
      id: randomUUID(),
      nombre: course.nombre,
      nivel: course.nivel,
      paralelo: course.paralelo,
      docenteId: course.docenteId, // Mantener el mismo docente (si existe)
      capacidad: course.capacidad || 30,
      anioLectivoId: nuevoAnioLectivoId,
      cursoSiguienteId: nuevoCursoSiguienteId,
      sortOrder: course.sortOrder || 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return nuevoCurso;
}

/**
 * Copia una materia al nuevo año lectivo
 * @param {Object} subject - Materia original
 * @param {string} nuevoAnioLectivoId - ID del nuevo año lectivo
 * @param {Object} prismaClient - Cliente de Prisma (puede ser transacción)
 * @returns {Promise<Object>} - Nueva materia creada
 */
export async function copySubjectToNewYear(subject, nuevoAnioLectivoId, prismaClient = prisma) {
  // Verificar si ya existe una materia con el mismo código en el nuevo año lectivo
  const existingSubject = await prismaClient.subject.findUnique({
    where: {
      codigo_institucionId_anioLectivoId: {
        codigo: subject.codigo,
        institucionId: subject.institucionId,
        anioLectivoId: nuevoAnioLectivoId,
      },
    },
  });

  if (existingSubject) {
    // Si ya existe, retornar la existente en lugar de crear duplicado
    return existingSubject;
  }

  const nuevaMateria = await prismaClient.subject.create({
    data: {
      id: randomUUID(),
      nombre: subject.nombre,
      codigo: subject.codigo,
      creditos: subject.creditos || 1,
      horas: subject.horas,
      institucionId: subject.institucionId,
      anioLectivoId: nuevoAnioLectivoId,
      promedioMinimoSupletorio: subject.promedioMinimoSupletorio,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return nuevaMateria;
}

/**
 * Copia un período al nuevo año lectivo ajustando fechas
 * @param {Object} period - Período original
 * @param {string} nuevoAnioLectivoId - ID del nuevo año lectivo
 * @param {number} nuevoAno - Año nuevo
 * @param {Object} prismaClient - Cliente de Prisma (puede ser transacción)
 * @returns {Promise<Object>} - Nuevo período creado con subperíodos
 */
export async function copyPeriodToNewYear(period, nuevoAnioLectivoId, nuevoAno, prismaClient = prisma) {
  // Ajustar fechas del período
  const periodAjustado = adjustPeriodDates(period, nuevoAno);

  // Obtener nombre del nuevo año escolar
  const nuevoAnioEscolar = `${nuevoAno}-${nuevoAno + 1}`;

  // Crear el período
  const nuevoPeriodo = await prismaClient.period.create({
    data: {
      id: randomUUID(),
      nombre: period.nombre,
      anioEscolar: nuevoAnioEscolar,
      fechaInicio: periodAjustado.fechaInicio,
      fechaFin: periodAjustado.fechaFin,
      activo: false, // Los períodos nuevos no están activos por defecto
      esSupletorio: period.esSupletorio || false,
      calificacionMinima: period.calificacionMinima || 7.0,
      ponderacion: period.ponderacion || 50.0,
      orden: period.orden,
      anioLectivoId: nuevoAnioLectivoId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  // Copiar subperíodos asociados
  const subPeriodosOriginales = await prismaClient.subPeriod.findMany({
    where: { periodoId: period.id },
    orderBy: { orden: 'asc' },
  });

  for (const subPeriodo of subPeriodosOriginales) {
    await prismaClient.subPeriod.create({
      data: {
        id: randomUUID(),
        periodoId: nuevoPeriodo.id,
        nombre: subPeriodo.nombre,
        ponderacion: subPeriodo.ponderacion,
        orden: subPeriodo.orden,
        fechaInicio: subPeriodo.fechaInicio ? adjustPeriodDates({ fechaInicio: subPeriodo.fechaInicio, fechaFin: subPeriodo.fechaFin }, nuevoAno).fechaInicio : null,
        fechaFin: subPeriodo.fechaFin ? adjustPeriodDates({ fechaInicio: subPeriodo.fechaInicio, fechaFin: subPeriodo.fechaFin }, nuevoAno).fechaFin : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  // Obtener el período completo con subperíodos
  const periodoCompleto = await prismaClient.period.findUnique({
    where: { id: nuevoPeriodo.id },
    include: {
      subPeriodos: {
        orderBy: { orden: 'asc' },
      },
    },
  });

  return periodoCompleto;
}

/**
 * Copia una escala de calificación
 * @param {Object} gradeScale - Escala de calificación original
 * @param {string} institucionId - ID de la institución (mismo para las escalas)
 * @param {Object} prismaClient - Cliente de Prisma (puede ser transacción)
 * @returns {Promise<Object>} - Nueva escala de calificación creada o existente
 */
export async function copyGradeScaleToNewYear(gradeScale, institucionId, prismaClient = prisma) {
  // Verificar si ya existe una escala con el mismo nombre en la institución
  const existingScale = await prismaClient.gradeScale.findFirst({
    where: {
      institucionId: institucionId,
      nombre: gradeScale.nombre,
    },
    include: {
      detalles: {
        orderBy: { orden: 'asc' },
      },
    },
  });

  if (existingScale) {
    // Verificar que tenga los mismos detalles
    if (existingScale.detalles.length === gradeScale.detalles.length) {
      const detallesMatch = existingScale.detalles.every((detalle, index) => {
        const originalDetalle = gradeScale.detalles[index];
        return detalle.titulo === originalDetalle.titulo &&
               detalle.valor === originalDetalle.valor;
      });
      
      if (detallesMatch) {
        // Si ya existe una escala idéntica, retornar la existente
        return existingScale;
      }
    }
  }

  // Crear nueva escala de calificación
  const nuevaEscala = await prismaClient.gradeScale.create({
    data: {
      id: randomUUID(),
      nombre: gradeScale.nombre,
      institucionId: institucionId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  // Copiar detalles de la escala
  for (const detalle of gradeScale.detalles) {
    await prismaClient.gradeScaleDetail.create({
      data: {
        id: randomUUID(),
        gradeScaleId: nuevaEscala.id,
        titulo: detalle.titulo,
        valor: detalle.valor,
        orden: detalle.orden || 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  // Obtener la escala completa con detalles
  const escalaCompleta = await prismaClient.gradeScale.findUnique({
    where: { id: nuevaEscala.id },
    include: {
      detalles: {
        orderBy: { orden: 'asc' },
      },
    },
  });

  return escalaCompleta;
}

