import prisma from '../config/database.js';

/**
 * Genera un número de matrícula único para un estudiante en una institución y año lectivo
 * @param {string} institucionId - ID de la institución
 * @param {string} anioLectivoId - ID del año lectivo
 * @returns {Promise<string>} - Número de matrícula generado
 */
export const generateMatriculaNumber = async (institucionId, anioLectivoId) => {
  try {
    // Obtener el año del año lectivo para usar en el formato de matrícula
    const schoolYear = await prisma.schoolYear.findUnique({
      where: { id: anioLectivoId },
      select: { ano: true, institucionId: true },
    });

    if (!schoolYear) {
      throw new Error('Año lectivo no encontrado');
    }

    if (schoolYear.institucionId !== institucionId) {
      throw new Error('El año lectivo no pertenece a la institución especificada');
    }

    const year = schoolYear.ano;

    // Buscar la última matrícula del año lectivo e institución
    const lastEnrollment = await prisma.enrollment.findFirst({
      where: {
        institucionId,
        anioLectivoId,
      },
      orderBy: {
        matricula: 'desc',
      },
      select: {
        matricula: true,
      },
    });

    let nextNumber = 1;

    if (lastEnrollment && lastEnrollment.matricula) {
      // Extraer el número de la matrícula
      // Formato esperado: YYYY-XXXXX (ej: 2024-00001)
      const parts = lastEnrollment.matricula.split('-');
      if (parts.length === 2 && parts[0] === year.toString()) {
        const lastNumber = parseInt(parts[1], 10);
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1;
        }
      }
    }

    // Formato: YYYY-XXXXX (ej: 2024-00001)
    const matriculaNumber = `${year}-${String(nextNumber).padStart(5, '0')}`;

    // Verificar que no exista (por si acaso hay conflictos)
    const exists = await prisma.enrollment.findFirst({
      where: {
        institucionId,
        anioLectivoId,
        matricula: matriculaNumber,
      },
    });

    if (exists) {
      // Si existe, incrementar el número y generar nueva matrícula
      nextNumber += 1;
      const newMatriculaNumber = `${year}-${String(nextNumber).padStart(5, '0')}`;
      return newMatriculaNumber;
    }

    return matriculaNumber;
  } catch (error) {
    console.error('Error al generar número de matrícula:', error);
    throw error;
  }
};

/**
 * Obtiene el año del año lectivo
 * @param {string} anioLectivoId - ID del año lectivo
 * @returns {Promise<number>} - Año del año lectivo
 */
export const getSchoolYear = async (anioLectivoId) => {
  const schoolYear = await prisma.schoolYear.findUnique({
    where: { id: anioLectivoId },
    select: { ano: true },
  });

  if (!schoolYear) {
    throw new Error('Año lectivo no encontrado');
  }

  return schoolYear.ano;
};

