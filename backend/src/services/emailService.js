import * as nodemailerModule from 'nodemailer';
import prisma from '../config/database.js';
import crypto from 'crypto';

// Compatibilidad con ES modules
const nodemailer = nodemailerModule.default || nodemailerModule;

// Algoritmo de encriptación para passwords SMTP
const ENCRYPTION_KEY = process.env.EMAIL_ENCRYPTION_KEY || 'default-32-char-key-change-this!!';
const IV_LENGTH = 16;

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

export const getTransporter = async (institutionId) => {
  const config = await prisma.emailConfig.findUnique({
    where: { institutionId }
  });
  
  if (!config || !config.activo) {
    throw new Error('Configuración de email no encontrada o inactiva');
  }
  
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: config.smtpUser,
      pass: decrypt(config.smtpPassword)
    }
  });
  
  return { transporter, config };
};

export const sendEmail = async (institutionId, to, subject, html) => {
  const { transporter, config } = await getTransporter(institutionId);
  
  const mailOptions = {
    from: `"${config.senderName}" <${config.senderEmail}>`,
    to,
    subject,
    html
  };
  
  return await transporter.sendMail(mailOptions);
};

export { encrypt, decrypt };
