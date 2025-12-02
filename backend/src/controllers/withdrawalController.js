import prisma from '../config/database.js';
import { generateMatriculaNumber } from '../utils/matricula.js';
import { getInstitutionFilter, verifyStudentBelongsToInstitution } from '../utils/institutionFilter.js';

/**
 * Retirar un estudiante
 * Crea un registro de retiro, inactiva la matrícula activa y marca al estudiante como retirado
 */
export const withdrawStudent = async (req, res, next) => {
  try {
    const { id: studentId } = req.params;
    const { motivo, observaciones, fechaRetiro } = req.body;

    if (!motivo) {
      return res.status(400).json({
        error: 'Se debe proporcionar un motivo de retiro.',
      });
    }

    if (!fechaRetiro) {
      return res.status(400).json({
        error: 'Se debe proporcionar la fecha de retiro.',
      });
    }

    // Validar que la fecha sea válida
    const fechaRetiroDate = new Date(fechaRetiro);
    if (isNaN(fechaRetiroDate.getTime())) {
      return res.status(400).json({
        error: 'La fecha de retiro no es válida.',
      });
    }

    // Verificar que el estudiante existe y obtener información
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: {
            id: true,
            institucionId: true,
            estado: true,
          },
        },
        grupo: {
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
    });

    if (!student) {
      return res.status(404).json({
        error: 'Estudiante no encontrado.',
      });
    }

    // Verificar permisos de acceso
    const hasAccess = await verifyStudentBelongsToInstitution(req, prisma, studentId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'No tienes acceso a este estudiante.',
      });
    }

    // Verificar que no esté ya retirado
    if (student.retirado) {
      return res.status(400).json({
        error: 'El estudiante ya está retirado.',
      });
    }

    const institucionId = student.user.institucionId;

    // Buscar matrícula activa
    let activeEnrollment = null;
    if (student.grupo?.anioLectivo) {
      activeEnrollment = await prisma.enrollment.findFirst({
        where: {
          studentId: studentId,
          anioLectivoId: student.grupo.anioLectivo.id,
          activo: true,
        },
      });
    }

    // Crear registro de retiro
    const withdrawal = await prisma.studentWithdrawal.create({
      data: {
        studentId: studentId,
        enrollmentId: activeEnrollment?.id || null,
        motivo,
        fechaRetiro: fechaRetiroDate,
        observaciones: observaciones || null,
        institucionId,
      },
      include: {
        enrollment: {
          select: {
            id: true,
            matricula: true,
            curso: {
              select: {
                nombre: true,
                nivel: true,
              },
            },
          },
        },
      },
    });

    // Inactivar matrícula si existe
    if (activeEnrollment) {
      await prisma.enrollment.update({
        where: { id: activeEnrollment.id },
        data: {
          activo: false,
          fechaFin: new Date(),
          motivoRetiro: motivo,
        },
      });
    }

    // Marcar estudiante como retirado y remover del curso
    await prisma.student.update({
      where: { id: studentId },
      data: {
        retirado: true,
        grupoId: null,
      },
    });

    res.json({
      message: 'Estudiante retirado exitosamente.',
      withdrawal,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener historial de retiros de un estudiante
 */
export const getStudentWithdrawals = async (req, res, next) => {
  try {
    const { id: studentId } = req.params;

    // Verificar acceso
    const hasAccess = await verifyStudentBelongsToInstitution(req, prisma, studentId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'No tienes acceso a este estudiante.',
      });
    }

    const withdrawals = await prisma.studentWithdrawal.findMany({
      where: { studentId },
      include: {
        enrollment: {
          include: {
            curso: {
              select: {
                nombre: true,
                nivel: true,
              },
            },
            anioLectivo: {
              select: {
                nombre: true,
                ano: true,
              },
            },
          },
        },
        institucion: {
          select: {
            nombre: true,
          },
        },
      },
      orderBy: {
        fechaRetiro: 'desc',
      },
    });

    res.json({
      data: withdrawals,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener historial completo de matrículas de un estudiante
 */
export const getStudentEnrollments = async (req, res, next) => {
  try {
    const { id: studentId } = req.params;

    // Verificar acceso
    const hasAccess = await verifyStudentBelongsToInstitution(req, prisma, studentId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'No tienes acceso a este estudiante.',
      });
    }

    const enrollments = await prisma.enrollment.findMany({
      where: { studentId },
      include: {
        curso: {
          select: {
            nombre: true,
            nivel: true,
            paralelo: true,
          },
        },
        anioLectivo: {
          select: {
            nombre: true,
            ano: true,
            fechaInicio: true,
            fechaFin: true,
          },
        },
        institucion: {
          select: {
            nombre: true,
          },
        },
      },
      orderBy: {
        fechaInicio: 'desc',
      },
    });

    res.json({
      data: enrollments,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reactivar estudiante con segunda matrícula en la misma institución
 */
export const reactivateWithSecondEnrollment = async (req, res, next) => {
  try {
    const { id: studentId } = req.params;
    const { cursoId, fechaInicio } = req.body;

    if (!cursoId) {
      return res.status(400).json({
        error: 'Se debe proporcionar el ID del curso.',
      });
    }

    if (!fechaInicio) {
      return res.status(400).json({
        error: 'Se debe proporcionar la fecha de reactivación.',
      });
    }

    // Validar que la fecha sea válida
    const fechaInicioDate = new Date(fechaInicio);
    if (isNaN(fechaInicioDate.getTime())) {
      return res.status(400).json({
        error: 'La fecha de reactivación no es válida.',
      });
    }

    // Verificar que el estudiante existe y está retirado
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: {
            institucionId: true,
          },
        },
      },
    });

    if (!student) {
      return res.status(404).json({
        error: 'Estudiante no encontrado.',
      });
    }

    if (!student.retirado) {
      return res.status(400).json({
        error: 'El estudiante no está retirado, no requiere reactivación.',
      });
    }

    // Verificar acceso
    const hasAccess = await verifyStudentBelongsToInstitution(req, prisma, studentId);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'No tienes acceso a este estudiante.',
      });
    }

    // Obtener información del curso
    const course = await prisma.course.findUnique({
      where: { id: cursoId },
      include: {
        anioLectivo: {
          select: {
            id: true,
            institucionId: true,
          },
        },
      },
    });

    if (!course) {
      return res.status(404).json({
        error: 'Curso no encontrado.',
      });
    }

    const anioLectivoId = course.anioLectivo.id;
    const institucionId = course.anioLectivo.institucionId;

    // Verificar que el curso pertenece a la misma institución
    if (institucionId !== student.user.institucionId) {
      return res.status(400).json({
        error: 'El curso debe pertenecer a la misma institución del estudiante.',
      });
    }

    // Verificar capacidad del curso
    const currentCount = await prisma.student.count({
      where: { grupoId: cursoId },
    });

    if (course.capacidad && currentCount >= course.capacidad) {
      return res.status(400).json({
        error: `El curso ha alcanzado su capacidad máxima (${course.capacidad} estudiantes).`,
      });
    }

    // Verificar si ya tiene matrícula activa para este año lectivo
    const existingEnrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: studentId,
        anioLectivoId,
        activo: true,
      },
    });

    if (existingEnrollment) {
      return res.status(400).json({
        error: 'El estudiante ya tiene una matrícula activa para este año lectivo.',
      });
    }

    // Generar número de matrícula
    const matricula = await generateMatriculaNumber(institucionId, anioLectivoId);

    // Crear nueva matrícula
    const enrollment = await prisma.enrollment.create({
      data: {
        studentId: studentId,
        cursoId: cursoId,
        anioLectivoId,
        institucionId,
        matricula,
        fechaInicio: fechaInicioDate,
        activo: true,
      },
    });

    // Reactivar estudiante y asignar al curso
    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: {
        retirado: false,
        grupoId: cursoId,
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
      message: 'Estudiante reactivado exitosamente con nueva matrícula.',
      student: updatedStudent,
      enrollment: {
        id: enrollment.id,
        matricula: enrollment.matricula,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Transferir estudiante a otra institución
 * Crea un nuevo registro Student en la nueva institución y copia la ficha del estudiante
 */
export const transferStudent = async (req, res, next) => {
  try {
    const { id: studentId } = req.params;
    const { nuevaInstitucionId } = req.body;

    if (!nuevaInstitucionId) {
      return res.status(400).json({
        error: 'Se debe proporcionar el ID de la nueva institución.',
      });
    }

    // Verificar que el estudiante existe y está retirado
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            institucionId: true,
            numeroIdentificacion: true,
          },
        },
        profileValues: {
          include: {
            field: {
              include: {
                section: {
                  select: {
                    institucionId: true,
                  },
                },
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

    if (!student.retirado) {
      return res.status(400).json({
        error: 'El estudiante debe estar retirado para poder transferirlo.',
      });
    }

    // Verificar que la nueva institución existe
    const nuevaInstitucion = await prisma.institution.findUnique({
      where: { id: nuevaInstitucionId },
    });

    if (!nuevaInstitucion) {
      return res.status(404).json({
        error: 'Nueva institución no encontrada.',
      });
    }

    // Verificar que no sea la misma institución
    if (student.user.institucionId === nuevaInstitucionId) {
      return res.status(400).json({
        error: 'El estudiante ya pertenece a esta institución. Use reactivación en su lugar.',
      });
    }

    // Verificar que el usuario no tenga ya un Student en la nueva institución
    // Primero necesitamos verificar si el usuario puede existir en la nueva institución
    // Verificar si ya existe un estudiante con el mismo userId pero en otra institución
    const existingStudentInNewInstitution = await prisma.user.findFirst({
      where: {
        id: student.userId,
        institucionId: nuevaInstitucionId,
        rol: 'ESTUDIANTE',
      },
      include: {
        student: true,
      },
    });

    // Si el usuario ya tiene un Student en la nueva institución, no podemos transferir
    if (existingStudentInNewInstitution?.student) {
      return res.status(400).json({
        error: 'El estudiante ya tiene un registro en la nueva institución.',
      });
    }

    // Verificar si ya existe otro usuario con el mismo número de identificación en la nueva institución
    const existingUserByIdentification = await prisma.user.findFirst({
      where: {
        numeroIdentificacion: student.user.numeroIdentificacion,
        institucionId: nuevaInstitucionId,
        id: { not: student.userId }, // Excluir el usuario actual
      },
    });

    if (existingUserByIdentification) {
      return res.status(409).json({
        error: `Ya existe un usuario con el número de identificación ${student.user.numeroIdentificacion} en la nueva institución.`,
      });
    }

    // Usar una transacción para asegurar que todo se complete o se revierta
    const result = await prisma.$transaction(async (tx) => {
      // Actualizar el usuario para que pertenezca a la nueva institución
      await tx.user.update({
        where: { id: student.userId },
        data: {
          institucionId: nuevaInstitucionId,
        },
      });

      // Actualizar el Student existente (no crear uno nuevo porque userId es único)
      // El Student ahora pertenecerá a la nueva institución a través del userId
      const updatedStudent = await tx.student.update({
        where: { id: studentId },
        data: {
          grupoId: null, // Sin curso asignado, se asignará posteriormente
          retirado: false, // Reactivar el estudiante
        },
      });

      // Copiar ficha del estudiante (StudentProfileValue) a los campos de la nueva institución
      // Obtener campos de perfil de la nueva institución
      const newInstitutionFields = await tx.studentProfileField.findMany({
        where: {
          section: {
            institucionId: nuevaInstitucionId,
          },
        },
        include: {
          section: true,
        },
      });

      // Mapear valores del estudiante original a los campos de la nueva institución
      // por etiqueta o nombre similar
      for (const newField of newInstitutionFields) {
        // Buscar campo equivalente en los valores del estudiante original
        const matchingValue = student.profileValues.find((value) => {
          const originalField = value.field;
          // Intentar mapear por etiqueta (nombre del campo)
          return (
            originalField.etiqueta.toLowerCase() === newField.etiqueta.toLowerCase() ||
            originalField.etiqueta === newField.etiqueta
          );
        });

        if (matchingValue && matchingValue.valor) {
          // Crear o actualizar valor en la nueva institución (usar upsert para evitar conflictos)
          try {
            await tx.studentProfileValue.upsert({
              where: {
                studentId_fieldId: {
                  studentId: updatedStudent.id,
                  fieldId: newField.id,
                },
              },
              update: {
                valor: matchingValue.valor,
              },
              create: {
                studentId: updatedStudent.id,
                fieldId: newField.id,
                valor: matchingValue.valor,
              },
            });
          } catch (profileError) {
            // Si hay un error al copiar un valor del perfil, registrar pero continuar
            console.warn(`Error al copiar valor del perfil ${newField.etiqueta}:`, profileError);
          }
        }
      }

      // No se crea matrícula automáticamente al transferir
      // La matrícula se creará cuando se asigne el estudiante a un curso

      return { updatedStudent };
    });

    const { updatedStudent } = result;

    res.json({
      message: 'Estudiante transferido exitosamente a la nueva institución. Podrá ser asignado a un curso posteriormente.',
      student: {
        id: updatedStudent.id,
      },
    });
  } catch (error) {
    console.error('Error al transferir estudiante:', error);
    
    // Manejar errores específicos de Prisma
    if (error.code === 'P2002') {
      // Error de violación de restricción única
      const target = error.meta?.target;
      if (target && Array.isArray(target)) {
        if (target.includes('numeroIdentificacion') && target.includes('institucionId')) {
          return res.status(409).json({
            error: `Ya existe un usuario con el número de identificación ${student?.user?.numeroIdentificacion || ''} en la nueva institución.`,
          });
        }
        if (target.includes('matricula')) {
          return res.status(409).json({
            error: 'Ya existe una matrícula con ese número para esta institución y año lectivo.',
          });
        }
      }
      return res.status(409).json({
        error: 'Ya existe un registro con estos datos.',
      });
    }
    
    // Manejar otros errores
    if (error.status) {
      return res.status(error.status).json({
        error: error.message || 'Error al transferir estudiante.',
      });
    }
    
    next(error);
  }
};

