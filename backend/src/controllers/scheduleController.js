import prisma from '../config/database.js';
import { verifyCourseBelongsToInstitution, getCourseSubjectAssignmentInstitutionFilter } from '../utils/institutionFilter.js';

/**
 * Obtener horarios según el rol del usuario
 */
export const getSchedules = async (req, res, next) => {
  try {
    const { cursoId, docenteId } = req.query;
    const userRole = req.user.rol;
    const userId = req.user.id;

    let schedules = [];

    if (userRole === 'ESTUDIANTE') {
      // Para estudiantes: mostrar horario del curso al que pertenecen
      const student = await prisma.student.findUnique({
        where: { userId },
        include: {
          grupo: {
            include: {
              course_subject_assignments: {
                include: {
                  materia: true,
                  docente: {
                    include: {
                      user: true,
                    },
                  },
                  horarios: {
                    orderBy: [
                      { hora: 'asc' },
                      { diaSemana: 'asc' },
                    ],
                  },
                },
              },
            },
          },
        },
      });

      if (!student || !student.grupo) {
        return res.json({ data: [] });
      }

      // Formatear horarios para el estudiante
      schedules = student.grupo.course_subject_assignments.flatMap(assignment => 
        assignment.horarios.map(horario => ({
          id: horario.id,
          hora: horario.hora,
          diaSemana: horario.diaSemana,
          materia: {
            id: assignment.materia.id,
            nombre: assignment.materia.nombre,
            codigo: assignment.materia.codigo,
          },
          docente: {
            id: assignment.docente.id,
            nombre: assignment.docente.user?.nombre,
            apellido: assignment.docente.user?.apellido,
            email: assignment.docente.user?.email,
          },
          curso: {
            id: student.grupo.id,
            nombre: student.grupo.nombre,
            nivel: student.grupo.nivel,
            paralelo: student.grupo.paralelo,
          },
        }))
      );

    } else if (userRole === 'PROFESOR') {
      // Para profesores: mostrar horarios de sus asignaciones
      const teacher = await prisma.teacher.findUnique({
        where: { userId },
        include: {
          course_subject_assignments: {
            where: cursoId ? { cursoId } : undefined,
            include: {
              materia: true,
              curso: {
                include: {
                  periodo: true,
                },
              },
              horarios: {
                orderBy: [
                  { hora: 'asc' },
                  { diaSemana: 'asc' },
                ],
              },
            },
          },
        },
      });

      if (!teacher) {
        return res.json({ data: [] });
      }

      // Formatear horarios para el profesor
      schedules = teacher.course_subject_assignments.flatMap(assignment => 
        assignment.horarios.map(horario => ({
          id: horario.id,
          hora: horario.hora,
          diaSemana: horario.diaSemana,
          materia: {
            id: assignment.materia.id,
            nombre: assignment.materia.nombre,
            codigo: assignment.materia.codigo,
          },
          curso: {
            id: assignment.curso.id,
            nombre: assignment.curso.nombre,
            nivel: assignment.curso.nivel,
            paralelo: assignment.curso.paralelo,
            periodo: assignment.curso.periodo,
          },
        }))
      );

    } else if (userRole === 'ADMIN' || userRole === 'SECRETARIA') {
      // Para admin/secretaria: mostrar todos los horarios con filtros opcionales
      const where = {};
      
      if (cursoId) {
        where.cursoId = cursoId;
      } else {
        // Filtrar por institución si no se especifica curso
        const institutionFilter = await getCourseSubjectAssignmentInstitutionFilter(req, prisma);
        if (Object.keys(institutionFilter).length > 0) {
          if (institutionFilter.cursoId?.in && institutionFilter.cursoId.in.length === 0) {
            return res.json({ data: [] });
          }
          Object.assign(where, institutionFilter);
        }
      }

      if (docenteId) {
        where.docenteId = docenteId;
      }

      const assignments = await prisma.courseSubjectAssignment.findMany({
        where,
        include: {
          materia: true,
          docente: {
            include: {
              user: true,
            },
          },
          curso: {
            include: {
              periodo: true,
            },
          },
          horarios: {
            orderBy: [
              { hora: 'asc' },
              { diaSemana: 'asc' },
            ],
          },
        },
      });

      // Formatear horarios para admin/secretaria
      schedules = assignments.flatMap(assignment => 
        assignment.horarios.map(horario => ({
          id: horario.id,
          hora: horario.hora,
          diaSemana: horario.diaSemana,
          materia: {
            id: assignment.materia.id,
            nombre: assignment.materia.nombre,
            codigo: assignment.materia.codigo,
          },
          docente: {
            id: assignment.docente.id,
            nombre: assignment.docente.user?.nombre,
            apellido: assignment.docente.user?.apellido,
            email: assignment.docente.user?.email,
          },
          curso: {
            id: assignment.curso.id,
            nombre: assignment.curso.nombre,
            nivel: assignment.curso.nivel,
            paralelo: assignment.curso.paralelo,
            periodo: assignment.curso.periodo,
          },
        }))
      );
    } else {
      return res.status(403).json({
        error: 'No tienes permiso para ver horarios.',
      });
    }

    res.json({ data: schedules });
  } catch (error) {
    next(error);
  }
};

