// Divisions are ordered from lowest to highest (IV is lowest, I is highest)
const RANKS = [
  { name: 'Iron', divisions: ['IV', 'III', 'II', 'I'] },
  { name: 'Bronze', divisions: ['IV', 'III', 'II', 'I'] },
  { name: 'Silver', divisions: ['IV', 'III', 'II', 'I'] },
  { name: 'Gold', divisions: ['IV', 'III', 'II', 'I'] },
  { name: 'Platinum', divisions: ['IV', 'III', 'II', 'I'] },
  { name: 'Emerald', divisions: ['IV', 'III', 'II', 'I'] },
  { name: 'Diamond', divisions: ['IV', 'III', 'II', 'I'] },
  { name: 'Master', divisions: ['I'], usesLP: true },
  { name: 'Grandmaster', divisions: ['I'], usesLP: true },
  { name: 'Challenger', divisions: ['I'], usesLP: true }
];

// Master+ ranks use LP system (each 50 LP = 1 step)
const HIGH_ELO_RANKS = ['Master', 'Grandmaster', 'Challenger'];
const LP_PER_STEP = 50;

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
 * Calcula el precio de un boost considerando precios individuales
 * Soporta tanto divisiones normales como LP para Master+
 */
function calculateBoostPrice(config, fromLeague, fromDivision, toLeague, toDivision, individualPrices = [], fromLP = null, toLP = null) {
  const { leagueBasePrices, transitionCosts, divisionOverrides = {} } = config;
  
  // Verificar si es un boost de Master+
  const isFromHighElo = HIGH_ELO_RANKS.includes(fromLeague);
  const isToHighElo = HIGH_ELO_RANKS.includes(toLeague);
  
  // Si es Master+ a Master+, usar sistema de LP
  if (isFromHighElo && isToHighElo) {
    return calculateHighEloBoostPrice(config, fromLeague, fromLP, toLeague, toLP, individualPrices);
  }
  
  // Si va desde rango normal a Master+
  if (!isFromHighElo && isToHighElo) {
    return calculateMixedBoostPrice(config, fromLeague, fromDivision, toLeague, toLP, individualPrices);
  }
  
  // Boost normal (sin Master+)
  return calculateNormalBoostPrice(config, fromLeague, fromDivision, toLeague, toDivision, individualPrices);
}

/**
 * Calcula precio para boost entre rangos Master+ usando LP
 */
function calculateHighEloBoostPrice(config, fromLeague, fromLP, toLeague, toLP, individualPrices) {
  const { leagueBasePrices } = config;
  const breakdown = [];
  let totalCost = 0;
  
  // Validar LP
  if (fromLP === null || toLP === null) {
    throw new Error('LP values required for Master+ boost');
  }
  
  // Caso 1: Mismo rango (ej: Master 100 LP -> Master 400 LP, Challenger 0 LP -> Challenger 200 LP)
  if (fromLeague === toLeague) {
    // Validar que el LP destino sea mayor
    if (fromLP >= toLP) {
      throw new Error('Destination LP must be higher than origin LP in same league');
    }
    
    const lpDiff = toLP - fromLP;
    const steps = Math.ceil(lpDiff / LP_PER_STEP);
    const pricePerStep = leagueBasePrices[fromLeague] || 0;
    
    if (pricePerStep === 0) {
      throw new Error(`Missing base price for ${fromLeague}`);
    }
    
    const cost = steps * pricePerStep;
    totalCost += cost;
    
    breakdown.push({
      type: 'lp_steps',
      league: fromLeague,
      from_lp: fromLP,
      to_lp: toLP,
      lp_diff: lpDiff,
      steps: steps,
      pricePerStep: pricePerStep,
      cost: cost
    });
  } else {
    // Caso 2: Diferentes rangos Master+ (ej: Master 500 LP -> Grandmaster 200 LP)
    const fromRankIndex = HIGH_ELO_RANKS.indexOf(fromLeague);
    const toRankIndex = HIGH_ELO_RANKS.indexOf(toLeague);
    
    if (toRankIndex < fromRankIndex) {
      throw new Error('Cannot boost to a lower Master+ rank');
    }
    
    // Calcular LP hasta el final del rango actual
    const lpToMaxInFrom = 1000 - fromLP; // Asumimos 1000 LP como "promoción"
    const stepsInFrom = Math.ceil(lpToMaxInFrom / LP_PER_STEP);
    const pricePerStepFrom = leagueBasePrices[fromLeague] || 0;
    
    if (pricePerStepFrom === 0) {
      throw new Error(`Missing base price for ${fromLeague}`);
    }
    
    const costInFrom = stepsInFrom * pricePerStepFrom;
    totalCost += costInFrom;
    
    breakdown.push({
      type: 'lp_steps',
      league: fromLeague,
      from_lp: fromLP,
      to_lp: 1000,
      lp_diff: lpToMaxInFrom,
      steps: stepsInFrom,
      pricePerStep: pricePerStepFrom,
      cost: costInFrom
    });
    
    // Calcular rangos intermedios (si los hay)
    for (let i = fromRankIndex + 1; i < toRankIndex; i++) {
      const intermediateLeague = HIGH_ELO_RANKS[i];
      const stepsInIntermediate = Math.ceil(1000 / LP_PER_STEP); // Todo el rango
      const pricePerStepIntermediate = leagueBasePrices[intermediateLeague] || 0;
      
      if (pricePerStepIntermediate === 0) {
        throw new Error(`Missing base price for ${intermediateLeague}`);
      }
      
      const costInIntermediate = stepsInIntermediate * pricePerStepIntermediate;
      totalCost += costInIntermediate;
      
      breakdown.push({
        type: 'lp_steps',
        league: intermediateLeague,
        from_lp: 0,
        to_lp: 1000,
        lp_diff: 1000,
        steps: stepsInIntermediate,
        pricePerStep: pricePerStepIntermediate,
        cost: costInIntermediate
      });
    }
    
    // Calcular LP en el rango objetivo
    const stepsInTo = Math.ceil(toLP / LP_PER_STEP);
    const pricePerStepTo = leagueBasePrices[toLeague] || 0;
    
    if (pricePerStepTo === 0) {
      throw new Error(`Missing base price for ${toLeague}`);
    }
    
    const costInTo = stepsInTo * pricePerStepTo;
    totalCost += costInTo;
    
    breakdown.push({
      type: 'lp_steps',
      league: toLeague,
      from_lp: 0,
      to_lp: toLP,
      lp_diff: toLP,
      steps: stepsInTo,
      pricePerStep: pricePerStepTo,
      cost: costInTo
    });
  }
  
  return {
    total: parseFloat(totalCost.toFixed(2)),
    breakdown: breakdown
  };
}

