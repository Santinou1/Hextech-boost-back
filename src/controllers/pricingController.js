import { query, queryOne, run } from '../database/db.js';
import { calculateBoostPrice } from '../services/bulkPricingService.js';

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

// Obtener cotizaciones de un booster (UNIFICADO: muestra bulk + individuales)
export const getBoosterPricing = (req, res) => {
  const { boosterId } = req.params;

  try {
    // Obtener precios individuales
    const individualPricing = query(`
      SELECT * FROM booster_pricing 
      WHERE booster_id = ? 
      ORDER BY from_rank, from_division
    `, [boosterId]);

    // Obtener configuración bulk
    const bulkConfig = queryOne(`
      SELECT league_base_prices, transition_costs, division_overrides
      FROM booster_bulk_pricing
      WHERE booster_id = ?
    `, [boosterId]);

    let bulkPricingConfig = null;
    if (bulkConfig) {
      bulkPricingConfig = {
        leagueBasePrices: bulkConfig.league_base_prices && bulkConfig.league_base_prices !== 'undefined'
          ? JSON.parse(bulkConfig.league_base_prices)
          : {},
        transitionCosts: bulkConfig.transition_costs && bulkConfig.transition_costs !== 'undefined'
          ? JSON.parse(bulkConfig.transition_costs)
          : {},
        divisionOverrides: bulkConfig.division_overrides && bulkConfig.division_overrides !== 'undefined'
          ? JSON.parse(bulkConfig.division_overrides)
          : {}
      };
    }

    res.json({ 
      individualPricing,
      bulkPricingConfig,
      hasBulkPricing: bulkConfig !== null,
      hasIndividualPricing: individualPricing.length > 0
    });
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

// Calcular precio para un boost específico (UNIFICADO: bulk + individual, soporta LP)
export const calculatePrice = (req, res) => {
  const { boosterId } = req.params;
  const { from_rank, from_division, to_rank, to_division, boost_type, from_lp, to_lp } = req.query;

  if (!from_rank || !to_rank) {
    return res.status(400).json({ error: 'Missing required parameters (from_rank, to_rank)' });
  }

  try {
    // Convertir LP a números si están presentes
    const fromLP = from_lp !== undefined ? parseInt(from_lp) : null;
    const toLP = to_lp !== undefined ? parseInt(to_lp) : null;
    
    // 1. Primero buscar precio individual específico (solo para rangos normales)
    let individualPricing = null;
    if (from_division && to_division) {
      individualPricing = queryOne(`
        SELECT * FROM booster_pricing 
        WHERE booster_id = ? 
          AND from_rank = ? 
          AND from_division = ? 
          AND to_rank = ? 
          AND to_division = ?
      `, [boosterId, from_rank, from_division, to_rank, to_division]);
    }

    let basePrice = null;
    let priceSource = null;

    if (individualPricing) {
      // Usar precio individual si existe
      basePrice = individualPricing.price;
      priceSource = 'individual';
    } else {
      // 2. Si no hay precio individual, calcular con bulk pricing
      const bulkConfig = queryOne(`
        SELECT league_base_prices, transition_costs, division_overrides
        FROM booster_bulk_pricing
        WHERE booster_id = ?
      `, [boosterId]);

      if (bulkConfig) {
        try {
          // Obtener TODOS los precios individuales para considerarlos en el cálculo
          const allIndividualPrices = query(`
            SELECT from_rank, from_division, to_rank, to_division, price
            FROM booster_pricing
            WHERE booster_id = ?
          `, [boosterId]);
          
          const leagueBasePrices = bulkConfig.league_base_prices && bulkConfig.league_base_prices !== 'undefined'
            ? JSON.parse(bulkConfig.league_base_prices)
            : {};
          
          const transitionCosts = bulkConfig.transition_costs && bulkConfig.transition_costs !== 'undefined'
            ? JSON.parse(bulkConfig.transition_costs)
            : {};
          
          const divisionOverrides = bulkConfig.division_overrides && bulkConfig.division_overrides !== 'undefined'
            ? JSON.parse(bulkConfig.division_overrides)
            : {};

          const parsedConfig = {
            leagueBasePrices,
            transitionCosts,
            divisionOverrides
          };

          const bulkResult = calculateBoostPrice(
            parsedConfig,
            from_rank,
            from_division || null,
            to_rank,
            to_division || null,
            allIndividualPrices,
            fromLP,
            toLP
          );

          basePrice = bulkResult.total;
          priceSource = 'bulk';
        } catch (bulkError) {
          console.error('Error calculating bulk price:', bulkError);
          return res.status(400).json({ 
            error: bulkError.message || 'Error calculating price with bulk configuration'
          });
        }
      }
    }

    if (basePrice === null) {
      return res.status(404).json({ 
        error: 'No pricing found. Please configure either individual prices or bulk pricing.' 
      });
    }

    let finalPrice = basePrice;
    let breakdown = [];

    // Crear breakdown básico
    if (priceSource === 'individual') {
      breakdown.push({
        type: 'individual',
        description: `Precio individual: ${from_rank} ${from_division} → ${to_rank} ${to_division}`,
        cost: basePrice
      });
    } else {
      // Si es bulk, el breakdown ya viene del servicio
      const bulkConfig = queryOne(`
        SELECT league_base_prices, transition_costs, division_overrides
        FROM booster_bulk_pricing
        WHERE booster_id = ?
      `, [boosterId]);

      if (bulkConfig) {
        const allIndividualPrices = query(`
          SELECT from_rank, from_division, to_rank, to_division, price
          FROM booster_pricing
          WHERE booster_id = ?
        `, [boosterId]);
        
        const leagueBasePrices = bulkConfig.league_base_prices && bulkConfig.league_base_prices !== 'undefined'
          ? JSON.parse(bulkConfig.league_base_prices)
          : {};
        
        const transitionCosts = bulkConfig.transition_costs && bulkConfig.transition_costs !== 'undefined'
          ? JSON.parse(bulkConfig.transition_costs)
          : {};
        
        const divisionOverrides = bulkConfig.division_overrides && bulkConfig.division_overrides !== 'undefined'
          ? JSON.parse(bulkConfig.division_overrides)
          : {};

        const parsedConfig = {
          leagueBasePrices,
          transitionCosts,
          divisionOverrides
        };

        const bulkResult = calculateBoostPrice(
          parsedConfig,
          from_rank,
          from_division || null,
          to_rank,
          to_division || null,
          allIndividualPrices,
          fromLP,
          toLP
        );

        breakdown = bulkResult.breakdown || [];
      }
    }

    // Aplicar costo adicional de duo si aplica
    if (boost_type === 'duo') {
      const profile = queryOne('SELECT duo_extra_cost FROM booster_profiles WHERE user_id = ?', [boosterId]);
      if (profile && profile.duo_extra_cost) {
        const duoCost = basePrice * (profile.duo_extra_cost / 100);
        breakdown.push({
          type: 'duo_extra',
          description: `Duo Boost (+${profile.duo_extra_cost}%)`,
          cost: duoCost
        });
        finalPrice = finalPrice * (1 + profile.duo_extra_cost / 100);
      }
    }

    res.json({
      base_price: basePrice,
      final_price: parseFloat(finalPrice.toFixed(2)),
      price_source: priceSource,
      breakdown: breakdown,
      estimated_hours: individualPricing?.estimated_hours || null,
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
