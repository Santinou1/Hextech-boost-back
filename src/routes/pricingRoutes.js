import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  upsertPricing,
  getBoosterPricing,
  getMyPricing,
  calculatePrice,
  deletePricing
} from '../controllers/pricingController.js';

const router = express.Router();

// Public routes
router.get('/booster/:boosterId', getBoosterPricing);
router.get('/booster/:boosterId/calculate', calculatePrice);

// Protected routes (require authentication)
router.use(authenticate);

router.get('/my-pricing', getMyPricing);
router.post('/my-pricing', upsertPricing);
router.delete('/my-pricing/:id', deletePricing);

export default router;
