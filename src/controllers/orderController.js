import { query, queryOne, run } from '../database/db.js';

const generateOrderNumber = () => '#' + Math.floor(10000 + Math.random() * 90000);

export const createOrder = (req, res) => {
  const { booster_id, boost_type, current_rank, current_division, desired_rank, desired_division, wins_requested, selected_champion, extras, total_price, estimated_completion_days } = req.body;

  if (!booster_id || !boost_type || !current_rank || !current_division || !desired_rank || !total_price) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const booster = queryOne(`SELECT bp.*, u.role FROM booster_profiles bp JOIN users u ON bp.user_id = u.id WHERE bp.user_id = ? AND bp.available = 1`, [booster_id]);

    if (!booster || booster.role !== 'booster') {
      return res.status(404).json({ error: 'Booster not found or unavailable' });
    }

    const orderNumber = generateOrderNumber();
    const result = run(`INSERT INTO orders (order_number, client_id, booster_id, status, boost_type, current_rank, current_division, desired_rank, desired_division, wins_requested, selected_champion, extras, total_price, estimated_completion_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderNumber, req.user.id, booster_id, 'pending', boost_type, current_rank, current_division, desired_rank, desired_division, wins_requested, selected_champion, JSON.stringify(extras || {}), total_price, estimated_completion_days]);

    run('UPDATE booster_profiles SET total_orders = total_orders + 1 WHERE user_id = ?', [booster_id]);

    const order = queryOne('SELECT * FROM orders WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ message: 'Order created successfully', order });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Error creating order' });
  }
};

export const getMyOrders = (req, res) => {
  try {
    const orders = query(`SELECT o.*, bp.display_name as booster_name, bp.current_rank as booster_rank, bp.avatar_url as booster_avatar FROM orders o LEFT JOIN booster_profiles bp ON o.booster_id = bp.user_id WHERE o.client_id = ? ORDER BY o.created_at DESC`, [req.user.id]);
    res.json({ orders });
  } catch (error) {
    console.error('Get my orders error:', error);
    res.status(500).json({ error: 'Error fetching orders' });
  }
};

export const getMyBoosterOrders = (req, res) => {
  try {
    const orders = query(`SELECT o.*, u.username as client_username, u.email as client_email FROM orders o JOIN users u ON o.client_id = u.id WHERE o.booster_id = ? ORDER BY o.created_at DESC`, [req.user.id]);
    res.json({ orders });
  } catch (error) {
    console.error('Get my booster orders error:', error);
    res.status(500).json({ error: 'Error fetching booster orders' });
  }
};

export const getOrderById = (req, res) => {
  const { id } = req.params;
  try {
    const order = queryOne(`SELECT o.*, u.username as client_username, u.email as client_email, bp.display_name as booster_name, bp.current_rank as booster_rank, bp.avatar_url as booster_avatar FROM orders o JOIN users u ON o.client_id = u.id LEFT JOIN booster_profiles bp ON o.booster_id = bp.user_id WHERE o.id = ?`, [id]);

    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.client_id !== req.user.id && order.booster_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const matches = query(`SELECT * FROM matches WHERE order_id = ? ORDER BY played_at DESC`, [id]);
    res.json({ order, matches });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Error fetching order' });
  }
};

export const updateOrderStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const order = queryOne('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.booster_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    run(`UPDATE orders SET status = ?, completed_at = CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [status, status, id]);

    if (status === 'completed') {
      run('UPDATE booster_profiles SET completed_orders = completed_orders + 1 WHERE user_id = ?', [order.booster_id]);
    }

    const updatedOrder = queryOne('SELECT * FROM orders WHERE id = ?', [id]);
    res.json({ message: 'Order status updated successfully', order: updatedOrder });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Error updating order status' });
  }
};

export const updateOrderProgress = (req, res) => {
  const { id } = req.params;
  const { current_lp, progress_percentage } = req.body;

  try {
    const order = queryOne('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.booster_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    run(`UPDATE orders SET current_lp = COALESCE(?, current_lp), progress_percentage = COALESCE(?, progress_percentage), updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [current_lp, progress_percentage, id]);

    const updatedOrder = queryOne('SELECT * FROM orders WHERE id = ?', [id]);
    res.json({ message: 'Order progress updated successfully', order: updatedOrder });
  } catch (error) {
    console.error('Update order progress error:', error);
    res.status(500).json({ error: 'Error updating order progress' });
  }
};
