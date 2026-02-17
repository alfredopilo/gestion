import prisma from '../config/database.js';
import { calculateSubPeriodAverage, calculatePeriodAverageFromSubPeriods, calculateGeneralAverageFromPeriods, applyDecimalStrategy } from './gradeCalculations.js';
import { getEffectiveGradeRoundingConfigFromEntities } from '../services/gradeRoundingConfigService.js';

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
  const schoolYear = await prisma.schoolYear.findUnique({
    where: { id: anioLectivoId },
    select: { institucionId: true },
  });
  const institution = schoolYear?.institucionId
    ? await prisma.institution.findUnique({
        where: { id: schoolYear.institucionId },
        select: {
          gradeRoundingSubPeriodMethod: true,
          gradeRoundingWeightedMethod: true,
          gradeRoundingPeriodWeightedMethod: true,
          gradeDecimals: true,
        },
      })
    : null;

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

  for (const period of regularPeriods) {
    let roundingConfig;
    try {
      roundingConfig = institution ? getEffectiveGradeRoundingConfigFromEntities(institution, period) : undefined;
    } catch {
      roundingConfig = undefined;
    }
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

    const subPeriodAverages = {};
    Object.keys(gradesBySubPeriod).forEach(subPeriodoId => {
      const data = gradesBySubPeriod[subPeriodoId];
      if (data.calificaciones.length > 0) {
        const promedio = calculateSubPeriodAverage(data.calificaciones, roundingConfig);
        subPeriodAverages[subPeriodoId] = {
          promedio,
          ponderacion: data.subPeriodo.ponderacion || 0,
        };
      }
    });

    const periodoPonderacion = period.ponderacion || 100;
    const { promedio: promedioPeriodoTruncado, promedioPonderado } = calculatePeriodAverageFromSubPeriods(
      subPeriodAverages,
      periodoPonderacion,
      roundingConfig
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

  const promediosPonderados = periodAverages.map(pa => pa.promedioPonderado);
  let firstConfig;
  try {
    const firstPeriod = periodAverages.length > 0 && regularPeriods.length > 0
      ? regularPeriods.find(p => p.id === periodAverages[0].periodoId)
      : null;
    firstConfig = institution && firstPeriod ? getEffectiveGradeRoundingConfigFromEntities(institution, firstPeriod) : undefined;
  } catch {
    firstConfig = undefined;
  }
  const promedioGeneral = calculateGeneralAverageFromPeriods(promediosPonderados, firstConfig);

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
 * Reemplaza períodos bajos con la calificación de supletorio.
 * @param {Array} periodAverages - Array de promedios de períodos
 * @param {number} supplementaryAverage - Calificación de supletorio
 * @param {{ periodWeightedMethod: string, decimals: number }} [roundingConfig] - Config efectiva (opcional)
 */
export function replacePeriodWithSupplementary(periodAverages, supplementaryAverage, roundingConfig) {
  const periodsToReplace = periodAverages
    .map((pa, index) => ({ ...pa, originalIndex: index }))
    .filter(pa => pa.promedio < pa.calificacionMinima)
    .sort((a, b) => a.promedio - b.promedio);

  const adjustedAverages = [...periodAverages];

  periodsToReplace.forEach(period => {
    const raw = supplementaryAverage * (period.ponderacion / 100);
    const promedioPonderado = roundingConfig
      ? applyDecimalStrategy(raw, roundingConfig.decimals, roundingConfig.periodWeightedMethod)
      : Math.floor(raw * 100) / 100;
    adjustedAverages[period.originalIndex] = {
      ...period,
      promedio: supplementaryAverage,
      promedioPonderado,
      reemplazadoPorSupletorio: true,
      promedioOriginal: period.promedio,
    };
  });

  return adjustedAverages;
}

