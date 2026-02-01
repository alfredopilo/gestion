import prisma from '../config/database.js';
import { sendEmail } from '../services/emailService.js';

// Enviar mensaje individual o masivo
export const enviarMensaje = async (req, res, next) => {
  try {
    const emisorId = req.user.id;
    const institutionId = req.user.institutionId;
    const {
      destinatarios, // Array de IDs de usuarios
      asunto,
      cuerpo,
      enviarEmail, // Boolean
      destinatarioEmail, // 'estudiante', 'representante', 'ambos'
      tipoMensaje, // 'INDIVIDUAL', 'MASIVO_CURSO', 'MASIVO_MATERIA'
      cursoId,
      materiaId
    } = req.body;
    
    // Validación
    if (!destinatarios || destinatarios.length === 0) {
      return res.status(400).json({ error: 'Debe especificar al menos un destinatario' });
    }
    
    const mensajesCreados = [];
    const emailsEnviados = [];
    
    for (const receptorId of destinatarios) {
      // Crear mensaje interno
      const mensaje = await prisma.mensaje.create({
        data: {
          emisorId,
          receptorId,
          asunto,
          cuerpo,
          tipoMensaje: tipoMensaje || 'INDIVIDUAL',
          enviadoPorEmail: enviarEmail || false,
          cursoId,
          materiaId
        },
        include: {
          receptor: {
            include: {
              student: {
                include: {
                  representante: {
                    include: { user: true }
                  }
                }
              }
            }
          }
        }
      });
      
      mensajesCreados.push(mensaje);
      
      // Enviar email si está activado
      if (enviarEmail) {
        const emailsAEnviar = [];
        
        // Determinar destinatarios de email
        if (destinatarioEmail === 'estudiante' || destinatarioEmail === 'ambos') {
          if (mensaje.receptor.email) {
            emailsAEnviar.push(mensaje.receptor.email);
          }
        }
        
        if ((destinatarioEmail === 'representante' || destinatarioEmail === 'ambos') &&
            mensaje.receptor.student?.representante?.user?.email) {
          emailsAEnviar.push(mensaje.receptor.student.representante.user.email);
        }
        
        // Enviar emails
        for (const emailDestino of emailsAEnviar) {
          try {
            await sendEmail(
              institutionId,
              emailDestino,
              asunto,
              `<div>
                <p>${cuerpo.replace(/\n/g, '<br>')}</p>
                <hr>
                <p><small>Este es un mensaje del sistema de gestión escolar.</small></p>
              </div>`
            );
            emailsEnviados.push(emailDestino);
          } catch (emailError) {
            console.error('Error enviando email:', emailError);
          }
        }
        
        // Actualizar estado de email
        await prisma.mensaje.update({
          where: { id: mensaje.id },
          data: { emailEnviado: emailsEnviados.length > 0 }
        });
      }
    }
    
    res.json({
      message: 'Mensajes enviados exitosamente',
      mensajesCreados: mensajesCreados.length,
      emailsEnviados: emailsEnviados.length,
      mensajes: mensajesCreados
    });
  } catch (error) {
    next(error);
  }
};

// Obtener mensajes recibidos
export const getMensajesRecibidos = async (req, res, next) => {
  try {
    const receptorId = req.user.id;
    const { page = 1, limit = 20, leido } = req.query;
    
    const where = { receptorId };
    if (leido !== undefined) {
      where.leido = leido === 'true';
    }
    
    const [mensajes, total] = await Promise.all([
      prisma.mensaje.findMany({
        where,
        include: {
          emisor: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              email: true
            }
          }
        },
        orderBy: { fechaEnvio: 'desc' },
        skip: (page - 1) * limit,
        take: parseInt(limit)
      }),
      prisma.mensaje.count({ where })
    ]);
    
    res.json({
      data: mensajes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Contar mensajes no leídos
export const countMensajesNoLeidos = async (req, res, next) => {
  try {
    const receptorId = req.user.id;
    
    const count = await prisma.mensaje.count({
      where: {
        receptorId,
        leido: false
      }
    });
    
    res.json({ count });
  } catch (error) {
    next(error);
  }
};

// Marcar mensaje como leído
export const marcarComoLeido = async (req, res, next) => {
  try {
    const { id } = req.params;
    const receptorId = req.user.id;
    
    const mensaje = await prisma.mensaje.update({
      where: {
        id,
        receptorId // Seguridad: solo el receptor puede marcar como leído
      },
      data: { leido: true }
    });
    
    res.json({ message: 'Mensaje marcado como leído', mensaje });
  } catch (error) {
    next(error);
  }
};

// Obtener estudiantes por curso (para envío masivo)
export const getEstudiantesPorCurso = async (req, res, next) => {
  try {
    const { cursoId } = req.params;
    const institutionId = req.user.institutionId;
    
    const estudiantes = await prisma.student.findMany({
      where: {
        grupoId: cursoId,
        user: { institutionId },
        retirado: false
      },
      include: {
        user: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true
          }
        },
        representante: {
          include: {
            user: {
              select: {
                id: true,
                nombre: true,
                apellido: true,
                email: true
              }
            }
          }
        }
      }
    });
    
    res.json({ data: estudiantes });
  } catch (error) {
    next(error);
  }
};

