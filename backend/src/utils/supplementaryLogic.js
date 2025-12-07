import prisma from '../config/database.js';
import { calculateSubPeriodAverage, calculatePeriodAverageFromSubPeriods, calculateGeneralAverageFromPeriods, truncate } from './gradeCalculations.js';

/**
 * Calcula el promedio mínimo requerido para supletorio
 * Suma de las calificaciones mínimas de todos los períodos regulares (no supletorios) del año lectivo
 * @param {string} anioLectivoId - ID del año lectivo
 * @returns {Promise<number>} - Suma de calificaciones mínimas
 */
export async function calculateMinimumSupplementaryGrade(anioLectivoId) {
  const regularPeriods = await prisma.period.findMany({
    where: {
      anioLectivoId: anioLectivoId,
      esSupletorio: false,
    },
    select: {
      calificacionMinima: true,
    },
  });

  const sumMinimumGrades = regularPeriods.reduce((sum, period) => {
    return sum + (period.calificacionMinima || 7.0);
  }, 0);

  return sumMinimumGrades;
}

/**
 * Calcula el promedio general del estudiante en una materia
 * Suma de los promedios ponderados de todos los períodos regulares
 * @param {string} studentId - ID del estudiante
 * @param {string} materiaId - ID de la materia
 * @param {string} anioLectivoId - ID del año lectivo
 * @returns {Promise<{promedioGeneral: number, periodAverages: Array}>}
 */
