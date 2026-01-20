import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, queryOne, run } from '../database/db.js';

export const register = (req, res) => {
  const { email, password, username, role = 'client' } = req.body;

  if (!email || !password || !username) {
    return res.status(400).json({ error: 'Email, password and username are required' });
  }

  if (!['client', 'booster'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be client or booster' });
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

    const userId = result.lastInsertRowid;
    const user = queryOne('SELECT id, email, username, role, created_at FROM users WHERE id = ?', [userId]);
    
    if (!user) {
      throw new Error('Failed to retrieve created user');
    }
    
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      user,
      token
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ 
      error: 'Error registering user',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const login = (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = queryOne('SELECT * FROM users WHERE email = ?', [email]);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = bcrypt.compareSync(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error logging in' });
  }
};

export const getProfile = (req, res) => {
  try {
    const user = queryOne('SELECT id, email, username, role, created_at FROM users WHERE id = ?', [req.user.id]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Error fetching profile' });
  }
};
