import express from 'express';
import {
  createOrder,
  getMyOrders,
  getMyBoosterOrders,
  getOrderById,
  updateOrderStatus,
  updateOrderProgress
} from '../controllers/orderController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Rutas para clientes
router.post('/', authenticateToken, authorizeRoles('client'), createOrder);
router.get('/my-orders', authenticateToken, authorizeRoles('client'), getMyOrders);

// Rutas para boosters
router.get('/my-booster-orders', authenticateToken, authorizeRoles('booster', 'admin'), getMyBoosterOrders);

// Rutas compartidas
router.get('/:id', authenticateToken, getOrderById);
router.patch('/:id/status', authenticateToken, authorizeRoles('booster', 'admin'), updateOrderStatus);
router.patch('/:id/progress', authenticateToken, authorizeRoles('booster', 'admin'), updateOrderProgress);

export default router;
