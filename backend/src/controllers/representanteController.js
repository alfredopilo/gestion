import prisma from '../config/database.js';
import { verifyStudentBelongsToInstitution } from '../utils/institutionFilter.js';
import * as XLSX from 'xlsx';

/**
 * Verificar que el estudiante pertenece al representante autenticado
 */
const verifyStudentBelongsToRepresentante = async (req, studentId) => {
  if (req.user.rol !== 'REPRESENTANTE') {
    return false;
  }

  const representante = await prisma.representante.findUnique({
    where: { userId: req.user.id },
    include: {
      students: {
        where: { id: studentId },
      },
    },
  });

  if (!representante || representante.students.length === 0) {
    return false;
  }

  return true;
};

/**
 * Obtener estudiantes asociados al representante autenticado
 */
export const getMyStudents = async (req, res, next) => {
  try {
    if (req.user.rol !== 'REPRESENTANTE') {
      return res.status(403).json({
        error: 'Solo los representantes pueden acceder a esta información.',
      });
    }

    const representante = await prisma.representante.findUnique({
      where: { userId: req.user.id },
      include: {
        students: {
          where: {
            retirado: false,
          },
          include: {
            user: {
              select: {
                id: true,
                nombre: true,
                apellido: true,
                email: true,
                telefono: true,
                estado: true,
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
            enrollments: {
              where: {
                activo: true,
              },
              include: {
                curso: {
                  select: {
                    id: true,
                    nombre: true,
                    nivel: true,
                    paralelo: true,
                  },
                },
                anioLectivo: {
                  select: {
                    id: true,
                    nombre: true,
                    ano: true,
                  },
                },
              },
              orderBy: {
                fechaInicio: 'desc',
              },
              take: 1,
            },
          },
          orderBy: [
            { user: { apellido: 'asc' } },
            { user: { nombre: 'asc' } },
          ],
        },
      },
    });

    if (!representante) {
      return res.status(404).json({
        error: 'Representante no encontrado.',
      });
    }

    res.json({
      data: representante.students,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener insumos (deberes) de un estudiante específico
 */
export const getStudentInsumos = async (req, res, next) => {
  try {
    if (req.user.rol !== 'REPRESENTANTE') {
      return res.status(403).json({
        error: 'Solo los representantes pueden acceder a esta información.',
      });
    }

    const { studentId } = req.params;
    const { cursoId, materiaId, subPeriodoId, activo } = req.query;

    // Verificar que el estudiante pertenece al representante
    const hasAccess = await verifyStudentBelongsToRepresentante(req, studentId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'No tienes acceso a este estudiante.',
      });
    }

    // Obtener el estudiante y sus enrollments activos
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        enrollments: {
          where: {
            activo: true,
          },
          include: {
            curso: true,
            anioLectivo: true,
          },
          orderBy: {
            fechaInicio: 'desc',
          },
        },
      },
    });

    if (!student) {
      return res.status(404).json({
        error: 'Estudiante no encontrado.',
      });
    }

    // Obtener los IDs de los cursos activos del estudiante
    const cursoIds = student.enrollments.map(e => e.cursoId);

    if (cursoIds.length === 0) {
      return res.json({
        data: [],
      });
    }

    // Construir filtros
    const where = {
      cursoId: { in: cursoIds },
    };

    if (cursoId) where.cursoId = cursoId;
    if (materiaId) where.materiaId = materiaId;
    if (subPeriodoId) where.subPeriodoId = subPeriodoId;
    if (activo !== undefined) where.activo = activo === 'true';

    const insumos = await prisma.insumo.findMany({
      where,
      include: {
        curso: {
          select: {
            id: true,
            nombre: true,
            nivel: true,
            paralelo: true,
          },
        },
        materia: {
          select: {
            id: true,
            nombre: true,
            codigo: true,
          },
        },
        subPeriodo: {
          select: {
            id: true,
            nombre: true,
            orden: true,
            periodo: {
              select: {
                id: true,
                nombre: true,
                anioEscolar: true,
              },
            },
          },
        },
        calificaciones: {
          where: {
            estudianteId: studentId,
          },
          select: {
            id: true,
            calificacion: true,
            observaciones: true,
            fechaRegistro: true,
          },
        },
      },
      orderBy: [
        { fechaDeber: 'desc' },
        { orden: 'asc' },
        { nombre: 'asc' },
      ],
    });

    // Agregar información sobre si el deber tiene calificación
    const insumosWithStatus = insumos.map(insumo => {
      const tieneCalificacion = insumo.calificaciones.length > 0;
      const calificacion = insumo.calificaciones[0] || null;
      const fechaEntrega = insumo.fechaEntrega;
      const fechaDeber = insumo.fechaDeber;
      const ahora = new Date();
      
      let estado = 'pendiente';
      if (tieneCalificacion) {
        estado = 'calificado';
      } else if (fechaEntrega && new Date(fechaEntrega) < ahora) {
        estado = 'vencido';
      } else if (fechaDeber && new Date(fechaDeber) <= ahora) {
        estado = 'asignado';
      }

      return {
        ...insumo,
        estado,
        calificacion: calificacion,
      };
    });

    res.json({
      data: insumosWithStatus,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener calificaciones de un estudiante específico
 */
export const getStudentGrades = async (req, res, next) => {
  try {
    if (req.user.rol !== 'REPRESENTANTE') {
      return res.status(403).json({
        error: 'Solo los representantes pueden acceder a esta información.',
      });
    }

    const { studentId } = req.params;
    const { materiaId, subPeriodoId, periodoId } = req.query;

    // Verificar que el estudiante pertenece al representante
    const hasAccess = await verifyStudentBelongsToRepresentante(req, studentId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'No tienes acceso a este estudiante.',
      });
    }

    // Obtener el estudiante
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        grupo: {
          include: {
            periodo: true,
          },
        },
        enrollments: {
          where: {
            activo: true,
          },
          include: {
            curso: true,
            anioLectivo: true,
          },
          orderBy: {
            fechaInicio: 'desc',
          },
          take: 1,
        },
      },
    });

    if (!student) {
      return res.status(404).json({
        error: 'Estudiante no encontrado.',
      });
    }

    // Construir filtros
    const where = {
      estudianteId: studentId,
    };

    if (materiaId) where.materiaId = materiaId;
    if (subPeriodoId) where.subPeriodoId = subPeriodoId;
    if (periodoId) {
      where.subPeriodo = {
        periodoId: periodoId,
      };
    }

    const grades = await prisma.grade.findMany({
      where,
      include: {
        materia: {
          select: {
            id: true,
            nombre: true,
            codigo: true,
            creditos: true,
          },
        },
        subPeriodo: {
          include: {
            periodo: {
              select: {
                id: true,
                nombre: true,
                anioEscolar: true,
                calificacionMinima: true,
                ponderacion: true,
              },
            },
          },
        },
        insumo: {
          select: {
            id: true,
            nombre: true,
            descripcion: true,
            fechaDeber: true,
            fechaEntrega: true,
          },
        },
      },
      orderBy: [
        { materia: { nombre: 'asc' } },
        { subPeriodo: { orden: 'asc' } },
        { parcial: 'asc' },
        { fechaRegistro: 'desc' },
      ],
    });

    // Agrupar calificaciones por materia
    const gradesBySubject = {};
    grades.forEach(grade => {
      const materiaId = grade.materiaId;
      if (!gradesBySubject[materiaId]) {
        gradesBySubject[materiaId] = {
          materia: grade.materia,
          calificaciones: [],
        };
      }
      gradesBySubject[materiaId].calificaciones.push(grade);
    });

    // Calcular promedios por materia
    Object.keys(gradesBySubject).forEach(materiaId => {
      const materiaData = gradesBySubject[materiaId];
      const calificaciones = materiaData.calificaciones;
      
      if (calificaciones.length > 0) {
        const suma = calificaciones.reduce((acc, g) => acc + g.calificacion, 0);
        materiaData.promedio = suma / calificaciones.length;
      } else {
        materiaData.promedio = null;
      }
    });

    res.json({
      data: Object.values(gradesBySubject),
      calificaciones: grades,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener resumen de un estudiante (información general)
 */
export const getStudentSummary = async (req, res, next) => {
  try {
    if (req.user.rol !== 'REPRESENTANTE') {
      return res.status(403).json({
        error: 'Solo los representantes pueden acceder a esta información.',
      });
    }

    const { studentId } = req.params;

    // Verificar que el estudiante pertenece al representante
    const hasAccess = await verifyStudentBelongsToRepresentante(req, studentId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'No tienes acceso a este estudiante.',
      });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            telefono: true,
            estado: true,
            numeroIdentificacion: true,
          },
        },
        grupo: {
          include: {
            periodo: {
              select: {
                id: true,
                nombre: true,
                anioEscolar: true,
              },
            },
            docente: {
              include: {
                user: {
                  select: {
                    nombre: true,
                    apellido: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        representante: {
          include: {
            user: {
              select: {
                nombre: true,
                apellido: true,
                email: true,
                telefono: true,
              },
            },
          },
        },
        enrollments: {
          where: {
            activo: true,
          },
          include: {
            curso: {
              select: {
                id: true,
                nombre: true,
                nivel: true,
                paralelo: true,
              },
            },
            anioLectivo: {
              select: {
                id: true,
                nombre: true,
                ano: true,
              },
            },
          },
          orderBy: {
            fechaInicio: 'desc',
          },
        },
      },
    });

    if (!student) {
      return res.status(404).json({
        error: 'Estudiante no encontrado.',
      });
    }

    // Obtener estadísticas básicas
    const [insumosCount, gradesCount] = await Promise.all([
      prisma.insumo.count({
        where: {
          cursoId: { in: student.enrollments.map(e => e.cursoId) },
          activo: true,
        },
      }),
      prisma.grade.count({
        where: {
          estudianteId: studentId,
        },
      }),
    ]);

    res.json({
      student,
      estadisticas: {
        insumosTotal: insumosCount,
        calificacionesTotal: gradesCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Asociar un estudiante con un representante (solo para administradores/secretaría)
 */
export const associateStudent = async (req, res, next) => {
  try {
    // Solo administradores y secretaría pueden asociar estudiantes
    if (!['ADMIN', 'SECRETARIA'].includes(req.user.rol)) {
      return res.status(403).json({
        error: 'No tienes permisos para realizar esta acción.',
      });
    }

    const { studentId } = req.params;
    const { representanteId } = req.body;

    if (!representanteId) {
      return res.status(400).json({
        error: 'Debe proporcionar el ID del representante.',
      });
    }

    // Verificar que el estudiante existe
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: {
            nombre: true,
            apellido: true,
          },
        },
      },
    });

    if (!student) {
      return res.status(404).json({
        error: 'Estudiante no encontrado.',
      });
    }

    // Verificar que el representante existe
    const representante = await prisma.representante.findUnique({
      where: { id: representanteId },
      include: {
        user: {
          select: {
            nombre: true,
            apellido: true,
          },
        },
      },
    });

    if (!representante) {
      return res.status(404).json({
        error: 'Representante no encontrado.',
      });
    }

    // Verificar que el estudiante y el representante pertenecen a la misma institución
    const studentUser = await prisma.user.findUnique({
      where: { id: student.userId },
      select: { institucionId: true },
    });

    const representanteUser = await prisma.user.findUnique({
      where: { id: representante.userId },
      select: { institucionId: true },
    });

    if (studentUser.institucionId !== representanteUser.institucionId) {
      return res.status(403).json({
        error: 'El estudiante y el representante deben pertenecer a la misma institución.',
      });
    }

    // Asociar el estudiante con el representante
    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: {
        representanteId: representanteId,
      },
      include: {
        user: {
          select: {
            nombre: true,
            apellido: true,
            email: true,
          },
        },
        representante: {
          include: {
            user: {
              select: {
                nombre: true,
                apellido: true,
                email: true,
              },
            },
          },
        },
      },
    });

    res.json({
      message: 'Estudiante asociado exitosamente con el representante.',
      student: updatedStudent,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Desasociar un estudiante de un representante (solo para administradores/secretaría)
 */
export const disassociateStudent = async (req, res, next) => {
  try {
    // Solo administradores y secretaría pueden desasociar estudiantes
    if (!['ADMIN', 'SECRETARIA'].includes(req.user.rol)) {
      return res.status(403).json({
        error: 'No tienes permisos para realizar esta acción.',
      });
    }

    const { studentId } = req.params;

    // Verificar que el estudiante existe
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return res.status(404).json({
        error: 'Estudiante no encontrado.',
      });
    }

    if (!student.representanteId) {
      return res.status(400).json({
        error: 'El estudiante no está asociado a ningún representante.',
      });
    }

    // Desasociar el estudiante
    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: {
        representanteId: null,
      },
      include: {
        user: {
          select: {
            nombre: true,
            apellido: true,
            email: true,
          },
        },
      },
    });

    res.json({
      message: 'Estudiante desasociado exitosamente del representante.',
      student: updatedStudent,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener boletín de calificaciones de un estudiante (solo para representantes)
 */
export const getStudentReportCard = async (req, res, next) => {
  try {
    if (req.user.rol !== 'REPRESENTANTE') {
      return res.status(403).json({
        error: 'Solo los representantes pueden acceder a esta información.',
      });
    }

    const { studentId } = req.params;

    // Verificar que el estudiante pertenece al representante
    const hasAccess = await verifyStudentBelongsToRepresentante(req, studentId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'No tienes acceso a este estudiante.',
      });
    }

    // Obtener el estudiante y su curso
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: {
            nombre: true,
            apellido: true,
            numeroIdentificacion: true,
            email: true,
          },
        },
        grupo: {
          include: {
            periodo: {
              include: {
                subPeriodos: {
                  orderBy: { orden: 'asc' },
                },
              },
            },
            course_subject_assignments: {
              include: {
                materia: {
                  select: {
                    id: true,
                    nombre: true,
                    codigo: true,
                  },
                },
                gradeScale: {
                  include: {
                    detalles: {
                      orderBy: { orden: 'asc' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!student || !student.grupo) {
      return res.status(404).json({
        error: 'Estudiante o curso no encontrado.',
      });
    }

    const curso = student.grupo;
    const materiasConEscala = curso.course_subject_assignments.map(a => ({
      materia: a.materia,
      gradeScale: a.gradeScale,
    }));

    // Obtener todas las calificaciones del estudiante
    const materiaIds = materiasConEscala.map(m => m.materia.id);
    const grades = await prisma.grade.findMany({
      where: {
        estudianteId: studentId,
        materiaId: { in: materiaIds },
      },
      include: {
        materia: {
          select: {
            id: true,
            nombre: true,
            codigo: true,
          },
        },
        subPeriodo: {
          select: {
            id: true,
            nombre: true,
            orden: true,
            ponderacion: true,
            periodo: {
              select: {
                id: true,
                nombre: true,
                orden: true,
                ponderacion: true,
              },
            },
          },
        },
        insumo: {
          select: {
            id: true,
            nombre: true,
            subPeriodo: {
              select: {
                id: true,
                nombre: true,
                orden: true,
                ponderacion: true,
                periodo: {
                  select: {
                    id: true,
                    nombre: true,
                    orden: true,
                    ponderacion: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [
        { materiaId: 'asc' },
        { fechaRegistro: 'desc' },
      ],
    });

    // Importar funciones de cálculo
    const { calculateWeightedAverage, truncate, getGradeScaleEquivalent } = await import('../utils/gradeCalculations.js');

    // Estructurar datos por materia
    const materiasData = materiasConEscala.map(({ materia, gradeScale }) => {
      const materiaGrades = grades.filter(g => g.materiaId === materia.id);
      
      if (materiaGrades.length === 0) {
        return {
          materia: {
            id: materia.id,
            nombre: materia.nombre,
            codigo: materia.codigo,
          },
          gradeScale: gradeScale,
          promediosSubPeriodo: {},
          promediosPeriodo: {},
          promedioGeneral: null,
          equivalenteGeneral: null,
          calificaciones: [],
        };
      }

      // Agrupar calificaciones por subperíodo
      const gradesBySubPeriod = {};
      materiaGrades.forEach(grade => {
        const subPeriodId = grade.subPeriodo?.id || grade.insumo?.subPeriodo?.id || 'general';
        if (!gradesBySubPeriod[subPeriodId]) {
          gradesBySubPeriod[subPeriodId] = {
            subPeriodo: grade.subPeriodo || grade.insumo?.subPeriodo,
            grades: [],
          };
        }
        gradesBySubPeriod[subPeriodId].grades.push(grade);
      });

      // Calcular promedios por subperíodo
      const promediosSubPeriodo = {};
      const promediosPeriodo = {};
      let promedioGeneral = null;

      Object.keys(gradesBySubPeriod).forEach(subPeriodId => {
        const { subPeriodo, grades: subPeriodGrades } = gradesBySubPeriod[subPeriodId];
        if (subPeriodGrades.length > 0) {
          const suma = subPeriodGrades.reduce((acc, g) => acc + g.calificacion, 0);
          const promedio = truncate(suma / subPeriodGrades.length);
          promediosSubPeriodo[subPeriodo?.nombre || 'General'] = promedio;
          
          // Agrupar por período
          if (subPeriodo?.periodo) {
            const periodoNombre = subPeriodo.periodo.nombre;
            if (!promediosPeriodo[periodoNombre]) {
              promediosPeriodo[periodoNombre] = [];
            }
            promediosPeriodo[periodoNombre].push({
              subPeriodo: subPeriodo.nombre,
              promedio: promedio,
              ponderacion: subPeriodo.ponderacion,
            });
          }
        }
      });

      // Calcular promedio general ponderado
      const allGradesWithSubPeriod = materiaGrades.filter(g => g.subPeriodo || g.insumo?.subPeriodo);
      if (allGradesWithSubPeriod.length > 0) {
        const weighted = calculateWeightedAverage(allGradesWithSubPeriod);
        promedioGeneral = weighted.promedioFinal;
      } else if (materiaGrades.length > 0) {
        const suma = materiaGrades.reduce((acc, g) => acc + g.calificacion, 0);
        promedioGeneral = truncate(suma / materiaGrades.length);
      }

      // Obtener equivalente en escala si existe
      let equivalenteGeneral = null;
      if (promedioGeneral !== null && gradeScale) {
        equivalenteGeneral = getGradeScaleEquivalent(promedioGeneral, gradeScale.detalles);
      }

      return {
        materia: {
          id: materia.id,
          nombre: materia.nombre,
          codigo: materia.codigo,
        },
        gradeScale: gradeScale,
        promediosSubPeriodo: promediosSubPeriodo,
        promediosPeriodo: promediosPeriodo,
        promedioGeneral: promedioGeneral,
        equivalenteGeneral: equivalenteGeneral,
        calificaciones: materiaGrades,
      };
    });

    // Calcular promedio general de todas las materias
    const promediosMaterias = materiasData
      .map(m => m.promedioGeneral)
      .filter(p => p !== null);
    const promedioGeneral = promediosMaterias.length > 0
      ? truncate(promediosMaterias.reduce((acc, p) => acc + p, 0) / promediosMaterias.length)
      : null;

    res.json({
      estudiante: {
        id: student.id,
        nombre: student.user.nombre,
        apellido: student.user.apellido,
        numeroIdentificacion: student.user.numeroIdentificacion || '-',
        email: student.user.email || '-',
      },
      curso: {
        id: curso.id,
        nombre: curso.nombre,
        nivel: curso.nivel,
        paralelo: curso.paralelo,
        periodo: curso.periodo?.nombre || '-',
      },
      materias: materiasData,
      promedioGeneral: promedioGeneral,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener reporte de calificaciones de un estudiante (solo para representantes)
 */
export const getStudentGradeReport = async (req, res, next) => {
  try {
    if (req.user.rol !== 'REPRESENTANTE') {
      return res.status(403).json({
        error: 'Solo los representantes pueden acceder a esta información.',
      });
    }

    const { studentId } = req.params;
    const { periodoId, materiaId } = req.query;

    // Verificar que el estudiante pertenece al representante
    const hasAccess = await verifyStudentBelongsToRepresentante(req, studentId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'No tienes acceso a este estudiante.',
      });
    }

    // Obtener el estudiante
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: {
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

    if (!student) {
      return res.status(404).json({
        error: 'Estudiante no encontrado.',
      });
    }

    // Construir filtros
    const where = {
      estudianteId: studentId,
    };

    if (materiaId) where.materiaId = materiaId;
    if (periodoId) {
      where.subPeriodo = {
        periodoId: periodoId,
      };
    }

    const grades = await prisma.grade.findMany({
      where,
      include: {
        materia: {
          select: {
            id: true,
            nombre: true,
            codigo: true,
          },
        },
        subPeriodo: {
          include: {
            periodo: {
              select: {
                id: true,
                nombre: true,
                anioEscolar: true,
                orden: true,
              },
            },
          },
        },
        insumo: {
          select: {
            id: true,
            nombre: true,
            descripcion: true,
            fechaDeber: true,
            fechaEntrega: true,
          },
        },
      },
      orderBy: [
        { materia: { nombre: 'asc' } },
        { subPeriodo: { orden: 'asc' } },
        { fechaRegistro: 'desc' },
      ],
    });

    // Agrupar por materia
    const gradesBySubject = {};
    grades.forEach(grade => {
      const materiaId = grade.materiaId;
      if (!gradesBySubject[materiaId]) {
        gradesBySubject[materiaId] = {
          materia: grade.materia,
          grades: [],
        };
      }
      gradesBySubject[materiaId].grades.push(grade);
    });

    // Calcular estadísticas por materia
    Object.keys(gradesBySubject).forEach(materiaId => {
      const materiaData = gradesBySubject[materiaId];
      const materiaGrades = materiaData.grades;
      
      if (materiaGrades.length > 0) {
        const suma = materiaGrades.reduce((acc, g) => acc + g.calificacion, 0);
        materiaData.promedio = suma / materiaGrades.length;
        materiaData.total = materiaGrades.length;
        materiaData.maxima = Math.max(...materiaGrades.map(g => g.calificacion));
        materiaData.minima = Math.min(...materiaGrades.map(g => g.calificacion));
      }
    });

    res.json({
      estudiante: {
        id: student.id,
        nombre: student.user.nombre,
        apellido: student.user.apellido,
        numeroIdentificacion: student.user.numeroIdentificacion,
      },
      curso: student.grupo,
      resumenPorMateria: Object.values(gradesBySubject),
      calificaciones: grades,
      totalCalificaciones: grades.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar representantes (solo para administradores/secretaría)
 */
export const searchRepresentantes = async (req, res, next) => {
  try {
    // Solo administradores y secretaría pueden buscar representantes
    if (!['ADMIN', 'SECRETARIA'].includes(req.user.rol)) {
      return res.status(403).json({
        error: 'No tienes permisos para realizar esta acción.',
      });
    }

    const { query } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        error: 'La búsqueda debe tener al menos 2 caracteres.',
      });
    }

    const searchTerm = query.trim().toLowerCase();

    // Buscar representantes por nombre, apellido, número de identificación o email
    const representantes = await prisma.representante.findMany({
      where: {
        user: {
          OR: [
            { nombre: { contains: searchTerm, mode: 'insensitive' } },
            { apellido: { contains: searchTerm, mode: 'insensitive' } },
            { email: { contains: searchTerm, mode: 'insensitive' } },
            { numeroIdentificacion: { contains: searchTerm, mode: 'insensitive' } },
          ],
          estado: 'ACTIVO',
        },
      },
      include: {
        user: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            telefono: true,
            numeroIdentificacion: true,
          },
        },
        students: {
          where: {
            retirado: false,
          },
          select: {
            id: true,
            user: {
              select: {
                nombre: true,
                apellido: true,
              },
            },
          },
        },
      },
      take: 20,
      orderBy: [
        { user: { apellido: 'asc' } },
        { user: { nombre: 'asc' } },
      ],
    });

    res.json({
      data: representantes,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar estudiantes para asociar (solo para administradores/secretaría)
 */
export const searchStudents = async (req, res, next) => {
  try {
    // Solo administradores y secretaría pueden buscar estudiantes
    if (!['ADMIN', 'SECRETARIA'].includes(req.user.rol)) {
      return res.status(403).json({
        error: 'No tienes permisos para realizar esta acción.',
      });
    }

    const { query, representanteId } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        error: 'La búsqueda debe tener al menos 2 caracteres.',
      });
    }

    const searchTerm = query.trim().toLowerCase();

    // Buscar estudiantes por nombre, apellido, número de identificación o email
    const students = await prisma.student.findMany({
      where: {
        OR: [
          {
            user: {
              OR: [
                { nombre: { contains: searchTerm, mode: 'insensitive' } },
                { apellido: { contains: searchTerm, mode: 'insensitive' } },
                { email: { contains: searchTerm, mode: 'insensitive' } },
                { numeroIdentificacion: { contains: searchTerm, mode: 'insensitive' } },
              ],
            },
          },
        ],
        retirado: false,
      },
      include: {
        user: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
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
        representante: {
          include: {
            user: {
              select: {
                nombre: true,
                apellido: true,
              },
            },
          },
        },
      },
      take: 20,
      orderBy: [
        { user: { apellido: 'asc' } },
        { user: { nombre: 'asc' } },
      ],
    });

    // Si se proporciona representanteId, filtrar solo estudiantes que no estén asociados o que estén asociados a ese representante
    let filteredStudents = students;
    if (representanteId) {
      filteredStudents = students.filter(s => 
        !s.representanteId || s.representanteId === representanteId
      );
    }

    res.json({
      data: filteredStudents,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Descargar plantilla Excel para carga masiva de asociaciones
 */
export const downloadBulkTemplate = async (req, res, next) => {
  try {
    // Solo administradores y secretaría pueden descargar la plantilla
    if (!['ADMIN', 'SECRETARIA'].includes(req.user.rol)) {
      return res.status(403).json({
        error: 'No tienes permisos para realizar esta acción.',
      });
    }
    
    // Crear datos de ejemplo
    const data = [
      { cedula_estudiante: '1234567890', cedula_representante: '0987654321' },
      { cedula_estudiante: '1111111111', cedula_representante: '2222222222' },
      { cedula_estudiante: '3333333333', cedula_representante: '4444444444' },
    ];

    // Crear hoja de cálculo
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Asociaciones');

    // Generar buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Enviar archivo
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=plantilla_asociaciones.xlsx');
    res.send(buffer);
  } catch (error) {
    console.error('Error al generar plantilla:', error);
    next(error);
  }
};

/**
 * Procesar carga masiva de asociaciones estudiante-representante
 */
export const bulkAssociate = async (req, res, next) => {
  try {
    // Solo administradores y secretaría pueden hacer carga masiva
    if (!['ADMIN', 'SECRETARIA'].includes(req.user.rol)) {
      return res.status(403).json({
        error: 'No tienes permisos para realizar esta acción.',
      });
    }

    const { asociaciones } = req.body;

    if (!Array.isArray(asociaciones) || asociaciones.length === 0) {
      return res.status(400).json({
        error: 'Debe proporcionar un array de asociaciones.',
      });
    }

    const resultados = {
      exitosos: [],
      errores: [],
      omitidos: [],
    };

    // Procesar cada asociación
    for (let i = 0; i < asociaciones.length; i++) {
      const { cedulaEstudiante, cedulaRepresentante } = asociaciones[i];
      const lineNumber = i + 2; // +2 porque empezamos en fila 2 del Excel (fila 1 son headers)

      try {
        // Validar que se proporcionaron ambos campos
        if (!cedulaEstudiante || !cedulaRepresentante) {
          resultados.errores.push({
            linea: lineNumber,
            cedulaEstudiante: cedulaEstudiante || 'N/A',
            cedulaRepresentante: cedulaRepresentante || 'N/A',
            error: 'Faltan datos obligatorios (cédula estudiante o representante)',
          });
          continue;
        }

        // Buscar estudiante por número de identificación
        const estudiante = await prisma.student.findFirst({
          where: {
            user: {
              numeroIdentificacion: String(cedulaEstudiante).trim(),
            },
            retirado: false,
          },
          include: {
            user: {
              select: {
                id: true,
                nombre: true,
                apellido: true,
                numeroIdentificacion: true,
                institucionId: true,
              },
            },
            representante: {
              include: {
                user: {
                  select: {
                    nombre: true,
                    apellido: true,
                  },
                },
              },
            },
          },
        });

        if (!estudiante) {
          resultados.errores.push({
            linea: lineNumber,
            cedulaEstudiante: String(cedulaEstudiante),
            cedulaRepresentante: String(cedulaRepresentante),
            error: `Estudiante con cédula ${cedulaEstudiante} no encontrado`,
          });
          continue;
        }

        // Buscar representante por número de identificación
        const representante = await prisma.representante.findFirst({
          where: {
            user: {
              numeroIdentificacion: String(cedulaRepresentante).trim(),
              estado: 'ACTIVO',
            },
          },
          include: {
            user: {
              select: {
                id: true,
                nombre: true,
                apellido: true,
                numeroIdentificacion: true,
                institucionId: true,
              },
            },
          },
        });

        if (!representante) {
          resultados.errores.push({
            linea: lineNumber,
            cedulaEstudiante: String(cedulaEstudiante),
            cedulaRepresentante: String(cedulaRepresentante),
            error: `Representante con cédula ${cedulaRepresentante} no encontrado`,
          });
          continue;
        }

        // Verificar que pertenecen a la misma institución
        if (estudiante.user.institucionId !== representante.user.institucionId) {
          resultados.errores.push({
            linea: lineNumber,
            cedulaEstudiante: String(cedulaEstudiante),
            cedulaRepresentante: String(cedulaRepresentante),
            error: 'El estudiante y el representante pertenecen a diferentes instituciones',
          });
          continue;
        }

        // Verificar si el estudiante ya tiene este representante asignado
        if (estudiante.representanteId === representante.id) {
          resultados.omitidos.push({
            linea: lineNumber,
            estudiante: `${estudiante.user.nombre} ${estudiante.user.apellido}`,
            cedulaEstudiante: estudiante.user.numeroIdentificacion,
            representante: `${representante.user.nombre} ${representante.user.apellido}`,
            cedulaRepresentante: representante.user.numeroIdentificacion,
            razon: 'Ya está asociado con este representante',
          });
          continue;
        }

        // Asociar el estudiante con el representante
        await prisma.student.update({
          where: { id: estudiante.id },
          data: {
            representanteId: representante.id,
          },
        });

        resultados.exitosos.push({
          linea: lineNumber,
          estudiante: `${estudiante.user.nombre} ${estudiante.user.apellido}`,
          cedulaEstudiante: estudiante.user.numeroIdentificacion,
          representante: `${representante.user.nombre} ${representante.user.apellido}`,
          cedulaRepresentante: representante.user.numeroIdentificacion,
          representanteAnterior: estudiante.representante
            ? `${estudiante.representante.user.nombre} ${estudiante.representante.user.apellido}`
            : 'Ninguno',
        });
      } catch (error) {
        resultados.errores.push({
          linea: lineNumber,
          cedulaEstudiante: String(cedulaEstudiante),
          cedulaRepresentante: String(cedulaRepresentante),
          error: error.message || 'Error al procesar esta asociación',
        });
      }
    }

    res.json({
      message: 'Procesamiento de carga masiva completado',
      resumen: {
        total: asociaciones.length,
        exitosos: resultados.exitosos.length,
        errores: resultados.errores.length,
        omitidos: resultados.omitidos.length,
      },
      detalles: resultados,
    });
  } catch (error) {
    next(error);
  }
};