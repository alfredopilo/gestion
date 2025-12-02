import prisma from '../config/database.js';
import { 
  checkStudentQualifiesForSupplementary,
  getLowestPeriodAverages,
  calculateMinimumSupplementaryGrade,
} from '../utils/supplementaryLogic.js';
import { verifyCourseBelongsToInstitution } from '../utils/institutionFilter.js';

/**
 * Obtener estudiantes elegibles para supletorio en una materia
 */
export const getStudentsEligibleForSupplementary = async (req, res, next) => {
  try {
    const { materiaId, anioLectivoId, periodoId } = req.query;

    if (!materiaId || !anioLectivoId) {
      return res.status(400).json({
        error: 'Debe proporcionar materiaId y anioLectivoId.',
      });
    }

    // Obtener la materia para verificar que existe
    const materia = await prisma.subject.findUnique({
      where: { id: materiaId },
      include: {
        asignaciones: {
          include: {
            curso: {
              include: {
                anioLectivo: {
                  select: {
                    id: true,
                    institucionId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!materia) {
      return res.status(404).json({
        error: 'Materia no encontrada.',
      });
    }

    // Verificar acceso a la institución
    const institutionId = materia.institucionId;
    if (req.user?.rol !== 'ADMIN' && req.institutionId !== institutionId) {
      return res.status(403).json({
        error: 'No tienes acceso a esta materia.',
      });
    }

    // Obtener el período supletorio si se especifica
    let periodoSupletorio = null;
    if (periodoId) {
      periodoSupletorio = await prisma.period.findUnique({
        where: { id: periodoId },
      });

      if (!periodoSupletorio || !periodoSupletorio.esSupletorio) {
        return res.status(400).json({
          error: 'El período especificado no es un período supletorio.',
        });
      }
    }

    // Obtener todos los cursos que tienen esta materia asignada en el año lectivo
    const asignaciones = materia.asignaciones.filter(a => 
      a.curso.anioLectivoId === anioLectivoId
    );

    const cursoIds = asignaciones.map(a => a.cursoId);

    if (cursoIds.length === 0) {
      return res.json({
        data: [],
        total: 0,
      });
    }

    // Obtener todos los estudiantes de esos cursos
    const students = await prisma.student.findMany({
      where: {
        grupoId: { in: cursoIds },
        retirado: false,
      },
      include: {
        user: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            numeroIdentificacion: true,
          },
        },
        grupo: {
          select: {
            id: true,
            nombre: true,
            nivel: true,
            paralelo: true,
          },
        },
      },
    });

    // Calcular suma mínima para supletorio
    const sumaMinima = await calculateMinimumSupplementaryGrade(anioLectivoId);

    // Verificar elegibilidad para cada estudiante
    const eligibleStudents = [];

    for (const student of students) {
      const qualificationResult = await checkStudentQualifiesForSupplementary(
        student.id,
        materiaId,
        anioLectivoId
      );

      if (qualificationResult.qualifies) {
        const lowestPeriods = await getLowestPeriodAverages(
          student.id,
          materiaId,
          anioLectivoId
        );

        eligibleStudents.push({
          estudiante: {
            id: student.id,
            nombre: student.user.nombre,
            apellido: student.user.apellido,
            numeroIdentificacion: student.user.numeroIdentificacion,
          },
          curso: {
            id: student.grupo.id,
            nombre: student.grupo.nombre,
            nivel: student.grupo.nivel,
            paralelo: student.grupo.paralelo,
          },
          promedioGeneral: qualificationResult.promedioGeneral,
          sumaMinima: qualificationResult.sumaMinima,
          promedioMinimoPromedio: qualificationResult.promedioMinimoPromedio,
          periodosBajos: lowestPeriods.map(p => ({
            periodoId: p.periodoId,
            periodoNombre: p.periodoNombre,
            promedio: p.promedio,
            calificacionMinima: p.calificacionMinima,
          })),
        });
      }
    }

    res.json({
      data: eligibleStudents,
      total: eligibleStudents.length,
      sumaMinima: sumaMinima,
    });
  } catch (error) {
    console.error('Error al obtener estudiantes elegibles para supletorio:', error);
    next(error);
  }
};

/**
 * Obtener estado de elegibilidad de un estudiante para supletorio
 */
export const getStudentSupplementaryStatus = async (req, res, next) => {
  try {
    const { studentId, materiaId, anioLectivoId } = req.params;

    if (!studentId || !materiaId || !anioLectivoId) {
      return res.status(400).json({
        error: 'Debe proporcionar studentId, materiaId y anioLectivoId.',
      });
    }

    // Verificar acceso al estudiante
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          include: {
            userInstitutions: {
              include: {
                institucion: true,
              },
            },
          },
        },
      },
    });

    if (!student) {
      return res.status(404).json({
        error: 'Estudiante no encontrado.',
      });
    }

    // Verificar acceso a la institución del estudiante
    const studentInstitutionId = student.user.userInstitutions[0]?.institucionId;
    if (req.user?.rol !== 'ADMIN' && req.institutionId !== studentInstitutionId) {
      return res.status(403).json({
        error: 'No tienes acceso a este estudiante.',
      });
    }

    // Verificar elegibilidad
    const qualificationResult = await checkStudentQualifiesForSupplementary(
      studentId,
      materiaId,
      anioLectivoId
    );

    const lowestPeriods = await getLowestPeriodAverages(
      studentId,
      materiaId,
      anioLectivoId
    );

    res.json({
      qualifies: qualificationResult.qualifies,
      promedioGeneral: qualificationResult.promedioGeneral,
      sumaMinima: qualificationResult.sumaMinima,
      promedioMinimoPromedio: qualificationResult.promedioMinimoPromedio,
      periodosBajos: lowestPeriods,
      todosLosPeriodos: qualificationResult.periodAverages,
    });
  } catch (error) {
    console.error('Error al obtener estado de supletorio del estudiante:', error);
    next(error);
  }
};

