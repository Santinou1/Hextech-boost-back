import { query, queryOne, run } from '../database/db.js';

// ==================== BOOSTER PRICING ====================

// Crear o actualizar múltiples cotizaciones
export const upsertPricing = (req, res) => {
  const boosterId = req.user.id;
  const { pricing } = req.body; // Array de cotizaciones

  if (!pricing || !Array.isArray(pricing) || pricing.length === 0) {
    return res.status(400).json({ error: 'Pricing array is required' });
  }

  try {
    // Validar que el usuario sea un booster
    const user = queryOne('SELECT role FROM users WHERE id = ?', [boosterId]);
    if (!user || user.role !== 'booster') {
      return res.status(403).json({ error: 'Only boosters can set pricing' });
    }

    // Eliminar cotizaciones existentes
    run('DELETE FROM booster_pricing WHERE booster_id = ?', [boosterId]);

    // Insertar nuevas cotizaciones
    pricing.forEach(item => {
      const { from_rank, from_division, to_rank, to_division, price, estimated_hours } = item;

      if (!from_rank || !from_division || !to_rank || !to_division || !price) {
        return;
      }

      run(`
        INSERT INTO booster_pricing (
          booster_id, from_rank, from_division, to_rank, to_division, price, estimated_hours
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [boosterId, from_rank, from_division, to_rank, to_division, price, estimated_hours || null]);
    });

    const savedPricing = query('SELECT * FROM booster_pricing WHERE booster_id = ? ORDER BY id', [boosterId]);

    res.json({
      message: 'Pricing saved successfully',
      pricing: savedPricing
    });
  } catch (error) {
    console.error('Upsert pricing error:', error);
    res.status(500).json({ error: 'Error saving pricing' });
  }
};

// Obtener cotizaciones de un booster
export const getBoosterPricing = (req, res) => {
  const { boosterId } = req.params;

  try {
    const pricing = query(`
      SELECT * FROM booster_pricing 
      WHERE booster_id = ? 
      ORDER BY from_rank, from_division
    `, [boosterId]);

    res.json({ pricing });
  } catch (error) {
    console.error('Get booster pricing error:', error);
    res.status(500).json({ error: 'Error fetching pricing' });
  }
};

// Obtener mis cotizaciones (booster autenticado)
export const getMyPricing = (req, res) => {
  const boosterId = req.user.id;

  try {
    const pricing = query(`
      SELECT * FROM booster_pricing 
      WHERE booster_id = ? 
      ORDER BY from_rank, from_division
    `, [boosterId]);

    res.json({ pricing });
  } catch (error) {
    console.error('Get my pricing error:', error);
    res.status(500).json({ error: 'Error fetching pricing' });
  }
};

// Calcular precio para un boost específico
export const calculatePrice = (req, res) => {
  const { boosterId } = req.params;
  const { from_rank, from_division, to_rank, to_division, boost_type } = req.query;

  if (!from_rank || !from_division || !to_rank || !to_division) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    // Buscar cotización exacta
    const pricing = queryOne(`
      SELECT * FROM booster_pricing 
      WHERE booster_id = ? 
        AND from_rank = ? 
        AND from_division = ? 
        AND to_rank = ? 
        AND to_division = ?
    `, [boosterId, from_rank, from_division, to_rank, to_division]);

    if (!pricing) {
      return res.status(404).json({ error: 'Pricing not found for this rank combination' });
    }

    let finalPrice = pricing.price;

    // Aplicar descuento de duo si aplica
    if (boost_type === 'duo') {
      const profile = queryOne('SELECT duo_discount FROM booster_profiles WHERE user_id = ?', [boosterId]);
      if (profile && profile.duo_discount) {
        finalPrice = finalPrice * (1 - profile.duo_discount / 100);
      }
    }

    res.json({
      base_price: pricing.price,
      final_price: parseFloat(finalPrice.toFixed(2)),
      estimated_hours: pricing.estimated_hours,
      boost_type: boost_type || 'solo'
    });
  } catch (error) {
    console.error('Calculate price error:', error);
    res.status(500).json({ error: 'Error calculating price' });
  }
};

// Eliminar una cotización específica
export const deletePricing = (req, res) => {
  const boosterId = req.user.id;
  const { id } = req.params;

  try {
    const pricing = queryOne('SELECT id FROM booster_pricing WHERE id = ? AND booster_id = ?', [id, boosterId]);

    if (!pricing) {
      return res.status(404).json({ error: 'Pricing not found' });
    }

    run('DELETE FROM booster_pricing WHERE id = ?', [id]);

    res.json({ message: 'Pricing deleted successfully' });
  } catch (error) {
    console.error('Delete pricing error:', error);
    res.status(500).json({ error: 'Error deleting pricing' });
  }
};
