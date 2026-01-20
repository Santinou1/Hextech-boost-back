import express from 'express';
import {
  createReview,
  getBoosterReviews,
  getAllReviews
} from '../controllers/reviewController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.post('/', authenticateToken, authorizeRoles('client'), createReview);
router.get('/booster/:booster_id', getBoosterReviews);
router.get('/all', authenticateToken, authorizeRoles('admin'), getAllReviews);

export default router;
