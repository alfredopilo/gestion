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
    console.log('🎯 =====GET MY ASSIGNMENTS INICIADO=====');
    console.log('👤 Usuario:', { id: req.user.id, email: req.user.email, rol: req.user.rol });
    console.log('🏢 Institución en request:', req.institutionId);
    
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
      console.log('❌ No se encontró el registro de teacher para el usuario');
      return res.status(404).json({
        error: 'No se encontró el registro de profesor.',
      });
    }

    console.log('🔍 Teacher encontrado:', { id: teacher.id, userId: teacher.userId });

    // Filtrar por institución a través de los cursos
    const courseFilter = await getCourseInstitutionFilter(req, prisma);
    console.log('🔍 Course filter aplicado:', JSON.stringify(courseFilter, null, 2));
    
    // Obtener todos los cursos que cumplen con el filtro
    let courseIds = [];
    if (Object.keys(courseFilter).length > 0) {
      // Si hay filtro, buscar cursos que cumplan el filtro
      const courses = await prisma.course.findMany({
        where: courseFilter,
        select: { id: true },
      });
      courseIds = courses.map(c => c.id);
    }

    console.log('🔍 Course IDs filtrados:', courseIds.length, courseIds);

    // Obtener todas las asignaciones del docente
    const whereClause = {
      docenteId: teacher.id,
    };

    // Si hay filtro de cursos específicos, aplicarlo
    if (courseIds.length > 0) {
      whereClause.cursoId = { in: courseIds };
    } else if (Object.keys(courseFilter).length > 0 && req.user?.rol !== 'ADMIN') {
      // Si hay filtro pero no hay cursos que lo cumplan, retornar vacío
      console.log('⚠️ No se encontraron cursos para la institución del docente');
      return res.json({
        data: [],
        total: 0,
      });
    }

    console.log('🔍 Where clause para asignaciones:', JSON.stringify(whereClause, null, 2));

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
            _count: {
              select: {
                estudiantes: true,
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

    console.log('✅ Asignaciones encontradas:', assignments.length);
    if (assignments.length > 0) {
      console.log('📚 Primera asignación:', {
        curso: assignments[0].curso.nombre,
        materia: assignments[0].materia.nombre,
      });
    }

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
            _count: assignment.curso._count,
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

    const result = Object.values(groupedAssignments);
    console.log('📤 Respuesta final:', { total: result.length, data: result });

    res.json({
      data: result,
      total: assignments.length,
    });
  } catch (error) {
    console.error('💥 Error en getMyAssignments:', error);
    next(error);
  }
};

