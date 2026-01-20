import { getDB } from '../database/db.js';
import { calculateBoostPrice, validateBulkConfig } from '../services/bulkPricingService.js';

/**
 * GET /api/pricing/bulk/my-config
 * Obtener configuración bulk del booster autenticado
 */
export const getMyBulkConfig = (req, res) => {
  try {
    const boosterId = req.user.id;
    const db = getDB();
    
    const config = db.prepare(`
      SELECT league_base_prices, transition_costs, division_overrides
      FROM booster_bulk_pricing
      WHERE booster_id = ?
    `).get(boosterId);
    
    if (!config) {
      return res.json({
        success: true,
        data: null,
        message: 'No bulk pricing configuration found'
      });
    }
    
    res.json({
      success: true,
      data: {
        leagueBasePrices: JSON.parse(config.league_base_prices),
        transitionCosts: JSON.parse(config.transition_costs),
        divisionOverrides: config.division_overrides ? JSON.parse(config.division_overrides) : {}
      }
    });
  } catch (error) {
    console.error('Error getting bulk config:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving bulk pricing configuration'
    });
  }
};

/**
 * POST /api/pricing/bulk/my-config
 * Guardar/actualizar configuración bulk
 */
export const upsertMyBulkConfig = (req, res) => {
  try {
    const boosterId = req.user.id;
    const { leagueBasePrices, transitionCosts, divisionOverrides = {} } = req.body;
    const db = getDB();
    
    // Validar configuración
    const validation = validateBulkConfig({ leagueBasePrices, transitionCosts });
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid configuration',
        errors: validation.errors
      });
    }
    
    // Verificar si existe configuración
    const existing = db.prepare(`
      SELECT id FROM booster_bulk_pricing WHERE booster_id = ?
    `).get(boosterId);
    
    if (existing) {
      // Actualizar
      db.prepare(`
        UPDATE booster_bulk_pricing
        SET league_base_prices = ?,
            transition_costs = ?,
            division_overrides = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE booster_id = ?
      `).run(
        JSON.stringify(leagueBasePrices),
        JSON.stringify(transitionCosts),
        JSON.stringify(divisionOverrides),
        boosterId
      );
    } else {
      // Insertar
      db.prepare(`
        INSERT INTO booster_bulk_pricing 
        (booster_id, league_base_prices, transition_costs, division_overrides)
        VALUES (?, ?, ?, ?)
      `).run(
        boosterId,
        JSON.stringify(leagueBasePrices),
        JSON.stringify(transitionCosts),
        JSON.stringify(divisionOverrides)
      );
    }
    
    res.json({
      success: true,
      message: 'Bulk pricing configuration saved successfully'
    });
  } catch (error) {
    console.error('Error saving bulk config:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving bulk pricing configuration'
    });
  }
};

/**
 * POST /api/pricing/bulk/calculate
 * Calcular precio de un boost
 */
export const calculatePrice = (req, res) => {
  try {
    const { boosterId, fromLeague, fromDivision, toLeague, toDivision } = req.body;
    const db = getDB();
    
    // Validar inputs
    if (!boosterId || !fromLeague || !fromDivision || !toLeague || !toDivision) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters'
      });
    }
    
    // Obtener configuración del booster
    const config = db.prepare(`
      SELECT league_base_prices, transition_costs, division_overrides
      FROM booster_bulk_pricing
      WHERE booster_id = ?
    `).get(boosterId);
    
    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Booster has no bulk pricing configuration'
      });
    }
    
    const parsedConfig = {
      leagueBasePrices: JSON.parse(config.league_base_prices),
      transitionCosts: JSON.parse(config.transition_costs),
      divisionOverrides: config.division_overrides ? JSON.parse(config.division_overrides) : {}
    };
    
    // Calcular precio
    const result = calculateBoostPrice(
      parsedConfig,
      fromLeague,
      fromDivision,
      toLeague,
      toDivision
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error calculating price:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error calculating price'
    });
  }
};
