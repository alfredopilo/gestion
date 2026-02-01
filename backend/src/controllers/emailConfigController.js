import prisma from '../config/database.js';
import { encrypt, decrypt, getTransporter } from '../services/emailService.js';

const getInstitutionId = (req) => {
  return req.institutionId || req.user?.institutionId || req.user?.accessibleInstitutionIds?.[0];
};

export const getEmailConfig = async (req, res, next) => {
  try {
    const institutionId = getInstitutionId(req);
    if (!institutionId) {
      return res.status(400).json({ error: 'No hay institución seleccionada. Seleccione una institución para continuar.' });
    }
    
    const config = await prisma.emailConfig.findUnique({
      where: { institutionId }
    });
    
    if (!config) {
      return res.status(404).json({ error: 'Configuración no encontrada' });
    }
    
    // No enviar password al frontend
    const { smtpPassword, ...configWithoutPassword } = config;
    
    res.json({
      ...configWithoutPassword,
      hasPassword: !!smtpPassword
    });
  } catch (error) {
    next(error);
  }
};

export const createOrUpdateEmailConfig = async (req, res, next) => {
  try {
    const institutionId = getInstitutionId(req);
    if (!institutionId) {
      return res.status(400).json({ error: 'No hay institución seleccionada. Seleccione una institución para continuar.' });
    }
    const {
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser,
      smtpPassword,
      senderEmail,
      senderName,
      activo
    } = req.body;
    
    // Verificar si ya existe configuración
    const existingConfig = await prisma.emailConfig.findUnique({
      where: { institutionId }
    });
    
    let config;
    
    if (existingConfig) {
      // UPDATE: no requiere password
      const updateData = {
        smtpHost,
        smtpPort: parseInt(smtpPort),
        smtpSecure: smtpSecure === true || smtpSecure === 'true',
        smtpUser,
        senderEmail,
        senderName,
        activo: activo === true || activo === 'true'
      };
      
      // Solo actualizar password si se envió uno nuevo
      if (smtpPassword) {
        updateData.smtpPassword = encrypt(smtpPassword);
      }
      
      config = await prisma.emailConfig.update({
        where: { institutionId },
        data: updateData
      });
    } else {
      // CREATE: password es obligatorio
      if (!smtpPassword) {
        return res.status(400).json({ error: 'La contraseña SMTP es obligatoria' });
      }
      
      config = await prisma.emailConfig.create({
        data: {
          institutionId,
          smtpHost,
          smtpPort: parseInt(smtpPort),
          smtpSecure: smtpSecure === true || smtpSecure === 'true',
          smtpUser,
          smtpPassword: encrypt(smtpPassword),
          senderEmail,
          senderName,
          activo: activo === true || activo === 'true'
        }
      });
    }
    
    const { smtpPassword: _, ...configWithoutPassword } = config;
    
    res.json({
      message: 'Configuración guardada exitosamente',
      config: configWithoutPassword
    });
  } catch (error) {
    next(error);
  }
};

export const testEmailConfig = async (req, res, next) => {
  try {
    const institutionId = getInstitutionId(req);
    if (!institutionId) {
      return res.status(400).json({ error: 'No hay institución seleccionada. Seleccione una institución para continuar.' });
    }
    const { testEmail } = req.body;
    
    const { transporter, config } = await getTransporter(institutionId);
    
    await transporter.sendMail({
      from: `"${config.senderName}" <${config.senderEmail}>`,
      to: testEmail,
      subject: 'Prueba de configuración de email',
      html: '<p>Esta es una prueba de la configuración de email del sistema de gestión escolar.</p>'
    });
    
    res.json({ message: 'Email de prueba enviado exitosamente' });
  } catch (error) {
    next(error);
  }
};
