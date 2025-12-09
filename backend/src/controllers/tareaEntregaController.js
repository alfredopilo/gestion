import prisma from '../config/database.js';
import { getStudentInstitutionFilter, verifyCourseBelongsToInstitution } from '../utils/institutionFilter.js';
import path from 'path';
import fs from 'fs';

/**
 * Subir archivo de tarea
 */
export const uploadTarea = async (req, res, next) => {
  try {
    const { insumoId, observaciones } = req.body;
    const file = req.file;

    // Verificar que el usuario sea estudiante
    if (req.user?.rol !== 'ESTUDIANTE') {
      if (file && file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      return res.status(403).json({
        error: 'Acceso denegado. Solo los estudiantes pueden subir tareas.',
      });
    }

    // Obtener el ID del estudiante desde la base de datos
    const studentAuth = await prisma.student.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });

    if (!studentAuth) {
      if (file && file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      return res.status(404).json({
        error: 'Registro de estudiante no encontrado.',
      });
    }

    const studentId = studentAuth.id;

    if (!file) {
      return res.status(400).json({
        error: 'Debe subir un archivo.',
      });
    }

    if (!insumoId) {
      // Eliminar el archivo subido si no hay insumoId
      if (file.path) {
        fs.unlinkSync(file.path);
      }
      return res.status(400).json({
        error: 'El ID del insumo es requerido.',
      });
    }

    // Verificar que el insumo existe y está activo para recibir tareas
    const insumo = await prisma.insumo.findUnique({
      where: { id: insumoId },
      include: {
        curso: true,
      },
    });

    if (!insumo) {
      // Eliminar el archivo subido
      if (file.path) {
        fs.unlinkSync(file.path);
      }
      return res.status(404).json({
        error: 'Insumo no encontrado.',
      });
    }

    if (!insumo.recibirTarea) {
      // Eliminar el archivo subido
      if (file.path) {
        fs.unlinkSync(file.path);
      }
      return res.status(400).json({
        error: 'Este insumo no está configurado para recibir tareas.',
      });
    }

    // Verificar que el estudiante pertenece al curso del insumo
    const studentWithCourse = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        grupo: true,
      },
    });

    if (!studentWithCourse || studentWithCourse.grupoId !== insumo.cursoId) {
      // Eliminar el archivo subido
      if (file.path) {
        fs.unlinkSync(file.path);
      }
      return res.status(403).json({
        error: 'No perteneces al curso asociado a este insumo.',
      });
    }

    // Verificar si ya existe una entrega para este insumo y estudiante
    const existingEntrega = await prisma.tareaEntrega.findUnique({
      where: {
        estudianteId_insumoId: {
          estudianteId: studentId,
          insumoId: insumoId,
        },
      },
    });

    let entrega;

    if (existingEntrega) {
      // Eliminar el archivo anterior si existe
      if (existingEntrega.archivoRuta && fs.existsSync(existingEntrega.archivoRuta)) {
        fs.unlinkSync(existingEntrega.archivoRuta);
      }

      // Actualizar la entrega existente
      entrega = await prisma.tareaEntrega.update({
        where: { id: existingEntrega.id },
        data: {
          archivoNombre: file.originalname,
          archivoRuta: file.path,
          fechaEntrega: new Date(),
          observaciones: observaciones || null,
          estado: 'ENTREGADA',
        },
        include: {
          insumo: {
            include: {
              materia: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
              curso: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
            },
          },
        },
      });
    } else {
      // Crear nueva entrega
      entrega = await prisma.tareaEntrega.create({
        data: {
          estudianteId: studentId,
          insumoId: insumoId,
          archivoNombre: file.originalname,
          archivoRuta: file.path,
          fechaEntrega: new Date(),
          observaciones: observaciones || null,
          estado: 'ENTREGADA',
        },
        include: {
          insumo: {
            include: {
              materia: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
              curso: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
            },
          },
        },
      });
    }

    res.status(201).json({
      message: 'Tarea subida exitosamente.',
      entrega,
    });
  } catch (error) {
    // Eliminar el archivo si hubo un error
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
};

/**
 * Obtener tareas del estudiante autenticado
 */
