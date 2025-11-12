import jwt from 'jsonwebtoken';

/**
 * Genera un token JWT para un usuario
 */
export const generateToken = (userId, rol) => {
  return jwt.sign(
    { userId, rol },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * Verifica y decodifica un token JWT
 */
export const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

