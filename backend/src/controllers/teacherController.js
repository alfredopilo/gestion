import prisma from '../config/database.js';
import { getTeacherInstitutionFilter, getCourseInstitutionFilter } from '../utils/institutionFilter.js';

/**
 * Obtener todos los profesores (teachers)
 */
export const getTeachers = async (req, res, next) => {
  try {
    const { limit } = req.query;
    
    // Filtrar por institución (ya incluye el filtro de estado ACTIVO)
    const institutionFilter = getTeacherInstitutionFilter(req);
    console.log('Filtro de docentes:', JSON.stringify({
      selectedInstitutionId: req.institutionId ?? null,
      accessibleInstitutionIds: req.user?.accessibleInstitutionIds ?? [],
      where: institutionFilter,
    }, null, 2));
    
    const teachers = await prisma.teacher.findMany({
      include: {
        user: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            estado: true,
            institucionId: true,
          },
        },
      },
      where: institutionFilter,
      orderBy: {
        createdAt: 'desc',
      },
      ...(limit && { take: parseInt(limit) }),
    });

    // Filtrar solo los que tienen usuario y están activos (doble verificación)
    const validTeachers = teachers.filter(teacher => 
      teacher.user && teacher.user.estado === 'ACTIVO'
    );

    res.json({
      data: validTeachers,
      total: validTeachers.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener las asignaciones (cursos y materias) del docente actual
 */
export const getMyAssignments = async (req, res, next) => {
  try {
    // Verificar que el usuario es un profesor
    if (req.user.rol !== 'PROFESOR') {
      return res.status(403).json({
        error: 'Solo los profesores pueden acceder a sus asignaciones.',
      });
    }

    // Obtener el teacher del usuario actual
    const teacher = await prisma.teacher.findUnique({
      where: { userId: req.user.id },
    });

    if (!teacher) {
      return res.status(404).json({
        error: 'No se encontró el registro de profesor.',
      });
    }

    // Filtrar por institución a través de los cursos
    const courseFilter = await getCourseInstitutionFilter(req, prisma);
    const courseIds = courseFilter.anioLectivoId?.in 
      ? (await prisma.course.findMany({
          where: courseFilter,
          select: { id: true },
        })).map(c => c.id)
      : [];

    // Si no hay cursos de la institución, retornar vacío (excepto para ADMIN)
    if (courseIds.length === 0 && req.user?.rol !== 'ADMIN') {
      return res.json({
        data: [],
        total: 0,
      });
    }

    // Obtener todas las asignaciones del docente filtradas por institución
    const whereClause = {
      docenteId: teacher.id,
    };

    // Si hay filtro de institución, aplicarlo
    if (courseIds.length > 0) {
      whereClause.cursoId = { in: courseIds };
    }

    const assignments = await prisma.courseSubjectAssignment.findMany({
      where: whereClause,
      include: {
        curso: {
          include: {
            periodo: true,
            anioLectivo: {
              select: {
                id: true,
                nombre: true,
                activo: true,
              },
            },
          },
        },
        materia: {
          select: {
            id: true,
            nombre: true,
            codigo: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Agrupar por curso y materia
    const groupedAssignments = {};
    assignments.forEach(assignment => {
      const cursoId = assignment.curso.id;
      if (!groupedAssignments[cursoId]) {
        groupedAssignments[cursoId] = {
          curso: {
            id: assignment.curso.id,
            nombre: assignment.curso.nombre,
            nivel: assignment.curso.nivel,
            paralelo: assignment.curso.paralelo,
            periodo: assignment.curso.periodo,
            anioLectivo: assignment.curso.anioLectivo,
          },
          materias: [],
        };
      }
      groupedAssignments[cursoId].materias.push({
        id: assignment.materia.id,
        nombre: assignment.materia.nombre,
        codigo: assignment.materia.codigo,
        assignmentId: assignment.id,
      });
    });

    res.json({
      data: Object.values(groupedAssignments),
      total: assignments.length,
    });
  } catch (error) {
    next(error);
  }
};

