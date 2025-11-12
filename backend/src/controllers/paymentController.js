import prisma from '../config/database.js';
import { createPaymentSchema } from '../utils/validators.js';
import { getPaymentInstitutionFilter } from '../utils/institutionFilter.js';

/**
 * Obtener pagos
 */
export const getPayments = async (req, res, next) => {
  try {
    const { estudianteId, estado, fechaInicio, fechaFin, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (estudianteId) {
      where.estudianteId = estudianteId;
    } else {
      // Filtrar por institución si no se especifica estudiante
      const institutionFilter = await getPaymentInstitutionFilter(req, prisma);
      if (Object.keys(institutionFilter).length > 0) {
        if (institutionFilter.estudianteId?.in && institutionFilter.estudianteId.in.length === 0) {
          return res.json({
            data: [],
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total: 0,
              pages: 0,
            },
          });
        }
        Object.assign(where, institutionFilter);
      }
    }
    if (estado) where.estado = estado;

    if (fechaInicio || fechaFin) {
      where.createdAt = {};
      if (fechaInicio) where.createdAt.gte = new Date(fechaInicio);
      if (fechaFin) where.createdAt.lte = new Date(fechaFin);
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          estudiante: {
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
        orderBy: { createdAt: 'desc' },
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({
      data: payments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener un pago por ID
 */
export const getPaymentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        estudiante: {
          include: {
            user: true,
            grupo: true,
          },
        },
      },
    });

    if (!payment) {
      return res.status(404).json({
        error: 'Pago no encontrado.',
      });
    }

    // Verificar que el estudiante pertenece a la institución
    const { verifyStudentBelongsToInstitution } = await import('../utils/institutionFilter.js');
    const hasAccess = await verifyStudentBelongsToInstitution(req, prisma, payment.estudianteId);
    
    if (!hasAccess) {
      return res.status(403).json({
        error: 'No tienes acceso a este pago.',
      });
    }

    res.json(payment);
  } catch (error) {
    next(error);
  }
};

/**
 * Crear un nuevo pago
 */
export const createPayment = async (req, res, next) => {
  try {
    const validatedData = createPaymentSchema.parse(req.body);

    // Convertir fechas si es necesario
    if (validatedData.fechaPago && typeof validatedData.fechaPago === 'string') {
      validatedData.fechaPago = new Date(validatedData.fechaPago);
    }
    if (validatedData.fechaVencimiento && typeof validatedData.fechaVencimiento === 'string') {
      validatedData.fechaVencimiento = new Date(validatedData.fechaVencimiento);
    }

    // Calcular monto final
    const montoFinal = validatedData.monto - (validatedData.descuento || 0);

    const payment = await prisma.payment.create({
      data: {
        ...validatedData,
        monto: montoFinal,
      },
      include: {
        estudiante: {
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

    res.status(201).json({
      message: 'Pago registrado exitosamente.',
      payment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Actualizar un pago
 */
export const updatePayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Convertir fechas si es necesario
    if (updateData.fechaPago && typeof updateData.fechaPago === 'string') {
      updateData.fechaPago = new Date(updateData.fechaPago);
    }
    if (updateData.fechaVencimiento && typeof updateData.fechaVencimiento === 'string') {
      updateData.fechaVencimiento = new Date(updateData.fechaVencimiento);
    }

    // Recalcular monto final si se actualiza monto o descuento
    if (updateData.monto !== undefined || updateData.descuento !== undefined) {
      const currentPayment = await prisma.payment.findUnique({
        where: { id },
      });

      const monto = updateData.monto ?? currentPayment.monto;
      const descuento = updateData.descuento ?? currentPayment.descuento ?? 0;
      updateData.monto = monto - descuento;
    }

    const payment = await prisma.payment.findUnique({
      where: { id },
    });

    if (!payment) {
      return res.status(404).json({
        error: 'Pago no encontrado.',
      });
    }

    const updatedPayment = await prisma.payment.update({
      where: { id },
      data: updateData,
      include: {
        estudiante: {
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

    res.json({
      message: 'Pago actualizado exitosamente.',
      payment: updatedPayment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener estado de cuenta de un estudiante
 */
export const getStudentAccount = async (req, res, next) => {
  try {
    const { estudianteId } = req.params;

    // Verificar que el estudiante pertenece a la institución
    const { verifyStudentBelongsToInstitution } = await import('../utils/institutionFilter.js');
    const hasAccess = await verifyStudentBelongsToInstitution(req, prisma, estudianteId);
    
    if (!hasAccess) {
      return res.status(403).json({
        error: 'No tienes acceso a este estudiante.',
      });
    }

    const payments = await prisma.payment.findMany({
      where: { estudianteId },
      orderBy: { createdAt: 'asc' },
    });

    const totalPendiente = payments
      .filter(p => p.estado === 'PENDIENTE' || p.estado === 'VENCIDO')
      .reduce((sum, p) => sum + p.monto, 0);

    const totalPagado = payments
      .filter(p => p.estado === 'PAGADO')
      .reduce((sum, p) => sum + p.monto, 0);

    const estudiante = await prisma.student.findUnique({
      where: { id: estudianteId },
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
      estudiante,
      resumen: {
        totalPendiente,
        totalPagado,
        totalRegistros: payments.length,
      },
      pagos: payments,
    });
  } catch (error) {
    next(error);
  }
};