// Obtener estudiantes por materia (para envío masivo)
export const getEstudiantesPorMateria = async (req, res, next) => {
  try {
    const { materiaId, cursoId } = req.query;
    const institutionId = req.user.institutionId;
    
    // Obtener estudiantes del curso que tienen la materia
    const estudiantes = await prisma.student.findMany({
      where: {
        grupoId: cursoId,
        user: { institutionId },
        retirado: false
      },
      include: {
        user: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true
          }
        },
        representante: {
          include: {
            user: {
              select: {
                id: true,
                nombre: true,
                apellido: true,
                email: true
              }
            }
          }
        }
      }
    });
    
    res.json({ data: estudiantes });
  } catch (error) {
    next(error);
  }
};

// NUEVO: Obtener historial de mensajes enviados
export const getHistorialEnvios = async (req, res, next) => {
  try {
    const emisorId = req.user.id;
    const { page = 1, limit = 20, leido, tipoMensaje, fechaDesde, fechaHasta } = req.query;
    
    const where = { emisorId };
    
    // Filtros opcionales
    if (leido !== undefined) {
      where.leido = leido === 'true';
    }
    
    if (tipoMensaje) {
      where.tipoMensaje = tipoMensaje;
    }
    
    if (fechaDesde || fechaHasta) {
      where.fechaEnvio = {};
      if (fechaDesde) {
        where.fechaEnvio.gte = new Date(fechaDesde);
      }
      if (fechaHasta) {
        where.fechaEnvio.lte = new Date(fechaHasta);
      }
    }
    
    const [mensajes, total] = await Promise.all([
      prisma.mensaje.findMany({
        where,
        include: {
          receptor: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              email: true,
              rol: true
            }
          },
          curso: {
            select: {
              id: true,
              nombre: true,
              nivel: true,
              paralelo: true
            }
          },
          materia: {
            select: {
              id: true,
              nombre: true
            }
          }
        },
        orderBy: { fechaEnvio: 'desc' },
        skip: (page - 1) * limit,
        take: parseInt(limit)
      }),
      prisma.mensaje.count({ where })
    ]);
    
    res.json({
      data: mensajes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// NUEVO: Obtener estadísticas de envíos
export const getEstadisticasEnvios = async (req, res, next) => {
  try {
    const emisorId = req.user.id;
    
    const [totalEnviados, totalLeidos, totalNoLeidos, porTipo] = await Promise.all([
      prisma.mensaje.count({ where: { emisorId } }),
      prisma.mensaje.count({ where: { emisorId, leido: true } }),
      prisma.mensaje.count({ where: { emisorId, leido: false } }),
      prisma.mensaje.groupBy({
        by: ['tipoMensaje'],
        where: { emisorId },
        _count: true
      })
    ]);
    
    res.json({
      totalEnviados,
      totalLeidos,
      totalNoLeidos,
      porcentajeLeidos: totalEnviados > 0 ? ((totalLeidos / totalEnviados) * 100).toFixed(2) : 0,
      porTipo
    });
  } catch (error) {
    next(error);
  }
};

// NUEVO: Obtener detalle de mensaje enviado con todos sus destinatarios (para mensajes masivos)
export const getDetalleMensajeEnviado = async (req, res, next) => {
  try {
    const { id } = req.params;
    const emisorId = req.user.id;
    
    const mensaje = await prisma.mensaje.findFirst({
      where: {
        id,
        emisorId // Seguridad: solo el emisor puede ver el detalle
      },
      include: {
        receptor: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            rol: true
          }
        },
        curso: {
          select: {
            id: true,
            nombre: true,
            nivel: true,
            paralelo: true
          }
        },
        materia: {
          select: {
            id: true,
            nombre: true
          }
        }
      }
    });
    
    if (!mensaje) {
      return res.status(404).json({ error: 'Mensaje no encontrado' });
    }
    
    // Si es mensaje masivo, obtener todos los mensajes relacionados (mismo asunto, fecha, curso/materia)
    if (mensaje.tipoMensaje !== 'INDIVIDUAL') {
      const mensajesRelacionados = await prisma.mensaje.findMany({
        where: {
          emisorId,
          asunto: mensaje.asunto,
          fechaEnvio: mensaje.fechaEnvio,
          tipoMensaje: mensaje.tipoMensaje,
          cursoId: mensaje.cursoId,
          materiaId: mensaje.materiaId
        },
        include: {
          receptor: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              email: true,
              rol: true
            }
          }
        },
        orderBy: {
          receptor: {
            apellido: 'asc'
          }
        }
      });
      
      return res.json({
        mensaje,
        destinatarios: mensajesRelacionados,
        totalDestinatarios: mensajesRelacionados.length,
        totalLeidos: mensajesRelacionados.filter(m => m.leido).length,
        totalNoLeidos: mensajesRelacionados.filter(m => !m.leido).length
      });
    }
    
    res.json({ mensaje });
  } catch (error) {
    next(error);
  }
};
