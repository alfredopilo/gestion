export const getAccessibleInstitutionIds = (req) => {
  if (!req) return [];

  const ids = new Set();

  if (req.institutionId) {
    ids.add(req.institutionId);
  }

  const institutionList = Array.isArray(req.user?.instituciones)
    ? req.user.instituciones
    : Object.values(req.user?.instituciones ?? {});

  if (institutionList.length > 0) {
    for (const inst of institutionList) {
      if (inst?.id) {
        ids.add(inst.id);
      }
    }
  }

  if (ids.size === 0 && req.user?.institucionId) {
    ids.add(req.user.institucionId);
  }

  return Array.from(ids);
};
/**
 * Utilidades para filtrar datos por institución
 */

/**
 * Obtiene el ID de la institución a usar para filtrar
 * Prioriza: institución del usuario > institución activa del sistema
 */
export const getInstitutionFilter = (req) => {
  return req.institutionId || null;
};

/**
 * Obtiene el año escolar activo de la institución seleccionada
 * Cada institución tiene su propio año escolar activo
 */
export const getActiveSchoolYear = async (req, prisma) => {
  try {
    const institutionId = getInstitutionFilter(req);
    
    if (!institutionId) {
      // Si no hay institución seleccionada, buscar el año activo más reciente (solo para ADMIN)
      if (req.user?.rol === 'ADMIN') {
        const globalActive = await prisma.schoolYear.findFirst({
          where: { activo: true },
          include: {
            institucion: {
              select: { id: true, nombre: true },
            },
          },
          orderBy: { updatedAt: 'desc' },
        });
        
        if (globalActive) {
          return globalActive;
        }
      }
      return null;
    }
    
    // Buscar el año escolar activo de la institución seleccionada
    const activeSchoolYear = await prisma.schoolYear.findFirst({
      where: {
        institucionId: institutionId,
        activo: true,
      },
      include: {
        institucion: {
          select: { id: true, nombre: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (activeSchoolYear) {
      return activeSchoolYear;
    }

    // Si no hay activo, devolver el año escolar más reciente de la institución
    const latestSchoolYear = await prisma.schoolYear.findFirst({
      where: { institucionId: institutionId },
      include: {
        institucion: {
          select: { id: true, nombre: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return latestSchoolYear ?? null;
  } catch (error) {
    console.error('Error al obtener año escolar activo:', error);
    return null;
  }
};

/**
 * Construye un filtro para SchoolYear basado en la institución
 */
export const getSchoolYearInstitutionFilter = (req) => {
  const institutionId = getInstitutionFilter(req);
  if (!institutionId) {
    // Si no hay institución, no filtrar (mostrar todo para ADMIN)
    if (req.user?.rol === 'ADMIN') return {};
    // Para otros usuarios, no mostrar nada si no hay institución
    return { institucionId: { in: [] } };
  }
  
  return {
    institucionId: institutionId,
  };
};

/**
 * Construye un filtro para Period basado en la institución
 * Solo muestra períodos del año escolar activo de la institución actual
 */
export const getPeriodInstitutionFilter = async (req, prisma) => {
  const institutionId = getInstitutionFilter(req);
  if (!institutionId) {
    // Si no hay institución, no filtrar (mostrar todo para ADMIN)
    if (req.user?.rol === 'ADMIN') return {};
    // Para otros usuarios, no mostrar nada si no hay institución
    return { anioLectivoId: { in: [] } };
  }
  
  try {
    // Obtener el año escolar activo de la institución seleccionada
    const activeSchoolYear = await getActiveSchoolYear(req, prisma);
    
    if (activeSchoolYear && activeSchoolYear.institucionId === institutionId) {
      // Filtrar solo períodos del año activo de la institución
      return {
        anioLectivoId: activeSchoolYear.id,
      };
    }
    
    // Si no hay año activo para la institución, no mostrar períodos
    return { anioLectivoId: { in: [] } };
  } catch (error) {
    console.error('Error al obtener filtro de períodos por institución:', error);
    return { anioLectivoId: { in: [] } };
  }
};

/**
 * Construye un filtro para Course basado en la institución
 * Cada institución tiene su propio año escolar activo
 * Los cursos se filtran por: año escolar activo de la institución
 */
export const getCourseInstitutionFilter = async (req, prisma) => {
  const institutionId = getInstitutionFilter(req);
  if (!institutionId) {
    // Si no hay institución, no filtrar (mostrar todo para ADMIN)
    if (req.user?.rol === 'ADMIN') return {};
    // Para otros usuarios, no mostrar nada si no hay institución
    return { anioLectivoId: { in: [] } };
  }
  
  try {
    // Obtener el año escolar activo de la institución seleccionada
    const activeSchoolYear = await getActiveSchoolYear(req, prisma);
    
    if (activeSchoolYear) {
      // Verificar que el año activo pertenece a la institución seleccionada
      if (activeSchoolYear.institucionId === institutionId) {
        // Filtrar cursos del año activo de la institución
        return {
          anioLectivoId: activeSchoolYear.id,
        };
      } else {
        // Si el año activo no pertenece a la institución, no mostrar cursos
        return { anioLectivoId: { in: [] } };
      }
    }
    
    // Si no hay año activo para la institución, no mostrar cursos
    return { anioLectivoId: { in: [] } };
  } catch (error) {
    console.error('Error al obtener filtro de cursos por institución:', error);
    return { anioLectivoId: { in: [] } };
  }
};

/**
 * Construye un filtro para Student basado en la institución
 * A través de user -> institucionId o curso -> periodo -> anioLectivo -> institucionId
 */
export const getStudentInstitutionFilter = async (req, prisma) => {
  const institutionId = getInstitutionFilter(req);
  if (!institutionId) {
    // Si no hay institución, no filtrar (mostrar todo para ADMIN)
    if (req.user?.rol === 'ADMIN') return {};
    // Para otros usuarios, no mostrar nada si no hay institución
    return { userId: { in: [] } };
  }
  
  try {
    // Obtener usuarios de la institución
    const usersInInstitution = await prisma.user.findMany({
      where: { institucionId: institutionId },
      select: { id: true },
    });
    
    const userIds = usersInInstitution.map(u => u.id);
    
    if (userIds.length === 0) {
      return { userId: { in: [] } };
    }
    
    return {
      userId: { in: userIds },
    };
  } catch (error) {
    console.error('Error al obtener filtro de estudiantes por institución:', error);
    return { userId: { in: [] } };
  }
};

/**
 * Construye un filtro para User basado en la institución
 * Muestra usuarios que tienen acceso a la institución seleccionada:
 * - Usuarios cuya institución principal es la seleccionada
 * - Usuarios que tienen acceso a través de UserInstitution (relación many-to-many)
 */
export const getUserInstitutionFilter = (req) => {
  const institutionId = getInstitutionFilter(req);
  if (!institutionId) {
    // Si no hay institución, no filtrar (mostrar todo para ADMIN)
    if (req.user?.rol === 'ADMIN') return {};
    // Para otros usuarios, no mostrar nada si no hay institución
    return { 
      OR: [
        { institucionId: { in: [] } },
        { userInstitutions: { none: {} } }
      ]
    };
  }
  
  // Filtrar usuarios que tienen acceso a la institución seleccionada
  return {
    OR: [
      { institucionId: institutionId },
      {
        userInstitutions: {
          some: {
            institucionId: institutionId,
          },
        },
      },
    ],
  };
};

/**
 * Construye un filtro para Payment basado en la institución
 * A través de estudiante -> user -> institucionId
 */
export const getPaymentInstitutionFilter = async (req, prisma) => {
  const institutionId = getInstitutionFilter(req);
  if (!institutionId) {
    if (req.user?.rol === 'ADMIN') return {};
    return { estudianteId: { in: [] } };
  }
  
  try {
    // Obtener estudiantes de la institución
    const students = await prisma.student.findMany({
      where: {
        user: {
          institucionId: institutionId,
        },
      },
      select: { id: true },
    });
    
    const studentIds = students.map(s => s.id);
    
    if (studentIds.length === 0) {
      return { estudianteId: { in: [] } };
    }
    
    return {
      estudianteId: { in: studentIds },
    };
  } catch (error) {
    console.error('Error al obtener filtro de pagos por institución:', error);
    return { estudianteId: { in: [] } };
  }
};

/**
 * Construye un filtro para Grade basado en la institución
 * A través de estudiante -> user -> institucionId
 */
export const getGradeInstitutionFilter = async (req, prisma) => {
  const institutionId = getInstitutionFilter(req);
  if (!institutionId) {
    if (req.user?.rol === 'ADMIN') return {};
    return { estudianteId: { in: [] } };
  }
  
  try {
    // Obtener estudiantes de la institución
    const students = await prisma.student.findMany({
      where: {
        user: {
          institucionId: institutionId,
        },
      },
      select: { id: true },
    });
    
    const studentIds = students.map(s => s.id);
    
    if (studentIds.length === 0) {
      return { estudianteId: { in: [] } };
    }
    
    return {
      estudianteId: { in: studentIds },
    };
  } catch (error) {
    console.error('Error al obtener filtro de calificaciones por institución:', error);
    return { estudianteId: { in: [] } };
  }
};

/**
 * Construye un filtro para Attendance basado en la institución
 * A través de estudiante -> user -> institucionId
 */
export const getAttendanceInstitutionFilter = async (req, prisma) => {
  const institutionId = getInstitutionFilter(req);
  if (!institutionId) {
    if (req.user?.rol === 'ADMIN') return {};
    return { estudianteId: { in: [] } };
  }
  
  try {
    // Obtener estudiantes de la institución
    const students = await prisma.student.findMany({
      where: {
        user: {
          institucionId: institutionId,
        },
      },
      select: { id: true },
    });
    
    const studentIds = students.map(s => s.id);
    
    if (studentIds.length === 0) {
      return { estudianteId: { in: [] } };
    }
    
    return {
      estudianteId: { in: studentIds },
    };
  } catch (error) {
    console.error('Error al obtener filtro de asistencia por institución:', error);
    return { estudianteId: { in: [] } };
  }
};

/**
 * Construye un filtro para Teacher basado en la institución
 * A través de user -> institucionId
 */
export const getTeacherInstitutionFilter = (req) => {
  // Prioridad: header x-institution-id > req.institutionId > accessibleInstitutionIds
  const selectedInstitutionId =
    req?.headers?.['x-institution-id']?.toString() ||
    req?.institutionId ||
    getInstitutionFilter(req);
  
  if (selectedInstitutionId) {
    return {
      user: {
        estado: 'ACTIVO',
        OR: [
          { institucionId: selectedInstitutionId },
          {
            userInstitutions: {
              some: {
                institucionId: selectedInstitutionId,
              },
            },
          },
        ],
      },
    };
  }

  // Si no hay institución seleccionada, usar las instituciones accesibles
  const institutionIds = getAccessibleInstitutionIds(req);
  if (!institutionIds || institutionIds.length === 0) {
    // Si es ADMIN y no hay institución seleccionada, mostrar todos los docentes activos
    if (req.user?.rol === 'ADMIN') {
      return {
        user: {
          estado: 'ACTIVO',
        },
      };
    }
    // Si no es ADMIN y no tiene instituciones accesibles, no mostrar nada
    // Usar un filtro que no devuelva resultados de manera segura
    return { id: '00000000-0000-0000-0000-000000000000' };
  }

  // Filtrar por las instituciones accesibles
  return {
    user: {
      estado: 'ACTIVO',
      OR: [
        { institucionId: { in: institutionIds } },
        {
          userInstitutions: {
            some: {
              institucionId: { in: institutionIds },
            },
          },
        },
      ],
    },
  };
};

/**
 * Construye un filtro para Subject basado en la institución y año escolar
 * Las materias ahora están directamente relacionadas con institución y año escolar
 */
export const getSubjectInstitutionFilter = async (req, prisma) => {
  const institutionId = getInstitutionFilter(req);
  if (!institutionId) {
    if (req.user?.rol === 'ADMIN') return {};
    // Si no hay institución y no es ADMIN, no mostrar nada
    return { institucionId: { in: [] } };
  }
  
  try {
    // Obtener año lectivo activo de la institución por defecto
    const activeSchoolYear = await prisma.schoolYear.findFirst({
      where: {
        institucionId: institutionId,
        activo: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Filtrar por institución y año escolar activo
    if (activeSchoolYear) {
      return {
        institucionId: institutionId,
        anioLectivoId: activeSchoolYear.id,
      };
    }

    // Si no hay año activo, mostrar todas las materias de la institución
    return {
      institucionId: institutionId,
    };
  } catch (error) {
    console.error('Error al obtener filtro de materias por institución:', error);
    return { institucionId: { in: [] } };
  }
};

/**
 * Construye un filtro para Insumo basado en la institución
 * A través de curso -> anioLectivo -> institucionId
 */
export const getInsumoInstitutionFilter = async (req, prisma) => {
  const institutionId = getInstitutionFilter(req);
  if (!institutionId) {
    if (req.user?.rol === 'ADMIN') return {};
    return { cursoId: { in: [] } };
  }
  
  try {
    // Reutilizar la lógica de cursos para obtener los cursos de la institución
    const courseFilter = await getCourseInstitutionFilter(req, prisma);
    
    if (courseFilter.anioLectivoId?.in && courseFilter.anioLectivoId.in.length === 0) {
      return { cursoId: { in: [] } };
    }
    
    // Obtener cursos de esos años lectivos
    const courses = await prisma.course.findMany({
      where: courseFilter,
      select: { id: true },
    });
    
    const courseIds = courses.map(c => c.id);
    
    if (courseIds.length === 0) {
      return { cursoId: { in: [] } };
    }
    
    return {
      cursoId: { in: courseIds },
    };
  } catch (error) {
    console.error('Error al obtener filtro de insumos por institución:', error);
    return { cursoId: { in: [] } };
  }
};

/**
 * Construye un filtro para CourseSubjectAssignment basado en la institución
 * A través de curso -> periodo -> anioLectivo -> institucionId
 */
export const getCourseSubjectAssignmentInstitutionFilter = async (req, prisma) => {
  const institutionId = getInstitutionFilter(req);
  if (!institutionId) {
    if (req.user?.rol === 'ADMIN') return {};
    return { cursoId: { in: [] } };
  }
  
  try {
    // Reutilizar la lógica de cursos
    const courseFilter = await getCourseInstitutionFilter(req, prisma);
    
    if (courseFilter.periodoId?.in && courseFilter.periodoId.in.length === 0) {
      return { cursoId: { in: [] } };
    }
    
    // Obtener cursos de esos períodos
    const courses = await prisma.course.findMany({
      where: courseFilter,
      select: { id: true },
    });
    
    const courseIds = courses.map(c => c.id);
    
    if (courseIds.length === 0) {
      return { cursoId: { in: [] } };
    }
    
    return {
      cursoId: { in: courseIds },
    };
  } catch (error) {
    console.error('Error al obtener filtro de asignaciones por institución:', error);
    return { cursoId: { in: [] } };
  }
};

/**
 * Verifica si un usuario tiene acceso a una institución
 */
export const hasAccessToInstitution = (req, institutionId) => {
  // Admin siempre tiene acceso
  if (req.user.rol === 'ADMIN') {
    return true;
  }
  
  // Verificar si la institución es la del usuario o la activa
  const userInstitutionId = req.user.institucionId;
  const activeInstitutionId = req.activeInstitution?.id;
  
  return institutionId === userInstitutionId || institutionId === activeInstitutionId;
};

/**
 * Verifica si un estudiante pertenece a la institución del usuario
 */
export const verifyStudentBelongsToInstitution = async (req, prisma, studentId) => {
  const institutionId = getInstitutionFilter(req);
  if (!institutionId) return true;
  
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      user: {
        select: { institucionId: true },
      },
    },
  });
  
  if (!student) return false;
  
  return student.user.institucionId === institutionId;
};

/**
 * Verifica si un curso pertenece a la institución del usuario
 */
export const verifyCourseBelongsToInstitution = async (req, prisma, courseId) => {
  const institutionId = getInstitutionFilter(req);

  // Si no hay institución seleccionada (caso extremo), permitir para no bloquear
  if (!institutionId) return true;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      anioLectivo: {
        select: { institucionId: true },
      },
      periodo: {
        include: {
          anioLectivo: {
            select: { institucionId: true },
          },
        },
      },
    },
  });
  
  if (!course) return false;
  
  // Verificar por año escolar (prioritario) o por período (compatibilidad)
  const courseInstitutionId = course.anioLectivo?.institucionId || course.periodo?.anioLectivo?.institucionId;
  return courseInstitutionId === institutionId;
};

/**
 * Verifica si un período pertenece a la institución del usuario
 */
export const verifyPeriodBelongsToInstitution = async (req, prisma, periodId) => {
  const institutionId = getInstitutionFilter(req);
  if (!institutionId) return true;
  
  const period = await prisma.period.findUnique({
    where: { id: periodId },
    include: {
      anioLectivo: {
        select: { institucionId: true },
      },
    },
  });
  
  if (!period) return false;
  
  return period.anioLectivo.institucionId === institutionId;
};

