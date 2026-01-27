import express from 'express';
import {
  createOrder,
  getAllOrders,
  getMyOrders,
  getMyBoosterOrders,
  getOrderById,
  updateOrderStatus,
  updateOrderProgress,
  processPayment,
  approvePayment,
  rejectPayment,
  cancelOrder
} from '../controllers/orderController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Rutas para clientes
router.post('/', authenticateToken, authorizeRoles('client'), createOrder);
router.get('/my-orders', authenticateToken, authorizeRoles('client'), getMyOrders);
router.post('/:orderId/payment', authenticateToken, authorizeRoles('client'), processPayment);
router.post('/:id/cancel', authenticateToken, cancelOrder);

// Rutas para boosters
router.get('/my-booster-orders', authenticateToken, authorizeRoles('booster', 'admin'), getMyBoosterOrders);

// Rutas para admins
router.get('/all', authenticateToken, authorizeRoles('admin'), getAllOrders);
router.post('/:orderId/approve-payment', authenticateToken, authorizeRoles('admin'), approvePayment);
router.post('/:orderId/reject-payment', authenticateToken, authorizeRoles('admin'), rejectPayment);

// Rutas compartidas
router.get('/:id', authenticateToken, getOrderById);
router.patch('/:id/status', authenticateToken, authorizeRoles('booster', 'admin'), updateOrderStatus);
router.patch('/:id/progress', authenticateToken, authorizeRoles('booster', 'admin'), updateOrderProgress);

export default router;