/**
 * Calcula precio para boost desde rango normal a Master+
 */
function calculateMixedBoostPrice(config, fromLeague, fromDivision, toLeague, toLP, individualPrices) {
  const { leagueBasePrices, transitionCosts } = config;
  const breakdown = [];
  let totalCost = 0;
  
  // 1. Calcular desde rango actual hasta Master (0 LP)
  const normalBoostResult = calculateNormalBoostPrice(
    config,
    fromLeague,
    fromDivision,
    'Master',
    'I',
    individualPrices
  );
  
  totalCost += normalBoostResult.total;
  breakdown.push(...normalBoostResult.breakdown);
  
  // 2. Si el objetivo es Master con LP específico
  if (toLeague === 'Master' && toLP > 0) {
    const steps = Math.ceil(toLP / LP_PER_STEP);
    const pricePerStep = leagueBasePrices['Master'] || 0;
    
    if (pricePerStep === 0) {
      throw new Error('Missing base price for Master');
    }
    
    const cost = steps * pricePerStep;
    totalCost += cost;
    
    breakdown.push({
      type: 'lp_steps',
      league: 'Master',
      from_lp: 0,
      to_lp: toLP,
      lp_diff: toLP,
      steps: steps,
      pricePerStep: pricePerStep,
      cost: cost
    });
  }
  
  // 3. Si el objetivo es GM o Challenger
  if (toLeague === 'Grandmaster' || toLeague === 'Challenger') {
    // Calcular Master completo (0 -> 1000 LP)
    const stepsInMaster = Math.ceil(1000 / LP_PER_STEP);
    const pricePerStepMaster = leagueBasePrices['Master'] || 0;
    
    if (pricePerStepMaster === 0) {
      throw new Error('Missing base price for Master');
    }
    
    const costInMaster = stepsInMaster * pricePerStepMaster;
    totalCost += costInMaster;
    
    breakdown.push({
      type: 'lp_steps',
      league: 'Master',
      from_lp: 0,
      to_lp: 1000,
      lp_diff: 1000,
      steps: stepsInMaster,
      pricePerStep: pricePerStepMaster,
      cost: costInMaster
    });
    
    // Si es Challenger, agregar GM completo
    if (toLeague === 'Challenger') {
      const stepsInGM = Math.ceil(1000 / LP_PER_STEP);
      const pricePerStepGM = leagueBasePrices['Grandmaster'] || 0;
      
      if (pricePerStepGM === 0) {
        throw new Error('Missing base price for Grandmaster');
      }
      
      const costInGM = stepsInGM * pricePerStepGM;
      totalCost += costInGM;
      
      breakdown.push({
        type: 'lp_steps',
        league: 'Grandmaster',
        from_lp: 0,
        to_lp: 1000,
        lp_diff: 1000,
        steps: stepsInGM,
        pricePerStep: pricePerStepGM,
        cost: costInGM
      });
    }
    
    // Agregar LP en el rango objetivo
    const stepsInTarget = Math.ceil(toLP / LP_PER_STEP);
    const pricePerStepTarget = leagueBasePrices[toLeague] || 0;
    
    if (pricePerStepTarget === 0) {
      throw new Error(`Missing base price for ${toLeague}`);
    }
    
    const costInTarget = stepsInTarget * pricePerStepTarget;
    totalCost += costInTarget;
    
    breakdown.push({
      type: 'lp_steps',
      league: toLeague,
      from_lp: 0,
      to_lp: toLP,
      lp_diff: toLP,
      steps: stepsInTarget,
      pricePerStep: pricePerStepTarget,
      cost: costInTarget
    });
  }
  
  return {
    total: parseFloat(totalCost.toFixed(2)),
    breakdown: breakdown
  };
}

