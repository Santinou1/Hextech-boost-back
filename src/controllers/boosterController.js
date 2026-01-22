import { query, queryOne, run } from '../database/db.js';

export const getAllBoosters = (req, res) => {
  try {
    const boosters = query(`
      SELECT 
        bp.*,
        u.username,
        u.email
      FROM booster_profiles bp
      JOIN users u ON bp.user_id = u.id
      WHERE bp.available = 1
      ORDER BY bp.rating DESC, bp.win_rate DESC
    `);

    res.json({ boosters });
  } catch (error) {
    console.error('Get boosters error:', error);
    res.status(500).json({ error: 'Error fetching boosters' });
  }
};

export const getBoosterById = (req, res) => {
  const { id } = req.params;

  try {
    const booster = queryOne(`
      SELECT 
        bp.*,
        u.username,
        u.email
      FROM booster_profiles bp
      JOIN users u ON bp.user_id = u.id
      WHERE bp.id = ?
    `, [id]);

    if (!booster) {
      return res.status(404).json({ error: 'Booster not found' });
    }

    const reviews = query(`
      SELECT 
        r.*,
        u.username as client_username,
        o.order_number
      FROM reviews r
      JOIN users u ON r.client_id = u.id
      JOIN orders o ON r.order_id = o.id
      WHERE r.booster_id = ?
      ORDER BY r.created_at DESC
      LIMIT 10
    `, [booster.user_id]);

    res.json({ booster, reviews });
  } catch (error) {
    console.error('Get booster error:', error);
    res.status(500).json({ error: 'Error fetching booster' });
  }
};

export const upsertBoosterProfile = (req, res) => {
  const {
    display_name,
    current_rank,
    peak_rank,
    main_roles,
    main_champions,
    languages,
    server,
    duo_extra_cost,
    bio,
    avatar_url
  } = req.body;

  if (!display_name || !current_rank || !peak_rank || !main_roles || !languages || !server) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const existingProfile = queryOne('SELECT id FROM booster_profiles WHERE user_id = ?', [req.user.id]);

    if (existingProfile) {
      run(`
        UPDATE booster_profiles SET
          display_name = ?,
          current_rank = ?,
          peak_rank = ?,
          main_roles = ?,
          main_champions = ?,
          languages = ?,
          server = ?,
          duo_extra_cost = ?,
          bio = ?,
          avatar_url = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `, [
        display_name, 
        current_rank, 
        peak_rank, 
        main_roles, 
        main_champions || null,
        languages, 
        server, 
        duo_extra_cost || 20,
        bio || null, 
        avatar_url || null, 
        req.user.id
      ]);

      const profile = queryOne('SELECT * FROM booster_profiles WHERE user_id = ?', [req.user.id]);
      return res.json({ message: 'Profile updated successfully', profile });
    } else {
      const result = run(`
        INSERT INTO booster_profiles (
          user_id, display_name, current_rank, peak_rank, main_roles, main_champions,
          languages, server, duo_extra_cost, bio, avatar_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        req.user.id, 
        display_name, 
        current_rank, 
        peak_rank, 
        main_roles, 
        main_champions || null,
        languages, 
        server, 
        duo_extra_cost || 20, 
        bio || null, 
        avatar_url || null
      ]);

      const profile = queryOne('SELECT * FROM booster_profiles WHERE id = ?', [result.lastInsertRowid]);
      return res.status(201).json({ message: 'Profile created successfully', profile });
    }
  } catch (error) {
    console.error('Upsert booster profile error:', error);
    res.status(500).json({ error: 'Error saving booster profile' });
  }
};

export const getMyBoosterProfile = (req, res) => {
  try {
    const profile = queryOne('SELECT * FROM booster_profiles WHERE user_id = ?', [req.user.id]);

    if (!profile) {
      return res.status(404).json({ error: 'Booster profile not found. Please complete your profile first.' });
    }

    res.json({ profile });
  } catch (error) {
    console.error('Get my booster profile error:', error);
    res.status(500).json({ error: 'Error fetching booster profile' });
  }
};

export const toggleAvailability = (req, res) => {
  try {
    const profile = queryOne('SELECT available FROM booster_profiles WHERE user_id = ?', [req.user.id]);

    if (!profile) {
      return res.status(404).json({ error: 'Booster profile not found' });
    }

    const newAvailability = profile.available === 1 ? 0 : 1;

    run('UPDATE booster_profiles SET available = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      [newAvailability, req.user.id]);

    res.json({ 
      message: `Availability set to ${newAvailability ? 'available' : 'unavailable'}`,
      available: newAvailability
    });
  } catch (error) {
    console.error('Toggle availability error:', error);
    res.status(500).json({ error: 'Error toggling availability' });
  }
};
