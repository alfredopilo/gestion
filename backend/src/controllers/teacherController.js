import prisma from '../config/database.js';
import { getTeacherInstitutionFilter } from '../utils/institutionFilter.js';

/**
 * Obtener todos los profesores (teachers)
 */
export const getTeachers = async (req, res, next) => {
  try {
    const { limit } = req.query;
    
    // Filtrar por institución
    const institutionFilter = getTeacherInstitutionFilter(req);
  console.log('Filtro de docentes:', JSON.stringify({
    selectedInstitutionId: req.institutionId ?? null,
    accessibleInstitutionIds: req.user?.accessibleInstitutionIds ?? [],
    where: institutionFilter,
  }, null, 2));
    const where = {
      user: {
        estado: 'ACTIVO', // Solo docentes con usuarios activos
        ...(institutionFilter.user ? institutionFilter.user : {}),
      },
    };
    
    const teachers = await prisma.teacher.findMany({
      include: {
        user: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            estado: true,
          },
        },
      },
      where,
      orderBy: {
        createdAt: 'desc',
      },
      ...(limit && { take: parseInt(limit) }),
    });

    // Filtrar solo los que tienen usuario y están activos
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

