import express from 'express';
const router = express.Router();
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import {
  getMyBulkConfig,
  upsertMyBulkConfig,
  calculatePrice
} from '../controllers/bulkPricingController.js';

// Rutas protegidas para boosters
router.get('/my-config', authenticateToken, authorizeRoles('booster'), getMyBulkConfig);
router.post('/my-config', authenticateToken, authorizeRoles('booster'), upsertMyBulkConfig);

// Ruta pública para calcular precio (requiere boosterId en body)
router.post('/calculate', calculatePrice);

export default router;
