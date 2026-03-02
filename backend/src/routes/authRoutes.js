import express from 'express';
import rateLimit from 'express-rate-limit';
import { login, getProfile, updateProfile, changePassword, logout, refreshToken } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Demasiados intentos de inicio de sesión. Intente nuevamente en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, login);
router.post('/refresh', refreshToken);
router.post('/logout', authenticate, logout);
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.put('/change-password', authenticate, changePassword);

export default router;