/**
 * Calcula precio para boost normal (sin Master+)
 */
function calculateNormalBoostPrice(config, fromLeague, fromDivision, toLeague, toDivision, individualPrices) {
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
  let currentLeagueStartPos = fromPos + 1;
  
  for (let step = fromPos + 1; step <= toPos; step++) {
    const stepLeague = getLeagueFromPosition(step);
    
    // Si cambiamos de liga
    if (stepLeague !== currentLeague && currentLeague !== null) {
      // Calcular costo de pasos en liga anterior (considerando individuales)
      const leagueCost = calculateLeagueStepsCost(
        currentLeague,
        currentLeagueStartPos,
        step - 1,
        leagueBasePrices[currentLeague],
        individualPrices,
        breakdown
      );
      
      totalCost += leagueCost;
      
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
      currentLeagueStartPos = step;
    }
    
    currentLeague = stepLeague;
    stepsInCurrentLeague++;
  }
  
  // 4. Procesar última liga
  const leagueCost = calculateLeagueStepsCost(
    currentLeague,
    currentLeagueStartPos,
    toPos,
    leagueBasePrices[currentLeague],
    individualPrices,
    breakdown
  );
  
  totalCost += leagueCost;
  
  // 5. Retornar resultado
  return {
    total: parseFloat(totalCost.toFixed(2)),
    breakdown: breakdown
  };
}

/**
 * Calcula el costo de pasos dentro de una liga, considerando precios individuales
 */
function calculateLeagueStepsCost(league, startPos, endPos, pricePerStep, individualPrices, breakdown) {
  if (pricePerStep === undefined) {
    throw new Error(`Missing base price for league ${league}`);
  }
  
  let totalCost = 0;
  let bulkSteps = 0;
  let currentPos = startPos;
  
  // Iterar por cada paso en esta liga
  while (currentPos <= endPos) {
    const fromInfo = getLeagueAndDivisionFromPosition(currentPos - 1);
    const toInfo = getLeagueAndDivisionFromPosition(currentPos);
    
    // Buscar si hay precio individual para este paso específico
    const individualPrice = individualPrices.find(p => 
      p.from_rank === fromInfo.league &&
      p.from_division === fromInfo.division &&
      p.to_rank === toInfo.league &&
      p.to_division === toInfo.division
    );
    
    if (individualPrice) {
      // Si hay pasos bulk acumulados, agregarlos primero
      if (bulkSteps > 0) {
        const bulkCost = bulkSteps * pricePerStep;
        totalCost += bulkCost;
        breakdown.push({
          type: 'league_steps',
          league: league,
          steps: bulkSteps,
          pricePerStep: pricePerStep,
          cost: bulkCost
        });
        bulkSteps = 0;
      }
      
      // Agregar precio individual
      totalCost += individualPrice.price;
      breakdown.push({
        type: 'individual_step',
        from: `${fromInfo.league} ${fromInfo.division}`,
        to: `${toInfo.league} ${toInfo.division}`,
        price: individualPrice.price,
        cost: individualPrice.price
      });
    } else {
      // Acumular paso bulk
      bulkSteps++;
    }
    
    currentPos++;
  }
  
  // Agregar pasos bulk restantes
  if (bulkSteps > 0) {
    const bulkCost = bulkSteps * pricePerStep;
    totalCost += bulkCost;
    breakdown.push({
      type: 'league_steps',
      league: league,
      steps: bulkSteps,
      pricePerStep: pricePerStep,
      cost: bulkCost
    });
  }
  
  return totalCost;
}

/**
 * Obtiene la liga y división de una posición
 */
function getLeagueAndDivisionFromPosition(position) {
  let currentPos = 0;
  
  for (const rank of RANKS) {
    if (position < currentPos + rank.divisions.length) {
      const divIndex = position - currentPos;
      return {
        league: rank.name,
        division: rank.divisions[divIndex]
      };
    }
    currentPos += rank.divisions.length;
  }
  
  throw new Error(`Invalid position ${position}`);
}

/**
 * Valida la configuración bulk
 */
function validateBulkConfig(config) {
  const { leagueBasePrices, transitionCosts } = config;
  const errors = [];
  
  // Validar precios base (incluyendo Master+)
  const requiredLeagues = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Master', 'Grandmaster', 'Challenger'];
  for (const league of requiredLeagues) {
    if (leagueBasePrices[league] === undefined) {
      errors.push(`Missing base price for league ${league}`);
    } else if (leagueBasePrices[league] < 0) {
      errors.push(`Base price for ${league} cannot be negative`);
    }
  }
  
  // Validar costos de transición (solo hasta Diamond, Master+ usa LP)
  const requiredTransitions = [
    'Iron->Bronze',
    'Bronze->Silver',
    'Silver->Gold',
    'Gold->Platinum',
    'Platinum->Emerald',
    'Emerald->Diamond',
    'Diamond->Master'
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
  getLeagueFromPosition,
  getLeagueAndDivisionFromPosition
};
