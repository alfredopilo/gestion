import prisma from '../config/database.js';
import { sendEmail } from '../services/emailService.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enviar mensaje individual o masivo
export const enviarMensaje = async (req, res, next) => {
  try {
    const emisorId = req.user.id;
    const institutionId = req.user.institutionId;
    
    // Parsear destinatarios (puede venir como string JSON desde FormData)
    let destinatarios = req.body.destinatarios;
    if (typeof destinatarios === 'string') {
      try {
        destinatarios = JSON.parse(destinatarios);
      } catch (e) {
        destinatarios = [];
      }
    }
    if (!Array.isArray(destinatarios)) {
      destinatarios = [];
    }
    
    const {
      asunto,
      cuerpo,
      destinatarioEmail, // 'estudiante', 'representante', 'ambos'
      tipoMensaje // 'INDIVIDUAL', 'MASIVO_CURSO', 'MASIVO_MATERIA'
    } = req.body;
    
    // Parsear cursoId y materiaId (convertir strings vacíos a null)
    const cursoId = req.body.cursoId && req.body.cursoId !== '' ? req.body.cursoId : null;
    const materiaId = req.body.materiaId && req.body.materiaId !== '' ? req.body.materiaId : null;
    
    // Parsear booleanos (vienen como strings desde FormData)
    const enviarPorSistema = req.body.enviarPorSistema === 'true' || req.body.enviarPorSistema === true;
    const enviarEmail = req.body.enviarEmail === 'true' || req.body.enviarEmail === true;
    
    // El archivo adjunto viene en req.file (si existe)
    const archivoAdjunto = req.file ? req.file.filename : null;
    const archivoNombreOriginal = req.file ? req.file.originalname : null;
    
    // Validación
    if (!destinatarios || destinatarios.length === 0) {
      return res.status(400).json({ error: 'Debe especificar al menos un destinatario' });
    }
    
    // Al menos uno de los dos canales debe estar activo
    if (!enviarPorSistema && !enviarEmail) {
      return res.status(400).json({ error: 'Debe seleccionar al menos un canal de envío (sistema o email)' });
    }
    
    const mensajesCreados = [];
    const emailsEnviados = [];
    
    // Preparar adjunto para email si existe
    let attachments = [];
    if (archivoAdjunto && enviarEmail) {
      const filePath = path.join(__dirname, '../../uploads/mensajes', archivoAdjunto);
      if (fs.existsSync(filePath)) {
        attachments = [{
          filename: archivoNombreOriginal || archivoAdjunto,
          path: filePath
        }];
      }
    }
    
    for (const receptorId of destinatarios) {
      // Crear mensaje interno solo si enviarPorSistema es true
      if (enviarPorSistema) {
        const mensaje = await prisma.mensaje.create({
          data: {
            emisorId,
            receptorId,
            asunto,
            cuerpo,
            tipoMensaje: tipoMensaje || 'INDIVIDUAL',
            enviadoPorEmail: Boolean(enviarEmail),
            archivoAdjunto,
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
      }
      
      // Enviar email si está activado (notificación inmediata al destinatario)
      if (enviarEmail) {
        const receptor = await prisma.user.findUnique({
          where: { id: receptorId },
          include: {
            student: {
              include: {
                representante: {
                  include: { user: true }
                }
              }
            }
          }
        });
        
        if (!receptor) continue;
        
        const emailsAEnviar = [];
        
        // Si el receptor ES el representante/padre (mensaje dirigido al padre)
        if (receptor.rol === 'REPRESENTANTE') {
          if ((destinatarioEmail === 'representante' || destinatarioEmail === 'ambos') && receptor.email) {
            emailsAEnviar.push(receptor.email);
          }
        } else {
          // Receptor es el estudiante: enviar al estudiante y/o al representante según opción
          if (destinatarioEmail === 'estudiante' || destinatarioEmail === 'ambos') {
            if (receptor.email) emailsAEnviar.push(receptor.email);
          }
          if ((destinatarioEmail === 'representante' || destinatarioEmail === 'ambos') &&
              receptor.student?.representante?.user?.email) {
            const emailRep = receptor.student.representante.user.email;
            if (!emailsAEnviar.includes(emailRep)) emailsAEnviar.push(emailRep);
          }
        }
        
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
              </div>`,
              attachments
            );
            emailsEnviados.push(emailDestino);
          } catch (emailError) {
            console.error('Error enviando email:', emailError);
          }
        }
        
        if (enviarPorSistema && mensajesCreados.length > 0) {
          const ultimoMensaje = mensajesCreados[mensajesCreados.length - 1];
          await prisma.mensaje.update({
            where: { id: ultimoMensaje.id },
            data: { emailEnviado: emailsEnviados.length > 0 }
          });
        }
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
    
    const raw = await prisma.student.findMany({
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
    
    // Incluir representanteUserId explícito para que el frontend siempre tenga el ID
    const estudiantes = raw.map((est) => ({
      ...est,
      representanteUserId: est.representante?.userId ?? est.representante?.user?.id ?? null
    }));
    
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
    const raw = await prisma.student.findMany({
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
    
    const estudiantes = raw.map((est) => ({
      ...est,
      representanteUserId: est.representante?.userId ?? est.representante?.user?.id ?? null
    }));
    
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

// Descargar archivo adjunto de un mensaje
export const descargarAdjunto = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Verificar que el usuario sea emisor o receptor del mensaje
    const mensaje = await prisma.mensaje.findFirst({
      where: {
        id,
        OR: [
          { emisorId: userId },
          { receptorId: userId }
        ]
      }
    });
    
    if (!mensaje) {
      return res.status(404).json({ error: 'Mensaje no encontrado o no tiene permiso para acceder' });
    }
    
    if (!mensaje.archivoAdjunto) {
      return res.status(404).json({ error: 'Este mensaje no tiene archivo adjunto' });
    }
    
    const filePath = path.join(__dirname, '../../uploads/mensajes', mensaje.archivoAdjunto);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archivo no encontrado en el servidor' });
    }
    
    // Determinar el tipo de contenido basado en la extensión
    const ext = path.extname(mensaje.archivoAdjunto).toLowerCase();
    const contentTypeMap = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain',
      '.rtf': 'application/rtf',
      '.odt': 'application/vnd.oasis.opendocument.text',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
      '.csv': 'text/csv',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed',
    };
    
    const contentType = contentTypeMap[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${mensaje.archivoAdjunto}"`);
    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
};
