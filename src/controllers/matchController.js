import { query, queryOne, run } from '../database/db.js';

export const addMatch = (req, res) => {
  const { order_id } = req.params;
  const { champion, champion_img, result, kills, deaths, assists, gold, cs, cs_per_min, duration, level, lp_change } = req.body;

  if (!champion || !result || kills === undefined || deaths === undefined || assists === undefined || !duration || !lp_change) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!['victory', 'defeat'].includes(result)) {
    return res.status(400).json({ error: 'Result must be victory or defeat' });
  }

  try {
    const order = queryOne('SELECT * FROM orders WHERE id = ?', [order_id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.booster_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const kda_ratio = deaths === 0 ? (kills + assists) : ((kills + assists) / deaths);

    const matchResult = run(`INSERT INTO matches (order_id, champion, champion_img, result, kills, deaths, assists, kda_ratio, gold, cs, cs_per_min, duration, level, lp_change) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [order_id, champion, champion_img, result, kills, deaths, assists, kda_ratio, gold, cs, cs_per_min, duration, level, lp_change]);

    const newLP = order.current_lp + lp_change;
    run('UPDATE orders SET current_lp = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newLP, order_id]);

    const allMatches = query(`SELECT result FROM matches m JOIN orders o ON m.order_id = o.id WHERE o.booster_id = ?`, [req.user.id]);
    const wins = allMatches.filter(m => m.result === 'victory').length;
    const winRate = allMatches.length > 0 ? (wins / allMatches.length) * 100 : 0;
    run('UPDATE booster_profiles SET win_rate = ? WHERE user_id = ?', [winRate, req.user.id]);

    const match = queryOne('SELECT * FROM matches WHERE id = ?', [matchResult.lastInsertRowid]);
    res.status(201).json({ message: 'Match added successfully', match, new_lp: newLP });
  } catch (error) {
    console.error('Add match error:', error);
    res.status(500).json({ error: 'Error adding match' });
  }
};

export const getMatchesByOrder = (req, res) => {
  const { order_id } = req.params;
  try {
    const order = queryOne('SELECT * FROM orders WHERE id = ?', [order_id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.client_id !== req.user.id && order.booster_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const matches = query(`SELECT * FROM matches WHERE order_id = ? ORDER BY played_at DESC`, [order_id]);

    const stats = {
      total_matches: matches.length,
      wins: matches.filter(m => m.result === 'victory').length,
      losses: matches.filter(m => m.result === 'defeat').length,
      win_rate: matches.length > 0 ? (matches.filter(m => m.result === 'victory').length / matches.length * 100).toFixed(1) : 0,
      avg_kda: matches.length > 0 ? (matches.reduce((sum, m) => sum + m.kda_ratio, 0) / matches.length).toFixed(2) : 0,
      total_lp_gained: matches.reduce((sum, m) => sum + m.lp_change, 0)
    };

    res.json({ matches, stats });
  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({ error: 'Error fetching matches' });
  }
};

export const deleteMatch = (req, res) => {
  const { id } = req.params;
  try {
    const match = queryOne(`SELECT m.*, o.booster_id, o.current_lp, o.id as order_id FROM matches m JOIN orders o ON m.order_id = o.id WHERE m.id = ?`, [id]);
    if (!match) return res.status(404).json({ error: 'Match not found' });
    if (match.booster_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const newLP = match.current_lp - match.lp_change;
    run('UPDATE orders SET current_lp = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newLP, match.order_id]);
    run('DELETE FROM matches WHERE id = ?', [id]);

    res.json({ message: 'Match deleted successfully', new_lp: newLP });
  } catch (error) {
    console.error('Delete match error:', error);
    res.status(500).json({ error: 'Error deleting match' });
  }
};
