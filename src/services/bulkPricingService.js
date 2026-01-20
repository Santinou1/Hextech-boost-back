const RANKS = [
  { name: 'Iron', divisions: ['IV', 'III', 'II', 'I'] },
  { name: 'Bronze', divisions: ['IV', 'III', 'II', 'I'] },
  { name: 'Silver', divisions: ['IV', 'III', 'II', 'I'] },
  { name: 'Gold', divisions: ['IV', 'III', 'II', 'I'] },
  { name: 'Platinum', divisions: ['IV', 'III', 'II', 'I'] },
  { name: 'Emerald', divisions: ['IV', 'III', 'II', 'I'] },
  { name: 'Diamond', divisions: ['IV', 'III', 'II', 'I'] }
];

/**
 * Calcula la posición absoluta de un rango/división
 */
function getRankPosition(leagueName, divisionName) {
  let position = 0;
  
  for (let i = 0; i < RANKS.length; i++) {
    if (RANKS[i].name === leagueName) {
      const divIndex = RANKS[i].divisions.indexOf(divisionName);
      if (divIndex === -1) {
        throw new Error(`Invalid division ${divisionName} for league ${leagueName}`);
      }
      return position + divIndex;
    }
    position += RANKS[i].divisions.length;
  }
  
  throw new Error(`Invalid league ${leagueName}`);
}

/**
 * Obtiene la liga de una posición
 */
function getLeagueFromPosition(position) {
  let currentPos = 0;
  
  for (const rank of RANKS) {
    if (position < currentPos + rank.divisions.length) {
      return rank.name;
    }
    currentPos += rank.divisions.length;
  }
  
  throw new Error(`Invalid position ${position}`);
}

/**
 * Calcula el precio de un boost
 */
function calculateBoostPrice(config, fromLeague, fromDivision, toLeague, toDivision) {
  const { leagueBasePrices, transitionCosts, divisionOverrides = {} } = config;
  
  // 1. Validar inputs
  const fromPos = getRankPosition(fromLeague, fromDivision);
  const toPos = getRankPosition(toLeague, toDivision);
  
  if (fromPos >= toPos) {
    throw new Error('Destination rank must be higher than origin rank');
  }

  
  // 2. Generar camino de pasos
  const breakdown = [];
  let totalCost = 0;
  
  // 3. Iterar por cada paso
  let currentLeague = null;
  let stepsInCurrentLeague = 0;
  
  for (let step = fromPos + 1; step <= toPos; step++) {
    const stepLeague = getLeagueFromPosition(step);
    
    // Si cambiamos de liga
    if (stepLeague !== currentLeague && currentLeague !== null) {
      // Sumar costo de pasos en liga anterior
      const pricePerStep = leagueBasePrices[currentLeague];
      if (pricePerStep === undefined) {
        throw new Error(`Missing base price for league ${currentLeague}`);
      }
      
      const leagueCost = stepsInCurrentLeague * pricePerStep;
      totalCost += leagueCost;
      breakdown.push({
        type: 'league_steps',
        league: currentLeague,
        steps: stepsInCurrentLeague,
        pricePerStep: pricePerStep,
        cost: leagueCost
      });
      
      // Sumar costo de transición
      const transitionKey = `${currentLeague}->${stepLeague}`;
      const transitionCost = transitionCosts[transitionKey];
      if (transitionCost === undefined) {
        throw new Error(`Missing transition cost for ${transitionKey}`);
      }
      
      totalCost += transitionCost;
      breakdown.push({
        type: 'transition',
        from: currentLeague,
        to: stepLeague,
        cost: transitionCost
      });
      
      // Resetear contador
      stepsInCurrentLeague = 0;
    }
    
    currentLeague = stepLeague;
    stepsInCurrentLeague++;
  }
  
  // 4. Procesar última liga
  const pricePerStep = leagueBasePrices[currentLeague];
  if (pricePerStep === undefined) {
    throw new Error(`Missing base price for league ${currentLeague}`);
  }
  
  const leagueCost = stepsInCurrentLeague * pricePerStep;
  totalCost += leagueCost;
  breakdown.push({
    type: 'league_steps',
    league: currentLeague,
    steps: stepsInCurrentLeague,
    pricePerStep: pricePerStep,
    cost: leagueCost
  });
  
  // 5. Retornar resultado
  return {
    total: parseFloat(totalCost.toFixed(2)),
    breakdown: breakdown
  };
}

/**
 * Valida la configuración bulk
 */
function validateBulkConfig(config) {
  const { leagueBasePrices, transitionCosts } = config;
  const errors = [];
  
  // Validar precios base
  const requiredLeagues = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond'];
  for (const league of requiredLeagues) {
    if (leagueBasePrices[league] === undefined) {
      errors.push(`Missing base price for league ${league}`);
    } else if (leagueBasePrices[league] < 0) {
      errors.push(`Base price for ${league} cannot be negative`);
    }
  }
  
  // Validar costos de transición
  const requiredTransitions = [
    'Iron->Bronze',
    'Bronze->Silver',
    'Silver->Gold',
    'Gold->Platinum',
    'Platinum->Emerald',
    'Emerald->Diamond'
  ];
  
  for (const transition of requiredTransitions) {
    if (transitionCosts[transition] === undefined) {
      errors.push(`Missing transition cost for ${transition}`);
    } else if (transitionCosts[transition] < 0) {
      errors.push(`Transition cost for ${transition} cannot be negative`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

export {
  calculateBoostPrice,
  validateBulkConfig,
  getRankPosition,
  getLeagueFromPosition
};
