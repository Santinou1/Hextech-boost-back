import { query, queryOne, run } from '../database/db.js';

export const createReview = (req, res) => {
  const { order_id, rating, comment } = req.body;

  if (!order_id || !rating) {
    return res.status(400).json({ error: 'Order ID and rating are required' });
  }

  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  try {
    const order = queryOne('SELECT * FROM orders WHERE id = ?', [order_id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.client_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only review your own orders' });
    }
    if (order.status !== 'completed') {
      return res.status(400).json({ error: 'Order must be completed to leave a review' });
    }

    const existingReview = queryOne('SELECT id FROM reviews WHERE order_id = ?', [order_id]);
    if (existingReview) {
      return res.status(409).json({ error: 'Review already exists for this order' });
    }

    const result = run(`INSERT INTO reviews (order_id, client_id, booster_id, rating, comment) VALUES (?, ?, ?, ?, ?)`,
      [order_id, req.user.id, order.booster_id, rating, comment]);

    const allReviews = query('SELECT rating FROM reviews WHERE booster_id = ?', [order.booster_id]);
    const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    run('UPDATE booster_profiles SET rating = ?, total_reviews = ? WHERE user_id = ?',
      [avgRating, allReviews.length, order.booster_id]);

    const review = queryOne('SELECT * FROM reviews WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ message: 'Review created successfully', review });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ error: 'Error creating review' });
  }
};

export const getBoosterReviews = (req, res) => {
  const { booster_id } = req.params;
  try {
    const reviews = query(`SELECT r.*, u.username as client_username, o.order_number, o.current_rank, o.desired_rank FROM reviews r JOIN users u ON r.client_id = u.id JOIN orders o ON r.order_id = o.id WHERE r.booster_id = ? ORDER BY r.created_at DESC`, [booster_id]);

    const stats = {
      total_reviews: reviews.length,
      average_rating: reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : 0,
      rating_distribution: {
        5: reviews.filter(r => r.rating === 5).length,
        4: reviews.filter(r => r.rating === 4).length,
        3: reviews.filter(r => r.rating === 3).length,
        2: reviews.filter(r => r.rating === 2).length,
        1: reviews.filter(r => r.rating === 1).length
      }
    };

    res.json({ reviews, stats });
  } catch (error) {
    console.error('Get booster reviews error:', error);
    res.status(500).json({ error: 'Error fetching reviews' });
  }
};

export const getAllReviews = (req, res) => {
  try {
    const reviews = query(`SELECT r.*, u.username as client_username, bu.username as booster_username, o.order_number FROM reviews r JOIN users u ON r.client_id = u.id JOIN users bu ON r.booster_id = bu.id JOIN orders o ON r.order_id = o.id ORDER BY r.created_at DESC`);
    res.json({ reviews });
  } catch (error) {
    console.error('Get all reviews error:', error);
    res.status(500).json({ error: 'Error fetching reviews' });
  }
};