export const getMisTareas = async (req, res, next) => {
  try {
    const { estado, insumoId } = req.query;

    // Verificar que el usuario sea estudiante
    if (req.user?.rol !== 'ESTUDIANTE') {
      return res.status(403).json({
        error: 'Acceso denegado. Solo los estudiantes pueden ver sus tareas.',
      });
    }

    // Obtener el ID del estudiante desde la base de datos
    const studentData = await prisma.student.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });

    if (!studentData) {
      return res.status(404).json({
        error: 'Registro de estudiante no encontrado.',
      });
    }

    const studentId = studentData.id;

    const where = {
      estudianteId: studentId,
    };

    if (estado) {
      where.estado = estado;
    }

    if (insumoId) {
      where.insumoId = insumoId;
    }

    const entregas = await prisma.tareaEntrega.findMany({
      where,
      include: {
        insumo: {
          include: {
            materia: {
              select: {
                id: true,
                nombre: true,
                codigo: true,
              },
            },
            curso: {
              select: {
                id: true,
                nombre: true,
                nivel: true,
                paralelo: true,
              },
            },
            subPeriodo: {
              select: {
                id: true,
                nombre: true,
                periodo: {
                  select: {
                    id: true,
                    nombre: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        fechaEntrega: 'desc',
      },
    });

    // Obtener también los insumos que están configurados para recibir tareas
    // pero el estudiante aún no ha entregado
    const studentCheck = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!studentCheck?.grupoId) {
      return res.json({
        data: entregas,
        pendientes: [],
      });
    }

    // Obtener IDs de insumos ya entregados
    const insumosEntregados = entregas.map(e => e.insumoId);

    const insumosPendientes = await prisma.insumo.findMany({
      where: {
        cursoId: studentCheck.grupoId,
        recibirTarea: true,
        activo: true,
        NOT: {
          id: {
            in: insumosEntregados.length > 0 ? insumosEntregados : [],
          },
        },
      },
      include: {
        materia: {
          select: {
            id: true,
            nombre: true,
            codigo: true,
          },
        },
        curso: {
          select: {
            id: true,
            nombre: true,
            nivel: true,
            paralelo: true,
          },
        },
        subPeriodo: {
          select: {
            id: true,
            nombre: true,
            periodo: {
              select: {
                id: true,
                nombre: true,
              },
            },
          },
        },
      },
      orderBy: {
        fechaEntrega: 'asc',
      },
    });

    res.json({
      data: entregas,
      pendientes: insumosPendientes,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener entregas por insumo (para profesores)
 */
export const getEntregasPorInsumo = async (req, res, next) => {
  try {
    const { insumoId } = req.params;
    const { estado } = req.query;

    // Verificar que el insumo existe y pertenece a la institución
    const insumo = await prisma.insumo.findUnique({
      where: { id: insumoId },
      include: {
        curso: true,
      },
    });

    if (!insumo) {
      return res.status(404).json({
        error: 'Insumo no encontrado.',
      });
    }

    await verifyCourseBelongsToInstitution(req, prisma, insumo.cursoId);

    const where = {
      insumoId,
    };

    if (estado) {
      where.estado = estado;
    }

    const entregas = await prisma.tareaEntrega.findMany({
      where,
      include: {
        estudiante: {
          include: {
            user: {
              select: {
                id: true,
                nombre: true,
                apellido: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        fechaEntrega: 'desc',
      },
    });

    res.json({
      data: entregas,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Calificar entrega (para profesores)
 */
export const calificarEntrega = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { observaciones, estado } = req.body;

    const entrega = await prisma.tareaEntrega.findUnique({
      where: { id },
      include: {
        insumo: {
          include: {
            curso: true,
          },
        },
      },
    });

    if (!entrega) {
      return res.status(404).json({
        error: 'Entrega no encontrada.',
      });
    }

    await verifyCourseBelongsToInstitution(req, prisma, entrega.insumo.cursoId);

    const updateData = {};
    if (observaciones !== undefined) {
      updateData.observaciones = observaciones;
    }
    if (estado && ['PENDIENTE', 'ENTREGADA', 'CALIFICADA'].includes(estado)) {
      updateData.estado = estado;
    }

    const updatedEntrega = await prisma.tareaEntrega.update({
      where: { id },
      data: updateData,
      include: {
        estudiante: {
          include: {
            user: {
              select: {
                id: true,
                nombre: true,
                apellido: true,
                email: true,
              },
            },
          },
        },
        insumo: {
          include: {
            materia: {
              select: {
                id: true,
                nombre: true,
              },
            },
          },
        },
      },
    });

    res.json({
      message: 'Entrega actualizada exitosamente.',
      entrega: updatedEntrega,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Descargar archivo de tarea
 */
export const downloadTarea = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.rol;
    
    let studentId = null;
    
    // Si es estudiante, obtener su ID
    if (userRole === 'ESTUDIANTE') {
      const studentDownload = await prisma.student.findUnique({
        where: { userId: req.user.id },
        select: { id: true },
      });
      studentId = studentDownload?.id;
    }

    const entrega = await prisma.tareaEntrega.findUnique({
      where: { id },
      include: {
        insumo: {
          include: {
            curso: true,
          },
        },
      },
    });

    if (!entrega) {
      return res.status(404).json({
        error: 'Entrega no encontrada.',
      });
    }

    // Verificar permisos: el estudiante dueño o un profesor del curso
    if (userRole === 'ESTUDIANTE') {
      if (entrega.estudianteId !== studentId) {
        return res.status(403).json({
          error: 'No tienes permiso para descargar este archivo.',
        });
      }
    } else if (userRole === 'PROFESOR' || userRole === 'ADMIN') {
      await verifyCourseBelongsToInstitution(req, prisma, entrega.insumo.cursoId);
    } else {
      return res.status(403).json({
        error: 'No tienes permiso para descargar este archivo.',
      });
    }

    if (!fs.existsSync(entrega.archivoRuta)) {
      return res.status(404).json({
        error: 'El archivo no se encuentra en el servidor.',
      });
    }

    res.download(entrega.archivoRuta, entrega.archivoNombre);
  } catch (error) {
    next(error);
  }
};

