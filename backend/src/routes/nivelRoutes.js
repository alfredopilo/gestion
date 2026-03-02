import express from 'express';
import {
  getNiveles,
  getNivelById,
  createNivel,
  updateNivel,
  deleteNivel,
} from '../controllers/nivelController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getNiveles);
router.get('/:id', getNivelById);
router.post('/', authorize('ADMIN', 'SECRETARIA'), createNivel);
router.put('/:id', authorize('ADMIN', 'SECRETARIA'), updateNivel);
router.delete('/:id', authorize('ADMIN', 'SECRETARIA'), deleteNivel);

export default router;
