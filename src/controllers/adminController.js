import { query, queryOne, run } from '../database/db.js';
import bcrypt from 'bcryptjs';

// Middleware para verificar que el usuario es admin
export const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }
  next();
};

// ==================== USERS ====================

export const getAllUsers = (req, res) => {
  try {
    const users = query(`
      SELECT id, email, username, role, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
    `);

    res.json({
      users,
      total: users.length
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Error fetching users' });
  }
};

export const getUserById = (req, res) => {
  const { id } = req.params;

  try {
    const user = queryOne(`
      SELECT id, email, username, role, created_at, updated_at
      FROM users
      WHERE id = ?
    `, [id]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user by id error:', error);
    res.status(500).json({ error: 'Error fetching user' });
  }
};

export const updateUser = (req, res) => {
  const { id } = req.params;
  const { email, username, role } = req.body;

  try {
    const user = queryOne('SELECT id FROM users WHERE id = ?', [id]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (role && !['client', 'booster', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const updates = [];
    const values = [];

    if (email) {
      updates.push('email = ?');
      values.push(email);
    }
    if (username) {
      updates.push('username = ?');
      values.push(username);
    }
    if (role) {
      updates.push('role = ?');
      values.push(role);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    run(`
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = ?
    `, values);

    const updatedUser = queryOne(`
      SELECT id, email, username, role, created_at, updated_at
      FROM users
      WHERE id = ?
    `, [id]);

    res.json({
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Error updating user' });
  }
};

export const deleteUser = (req, res) => {
  const { id } = req.params;

  try {
    // No permitir que el admin se elimine a sí mismo
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const user = queryOne('SELECT id FROM users WHERE id = ?', [id]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    run('DELETE FROM users WHERE id = ?', [id]);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Error deleting user' });
  }
};

export const createUser = (req, res) => {
  const { email, password, username, role = 'client' } = req.body;

  if (!email || !password || !username) {
    return res.status(400).json({ error: 'Email, password and username are required' });
  }

  if (!['client', 'booster', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const existingUser = queryOne('SELECT id FROM users WHERE email = ? OR username = ?', [email, username]);

    if (existingUser) {
      return res.status(409).json({ error: 'Email or username already exists' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    const result = run(`
      INSERT INTO users (email, password, username, role)
      VALUES (?, ?, ?, ?)
    `, [email, hashedPassword, username, role]);

    if (!result || !result.lastInsertRowid) {
      throw new Error('Failed to insert user');
    }

    const user = queryOne(`
      SELECT id, email, username, role, created_at
      FROM users
      WHERE id = ?
    `, [result.lastInsertRowid]);

    res.status(201).json({
      message: 'User created successfully',
      user
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Error creating user' });
  }
};

// ==================== BOOSTERS ====================

export const getAllBoostersAdmin = (req, res) => {
  try {
    const boosters = query(`
      SELECT 
        u.id as user_id,
        u.email,
        u.username,
        u.created_at as user_created_at,
        bp.*
      FROM users u
      LEFT JOIN booster_profiles bp ON u.id = bp.user_id
      WHERE u.role = 'booster'
      ORDER BY u.created_at DESC
    `);

    res.json({
      boosters,
      total: boosters.length
    });
  } catch (error) {
    console.error('Get all boosters admin error:', error);
    res.status(500).json({ error: 'Error fetching boosters' });
  }
};

export const updateBoosterProfile = (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const profile = queryOne('SELECT id FROM booster_profiles WHERE user_id = ?', [id]);

    if (!profile) {
      return res.status(404).json({ error: 'Booster profile not found' });
    }

    const allowedFields = [
      'display_name', 'current_rank', 'peak_rank', 'main_roles', 'main_champions',
      'languages', 'server', 'win_rate', 'total_orders', 'completed_orders',
      'rating', 'total_reviews', 'price_per_division', 'price_per_win',
      'duo_discount', 'available', 'bio', 'avatar_url'
    ];

    const updateFields = [];
    const values = [];

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    run(`
      UPDATE booster_profiles
      SET ${updateFields.join(', ')}
      WHERE user_id = ?
    `, values);

    const updatedProfile = queryOne(`
      SELECT * FROM booster_profiles WHERE user_id = ?
    `, [id]);

    res.json({
      message: 'Booster profile updated successfully',
      profile: updatedProfile
    });
  } catch (error) {
    console.error('Update booster profile error:', error);
    res.status(500).json({ error: 'Error updating booster profile' });
  }
};

// ==================== ORDERS ====================

export const getAllOrdersAdmin = (req, res) => {
  try {
    const orders = query(`
      SELECT 
        o.*,
        c.username as client_username,
        c.email as client_email,
        b.username as booster_username,
        b.email as booster_email
      FROM orders o
      LEFT JOIN users c ON o.client_id = c.id
      LEFT JOIN users b ON o.booster_id = b.id
      ORDER BY o.created_at DESC
    `);

    res.json({
      orders,
      total: orders.length
    });
  } catch (error) {
    console.error('Get all orders admin error:', error);
    res.status(500).json({ error: 'Error fetching orders' });
  }
};

export const updateOrderAdmin = (req, res) => {
  const { id } = req.params;
  const { status, booster_id, progress_percentage } = req.body;

  try {
    const order = queryOne('SELECT id FROM orders WHERE id = ?', [id]);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const updates = [];
    const values = [];

    if (status) {
      if (!['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      updates.push('status = ?');
      values.push(status);

      if (status === 'completed') {
        updates.push('completed_at = CURRENT_TIMESTAMP');
      }
    }

    if (booster_id !== undefined) {
      updates.push('booster_id = ?');
      values.push(booster_id);
    }

    if (progress_percentage !== undefined) {
      updates.push('progress_percentage = ?');
      values.push(progress_percentage);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    run(`
      UPDATE orders
      SET ${updates.join(', ')}
      WHERE id = ?
    `, values);

    const updatedOrder = queryOne('SELECT * FROM orders WHERE id = ?', [id]);

    res.json({
      message: 'Order updated successfully',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Update order admin error:', error);
    res.status(500).json({ error: 'Error updating order' });
  }
};

// ==================== STATISTICS ====================

export const getStatistics = (req, res) => {
  try {
    const totalUsers = queryOne('SELECT COUNT(*) as count FROM users WHERE role = "client"')?.count || 0;
    const totalBoosters = queryOne('SELECT COUNT(*) as count FROM users WHERE role = "booster"')?.count || 0;
    const totalOrders = queryOne('SELECT COUNT(*) as count FROM orders')?.count || 0;
    const completedOrders = queryOne('SELECT COUNT(*) as count FROM orders WHERE status = "completed"')?.count || 0;
    const pendingOrders = queryOne('SELECT COUNT(*) as count FROM orders WHERE status = "pending"')?.count || 0;
    const inProgressOrders = queryOne('SELECT COUNT(*) as count FROM orders WHERE status = "in_progress"')?.count || 0;
    
    const totalRevenue = queryOne('SELECT SUM(total_price) as total FROM orders WHERE status = "completed"')?.total || 0;
    const avgOrderValue = queryOne('SELECT AVG(total_price) as avg FROM orders WHERE status = "completed"')?.avg || 0;

    const recentOrders = query(`
      SELECT 
        o.*,
        c.username as client_username,
        b.username as booster_username
      FROM orders o
      LEFT JOIN users c ON o.client_id = c.id
      LEFT JOIN users b ON o.booster_id = b.id
      ORDER BY o.created_at DESC
      LIMIT 10
    `);

    res.json({
      statistics: {
        users: {
          total: totalUsers,
          boosters: totalBoosters,
          clients: totalUsers
        },
        orders: {
          total: totalOrders,
          completed: completedOrders,
          pending: pendingOrders,
          inProgress: inProgressOrders
        },
        revenue: {
          total: parseFloat(totalRevenue).toFixed(2),
          average: parseFloat(avgOrderValue).toFixed(2)
        }
      },
      recentOrders
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({ error: 'Error fetching statistics' });
  }
};
