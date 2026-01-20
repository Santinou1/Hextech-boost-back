import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  requireAdmin,
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getAllBoostersAdmin,
  updateBoosterProfile,
  getAllOrdersAdmin,
  updateOrderAdmin,
  getStatistics
} from '../controllers/adminController.js';

const router = express.Router();

// Todas las rutas requieren autenticación y rol de admin
router.use(authenticateToken);
router.use(requireAdmin);

// ==================== STATISTICS ====================
router.get('/statistics', getStatistics);

// ==================== USERS ====================
router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

// ==================== BOOSTERS ====================
router.get('/boosters', getAllBoostersAdmin);
router.put('/boosters/:id', updateBoosterProfile);

// ==================== ORDERS ====================
router.get('/orders', getAllOrdersAdmin);
router.put('/orders/:id', updateOrderAdmin);

export default router;
