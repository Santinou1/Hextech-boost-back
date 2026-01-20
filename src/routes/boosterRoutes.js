import express from 'express';
import {
  getAllBoosters,
  getBoosterById,
  upsertBoosterProfile,
  getMyBoosterProfile,
  toggleAvailability
} from '../controllers/boosterController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Rutas públicas
router.get('/', getAllBoosters);
router.get('/:id', getBoosterById);

// Rutas protegidas para boosters
router.get('/me/profile', authenticateToken, authorizeRoles('booster'), getMyBoosterProfile);
router.post('/me/profile', authenticateToken, authorizeRoles('booster'), upsertBoosterProfile);
router.put('/me/profile', authenticateToken, authorizeRoles('booster'), upsertBoosterProfile);
router.patch('/me/availability', authenticateToken, authorizeRoles('booster'), toggleAvailability);

export default router;
