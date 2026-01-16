import jwt from 'jsonwebtoken';

/**
 * Genera un token JWT para un usuario
 */
export const generateToken = (userId, rol) => {
  return jwt.sign(
    { userId, rol },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '2h' }
  );
};

/**
 * Genera un refresh token JWT para un usuario
 */
export const generateRefreshToken = (userId, rol) => {
  return jwt.sign(
    { userId, rol },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
};

/**
 * Verifica y decodifica un token JWT
 */
export const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

/**
 * Verifica y decodifica un refresh token
 */
export const verifyRefreshToken = (token) => {
  return jwt.verify(
    token,
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
  );
};

