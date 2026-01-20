import express from 'express';
import {
  addMatch,
  getMatchesByOrder,
  deleteMatch
} from '../controllers/matchController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.post('/order/:order_id', authenticateToken, authorizeRoles('booster', 'admin'), addMatch);
router.get('/order/:order_id', authenticateToken, getMatchesByOrder);
router.delete('/:id', authenticateToken, authorizeRoles('booster', 'admin'), deleteMatch);

export default router;