export async function calculateStudentGeneralAverage(studentId, materiaId, anioLectivoId) {
  // Obtener todos los períodos regulares (no supletorios) del año lectivo
  const regularPeriods = await prisma.period.findMany({
    where: {
      anioLectivoId: anioLectivoId,
      esSupletorio: false,
    },
    include: {
      subPeriodos: {
        orderBy: { orden: 'asc' },
      },
    },
    orderBy: { orden: 'asc' },
  });

  const periodAverages = [];

  // Para cada período regular, calcular el promedio del estudiante
  for (const period of regularPeriods) {
    const subPeriodIds = period.subPeriodos.map(sp => sp.id);

    // Obtener calificaciones del estudiante en esta materia para este período
    const grades = await prisma.grade.findMany({
      where: {
        estudianteId: studentId,
        materiaId: materiaId,
        OR: [
          { subPeriodoId: { in: subPeriodIds } },
          {
            insumo: {
              subPeriodo: {
                id: { in: subPeriodIds },
              },
            },
          },
        ],
      },
      include: {
        subPeriodo: {
          include: {
            periodo: {
              select: {
                id: true,
                nombre: true,
                ponderacion: true,
                calificacionMinima: true,
              },
            },
          },
        },
        insumo: {
          include: {
            subPeriodo: {
              include: {
                periodo: {
                  select: {
                    id: true,
                    nombre: true,
                    ponderacion: true,
                    calificacionMinima: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (grades.length === 0) {
      // Si no hay calificaciones para este período, el promedio es 0
      periodAverages.push({
        periodoId: period.id,
        periodoNombre: period.nombre,
        promedio: 0,
        promedioPonderado: 0,
        ponderacion: period.ponderacion || 100,
        calificacionMinima: period.calificacionMinima || 7.0,
      });
      continue;
    }

    // Agrupar calificaciones por subperíodo
    const gradesBySubPeriod = {};
    grades.forEach(grade => {
      const subPeriodo = grade.subPeriodo || grade.insumo?.subPeriodo;
      if (subPeriodo && subPeriodo.periodo?.id === period.id) {
        const subPeriodoId = subPeriodo.id;
        if (!gradesBySubPeriod[subPeriodoId]) {
          gradesBySubPeriod[subPeriodoId] = {
            subPeriodo: subPeriodo,
            calificaciones: [],
          };
        }
        gradesBySubPeriod[subPeriodoId].calificaciones.push(grade.calificacion);
      }
    });

    // Calcular promedio por subperíodo usando función centralizada
    const subPeriodAverages = {};
    Object.keys(gradesBySubPeriod).forEach(subPeriodoId => {
      const data = gradesBySubPeriod[subPeriodoId];
      if (data.calificaciones.length > 0) {
        const promedio = calculateSubPeriodAverage(data.calificaciones);
        subPeriodAverages[subPeriodoId] = {
          promedio: promedio,
          ponderacion: data.subPeriodo.ponderacion || 0,
        };
      }
    });

    // Calcular promedio ponderado del período usando función centralizada
    const periodoPonderacion = period.ponderacion || 100;
    const { promedio: promedioPeriodoTruncado, promedioPonderado } = calculatePeriodAverageFromSubPeriods(
      subPeriodAverages,
      periodoPonderacion
    );

    periodAverages.push({
      periodoId: period.id,
      periodoNombre: period.nombre,
      promedio: promedioPeriodoTruncado,
      promedioPonderado: promedioPonderado,
      ponderacion: periodoPonderacion,
      calificacionMinima: period.calificacionMinima || 7.0,
    });
  }

  // Calcular promedio general (suma de promedios ponderados de períodos) usando función centralizada
  const promediosPonderados = periodAverages.map(pa => pa.promedioPonderado);
  const promedioGeneral = calculateGeneralAverageFromPeriods(promediosPonderados);

  return {
    promedioGeneral: promedioGeneral,
    periodAverages: periodAverages,
  };
}

/**
 * Verifica si un estudiante califica para supletorio en una materia
 * @param {string} studentId - ID del estudiante
 * @param {string} materiaId - ID de la materia
 * @param {string} anioLectivoId - ID del año lectivo
 * @returns {Promise<{qualifies: boolean, promedioGeneral: number, sumaMinima: number, periodAverages: Array}>}
 */
export async function checkStudentQualifiesForSupplementary(studentId, materiaId, anioLectivoId) {
  // Calcular suma de calificaciones mínimas de períodos regulares
  const sumaMinima = await calculateMinimumSupplementaryGrade(anioLectivoId);

  // Calcular promedio general del estudiante
  const { promedioGeneral, periodAverages } = await calculateStudentGeneralAverage(
    studentId,
    materiaId,
    anioLectivoId
  );

  // Calcular promedio mínimo promedio (para comparación alternativa)
  const regularPeriods = await prisma.period.findMany({
    where: {
      anioLectivoId: anioLectivoId,
      esSupletorio: false,
    },
    select: {
      calificacionMinima: true,
    },
  });

  const promedioMinimoPromedio = regularPeriods.length > 0
    ? sumaMinima / regularPeriods.length
    : 7.0;

  // El estudiante califica si su promedio general es menor a la suma mínima
  // O si su promedio promedio es menor al promedio mínimo promedio
  const qualifies = promedioGeneral < sumaMinima || (promedioGeneral / regularPeriods.length) < promedioMinimoPromedio;

  return {
    qualifies,
    promedioGeneral,
    sumaMinima,
    promedioMinimoPromedio,
    periodAverages,
  };
}

/**
 * Obtiene los períodos con promedios más bajos para un estudiante
 * @param {string} studentId - ID del estudiante
 * @param {string} materiaId - ID de la materia
 * @param {string} anioLectivoId - ID del año lectivo
 * @returns {Promise<Array>} - Array de períodos ordenados por promedio (más bajo primero)
 */
export async function getLowestPeriodAverages(studentId, materiaId, anioLectivoId) {
  const { periodAverages } = await calculateStudentGeneralAverage(studentId, materiaId, anioLectivoId);

  // Filtrar períodos que están por debajo de su calificación mínima
  const periodsBelowMinimum = periodAverages.filter(pa => pa.promedio < pa.calificacionMinima);

  // Ordenar por promedio (más bajo primero)
  const sortedPeriods = [...periodsBelowMinimum].sort((a, b) => a.promedio - b.promedio);

  return sortedPeriods;
}

/**
 * Reemplaza períodos bajos con la calificación de supletorio
 * @param {Array} periodAverages - Array de promedios de períodos
 * @param {number} supplementaryAverage - Calificación de supletorio
 * @returns {Array} - Array de promedios ajustados
 */
export function replacePeriodWithSupplementary(periodAverages, supplementaryAverage) {
  // Identificar períodos que están por debajo del mínimo
  const periodsToReplace = periodAverages
    .map((pa, index) => ({ ...pa, originalIndex: index }))
    .filter(pa => pa.promedio < pa.calificacionMinima)
    .sort((a, b) => a.promedio - b.promedio); // Ordenar por promedio más bajo primero

  // Crear copia del array de promedios
  const adjustedAverages = [...periodAverages];

  // Reemplazar los períodos más bajos con la calificación de supletorio
  periodsToReplace.forEach(period => {
    adjustedAverages[period.originalIndex] = {
      ...period,
      promedio: supplementaryAverage,
      promedioPonderado: truncate(supplementaryAverage * (period.ponderacion / 100)),
      reemplazadoPorSupletorio: true,
      promedioOriginal: period.promedio,
    };
  });

  return adjustedAverages;
}

