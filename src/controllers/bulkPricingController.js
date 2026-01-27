import { getDB, run, query, queryOne, saveDB } from '../database/db.js';
import { calculateBoostPrice, validateBulkConfig } from '../services/bulkPricingService.js';

/**
 * GET /api/pricing/bulk/my-config
 * Obtener configuración bulk del booster autenticado
 */
export const getMyBulkConfig = (req, res) => {
  try {
    const boosterId = req.user.id;
    
    const config = queryOne(`
      SELECT league_base_prices, transition_costs, division_overrides
      FROM booster_bulk_pricing
      WHERE booster_id = ?
    `, [boosterId]);
    
    if (!config) {
      return res.json({
        success: true,
        data: null,
        message: 'No bulk pricing configuration found'
      });
    }
    
    // Validar que los campos no sean undefined o null antes de parsear
    const leagueBasePrices = config.league_base_prices && config.league_base_prices !== 'undefined' 
      ? JSON.parse(config.league_base_prices) 
      : {};
    
    const transitionCosts = config.transition_costs && config.transition_costs !== 'undefined'
      ? JSON.parse(config.transition_costs)
      : {};
    
    const divisionOverrides = config.division_overrides && config.division_overrides !== 'undefined'
      ? JSON.parse(config.division_overrides)
      : {};
    
    res.json({
      success: true,
      data: {
        leagueBasePrices,
        transitionCosts,
        divisionOverrides
      }
    });
  } catch (error) {
    console.error('Error getting bulk config:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving bulk pricing configuration',
      error: error.message
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
    const existing = queryOne(`SELECT id FROM booster_bulk_pricing WHERE booster_id = ?`, [boosterId]);
    
    if (existing) {
      // Actualizar
      run(`
        UPDATE booster_bulk_pricing
        SET league_base_prices = ?,
            transition_costs = ?,
            division_overrides = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE booster_id = ?
      `, [
        JSON.stringify(leagueBasePrices),
        JSON.stringify(transitionCosts),
        JSON.stringify(divisionOverrides),
        boosterId
      ]);
    } else {
      // Insertar
      run(`
        INSERT INTO booster_bulk_pricing 
        (booster_id, league_base_prices, transition_costs, division_overrides)
        VALUES (?, ?, ?, ?)
      `, [
        boosterId,
        JSON.stringify(leagueBasePrices),
        JSON.stringify(transitionCosts),
        JSON.stringify(divisionOverrides)
      ]);
    }
    
    res.json({
      success: true,
      message: 'Bulk pricing configuration saved successfully'
    });
  } catch (error) {
    console.error('Error saving bulk config:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving bulk pricing configuration',
      error: error.message
    });
  }
};

/**
 * POST /api/pricing/bulk/calculate
 * Calcular precio de un boost (soporta divisiones y LP)
 */
export const calculatePrice = (req, res) => {
  try {
    const { boosterId, fromLeague, fromDivision, toLeague, toDivision, fromLP, toLP } = req.body;
    
    // Validar inputs básicos
    if (!boosterId || !fromLeague || !toLeague) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters (boosterId, fromLeague, toLeague)'
      });
    }
    
    // Obtener configuración bulk del booster
    const config = queryOne(`
      SELECT league_base_prices, transition_costs, division_overrides
      FROM booster_bulk_pricing
      WHERE booster_id = ?
    `, [boosterId]);
    
    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Booster has no bulk pricing configuration. Please save your configuration first.'
      });
    }
    
    // Obtener precios individuales del booster
    const individualPrices = query(`
      SELECT from_rank, from_division, to_rank, to_division, price
      FROM booster_pricing
      WHERE booster_id = ?
    `, [boosterId]);
    
    // Validar que los campos no sean undefined o null antes de parsear
    const leagueBasePrices = config.league_base_prices && config.league_base_prices !== 'undefined'
      ? JSON.parse(config.league_base_prices)
      : {};
    
    const transitionCosts = config.transition_costs && config.transition_costs !== 'undefined'
      ? JSON.parse(config.transition_costs)
      : {};
    
    const divisionOverrides = config.division_overrides && config.division_overrides !== 'undefined'
      ? JSON.parse(config.division_overrides)
      : {};
    
    const parsedConfig = {
      leagueBasePrices,
      transitionCosts,
      divisionOverrides
    };
    
    // Calcular precio (pasando LP si están presentes)
    const result = calculateBoostPrice(
      parsedConfig,
      fromLeague,
      fromDivision || null,
      toLeague,
      toDivision || null,
      individualPrices,
      fromLP !== undefined ? parseInt(fromLP) : null,
      toLP !== undefined ? parseInt(toLP) : null
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
