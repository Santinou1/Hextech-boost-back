import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDB } from './database/db.js';

// Routes
import authRoutes from './routes/authRoutes.js';
import boosterRoutes from './routes/boosterRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import matchRoutes from './routes/matchRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import pricingRoutes from './routes/pricingRoutes.js';
import bulkPricingRoutes from './routes/bulkPricingRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Initialize database connection
await initDB();

// Health check
app.get('/', (req, res) => {
  res.json({ 
    message: 'Hextech Boost API',
    version: '1.0.0',
    status: 'running'
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/boosters', boosterRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/pricing/bulk', bulkPricingRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Hextech Boost API running on http://localhost:${PORT}`);
  console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`\n📋 Available endpoints:`);
  console.log(`   GET  /health`);
  console.log(`   POST /api/auth/register`);
  console.log(`   POST /api/auth/login`);
  console.log(`   GET  /api/auth/profile`);
  console.log(`   GET  /api/boosters`);
  console.log(`   GET  /api/boosters/:id`);
  console.log(`   POST /api/orders`);
  console.log(`   GET  /api/orders/my-orders`);
  console.log(`   POST /api/matches/order/:order_id`);
  console.log(`   POST /api/reviews`);
  console.log(`\n✅ Server ready!\n`);
});
