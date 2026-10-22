import type {
  BusinessValuationInsight,
  ForexPredictionInsight,
  GeopoliticalRelationshipInsight,
  InterceptPoint,
  StateSpaceVector16,
  StockInventoryEvaluation,
  WorldMacroSignal,
} from './types.js';

/**
 * DragonflyReflexCircuit: The 16-Neuron Target-Selective Descending Circuit (TSDMNs).
 *
 * Implements Proportional Navigation (PN) guidance law:
 *   a_cmd = N' * V_c * (d_lambda / dt)
 *
 * Rather than chasing current numbers (Pure Pursuit), it projects the Line of Sight (LOS)
 * to predict where the business equilibrium will be and intercept it with zero lag.
 */
export class DragonflyReflexCircuit {
  /** Effective navigation gain constant (Sandia National Labs PN standard: 3.5 to 4.5) */
  private static readonly NAVIGATION_RATIO = 4.0;

  /**
   * Evaluates the 16-neuron state vector and computes the future trajectory intercept point.
   * Execution budget: < 0.1 milliseconds.
   */
  static calculateIntercept(
    vector: StateSpaceVector16,
    baselineDemandMinor: number,
    baselineCashMinor: number,
    horizonDays: number = 30,
  ): InterceptPoint {
    // Closing velocity (V_c): Rate at which market pressure is approaching the business horizon
    const demandClosingSpeed = 1.0 + vector.n1_demand_momentum * 0.4 + vector.n2_demand_acceleration * 0.2;
    const supplyFrictionSpeed =
      vector.n7_freight_friction * 0.3 + (1.0 - vector.n8_supplier_reliability_index) * 0.4;
    const closingVelocity = Math.max(0.1, (demandClosingSpeed + supplyFrictionSpeed) / 2.0);

    // Line-of-sight angular drift (d_lambda / dt): rate of market trajectory rotation
    const lineOfSightRate = (vector.n3_price_elasticity_drift + vector.n11_margin_pressure_index) / 2.0;

    // Proportional Navigation acceleration command (Sandia guidance)
    const pnFactor = this.NAVIGATION_RATIO * closingVelocity * lineOfSightRate;

    // Zero-Effort-Miss (ZEM) calculation: distance by which business misses target if no adjustment made
    const zeroEffortMissDistance = Math.round(
      closingVelocity * lineOfSightRate * horizonDays * 10.0,
    );
    const interceptAngleRad = Math.atan2(lineOfSightRate, closingVelocity);

    // Projected Future Metrics at the Intercept Point
    const demandGrowthMultiplier = Math.max(
      0.2,
      1.0 + (vector.n1_demand_momentum - 1.0) * (horizonDays / 30.0) * closingVelocity,
    );
    const predictedDemandMinor = Math.round(baselineDemandMinor * demandGrowthMultiplier);

    const cashDeltaRate =
      1.0 - vector.n9_burn_rate_velocity * 0.5 - vector.n11_margin_pressure_index * 0.2;
    const predictedCashPositionMinor = Math.round(
      baselineCashMinor * Math.max(0.1, cashDeltaRate),
    );

    const projectedStockoutCount = Math.round(
      vector.n6_stock_depletion_velocity * (horizonDays / 7.0) * (1.0 + pnFactor * 0.1),
    );
    const projectedFraudClaimsCount = Math.round(
      vector.n15_refund_fraud_anomaly * 25.0 * (horizonDays / 30.0),
    );

    return {
      timeHorizonDays: horizonDays,
      predictedDemandMinor,
      predictedCashPositionMinor,
      projectedStockoutCount,
      projectedFraudClaimsCount,
      closingVelocity,
      lineOfSightRate,
      zeroEffortMissDistance,
      interceptAngleRad,
    };
  }

  /**
   * Evaluates Stock & SKU Inventory Trajectory under current operational & geopolitical friction.
   */
  static evaluateStock(
    vector: StateSpaceVector16,
    currentStockUnits: number,
    dailyVelocityUnits: number,
    supplierLeadDays: number,
  ): StockInventoryEvaluation {
    const adjustedDailyVelocity = dailyVelocityUnits * Math.max(0.5, vector.n1_demand_momentum);
    const daysUntilDepletion =
      adjustedDailyVelocity > 0 ? Math.round(currentStockUnits / adjustedDailyVelocity) : 999;

    // Freight friction expands supplier lead time buffer
    const warBufferDays = Math.round(vector.n7_freight_friction * 7.0);
    const effectiveLeadTime = supplierLeadDays + warBufferDays;

    let urgency: StockInventoryEvaluation['reorderUrgency'] = 'BALANCED';
    let safetyStockMultiplier = 1.0;
    let advice = 'Inventory velocity matches replenishment cadence.';

    if (daysUntilDepletion <= effectiveLeadTime) {
      urgency = 'CRITICAL_IMMEDIATE';
      safetyStockMultiplier = 1.5;
      advice = `Depletion horizon (${daysUntilDepletion}d) is inside lead time + war shipping buffer (${effectiveLeadTime}d). Trigger emergency purchase orders immediately.`;
    } else if (daysUntilDepletion <= effectiveLeadTime * 1.5) {
      urgency = 'ELEVATED';
      safetyStockMultiplier = 1.25;
      advice = `Stock buffer tightening. Preemptively place replenishment orders before freight lane congests.`;
    } else if (daysUntilDepletion > effectiveLeadTime * 3) {
      urgency = 'SURPLUS';
      safetyStockMultiplier = 0.8;
      advice = `Stock levels high (${daysUntilDepletion}d). Throttle upcoming procurement to conserve liquid cash.`;
    }

    return {
      stockoutRiskScore: Math.min(1.0, vector.n6_stock_depletion_velocity * (effectiveLeadTime / Math.max(1, daysUntilDepletion))),
      daysUntilCriticalDepletion: daysUntilDepletion,
      warSupplyFrictionBufferDays: warBufferDays,
      reorderUrgency: urgency,
      recommendedSafetyStockMultiplier: safetyStockMultiplier,
      mitigationAdvice: advice,
    };
  }

  /**
   * Evaluates Foreign Exchange trajectory, currency depreciation risk, and hedging urgency.
   */
  static evaluateForex(
    pair: string,
    vector: StateSpaceVector16,
    world: WorldMacroSignal,
  ): ForexPredictionInsight {
    const fxData = world.commoditiesForex?.fxRates?.[pair];
    const currentRate = fxData?.rate ?? 1.0;
    const delta30d = fxData?.delta30dPercent ?? (world.fxVolatilityPercent || 0.0);
    const devaluationRisk = world.commoditiesForex?.devaluationRiskScore ?? Math.min(1.0, world.fxVolatilityPercent / 100.0);

    // Predict 30d and 90d rate drift using state vector margin pressure (n11) and price drift (n3)
    const driftFactor = 1.0 + (delta30d / 100.0) * (1.0 + vector.n11_margin_pressure_index);
    const projected30dRate = Number((currentRate * driftFactor).toFixed(4));
    const projected90dRate = Number((currentRate * Math.pow(driftFactor, 2.5)).toFixed(4));

    let direction: ForexPredictionInsight['direction'] = 'RANGEBOUND';
    if (delta30d > 2.0) direction = 'DEPRECIATING';
    else if (delta30d < -2.0) direction = 'APPRECIATING';

    let urgency: ForexPredictionInsight['hedgingUrgency'] = 'UNNECESSARY';
    let suggestedAction = 'FX spread within normal variance. Spot transactions sufficient.';

    if (devaluationRisk > 0.4 || Math.abs(delta30d) > 5.0) {
      urgency = 'URGENT';
      suggestedAction = `Severe currency volatility detected for ${pair} (risk: ${(devaluationRisk * 100).toFixed(0)}%). Lock forward contracts or peg supplier contracts to hard currency.`;
    } else if (devaluationRisk > 0.2 || Math.abs(delta30d) > 2.5) {
      urgency = 'MONITOR';
      suggestedAction = `Moderate currency depreciation drift in progress. Review landed import costs weekly.`;
    }

    return {
      pair,
      currentRate,
      projected30dRate,
      projected90dRate,
      depreciationRiskScore: devaluationRisk,
      direction,
      hedgingUrgency: urgency,
      suggestedAction,
    };
  }

  /**
   * Evaluates Geopolitical War Tension, Maritime Chokepoint Vulnerability, and Sanctions Impact.
   */
  static evaluateGeopoliticalRisk(
    vector: StateSpaceVector16,
    world: WorldMacroSignal,
  ): GeopoliticalRelationshipInsight {
    const geo = world.geopolitical;
    const activeRisk = geo ? Math.max(geo.bilateralTensionIndex, geo.sanctionsSeverityIndex) : world.supplyDisruptionIndex;

    const atRiskChokepoints: string[] = [];
    if (geo?.chokepoints) {
      for (const [name, score] of Object.entries(geo.chokepoints)) {
        if (typeof score === 'number' && score > 0.3) {
          atRiskChokepoints.push(`${name} (${(score * 100).toFixed(0)}% disruption)`);
        }
      }
    }

    let routeVulnerability: GeopoliticalRelationshipInsight['supplyRouteVulnerability'] = 'SAFE';
    if (activeRisk > 0.7 || atRiskChokepoints.length >= 2) {
      routeVulnerability = 'HAZARDOUS';
    } else if (activeRisk > 0.4 || atRiskChokepoints.length >= 1) {
      routeVulnerability = 'DISRUPTED';
    } else if (vector.n7_freight_friction > 1.2) {
      routeVulnerability = 'CONGESTED';
    }

    const sanctionExposure: GeopoliticalRelationshipInsight['sanctionExposure'] =
      (geo?.sanctionsSeverityIndex || 0) > 0.6
        ? 'SEVERE'
        : (geo?.sanctionsSeverityIndex || 0) > 0.2
          ? 'MODERATE'
          : 'NONE';

    const projectedFreightInflation = Math.round(
      (vector.n7_freight_friction - 1.0) * 40.0 + (geo?.freightWarRiskSurchargePercent || 0) * 100.0,
    );

    let guidance = 'International maritime transit channels functioning normally.';
    if (routeVulnerability === 'HAZARDOUS' || routeVulnerability === 'DISRUPTED') {
      guidance = `Critical maritime lanes compromised (${atRiskChokepoints.join(', ') || 'War zones'}). Re-route via Cape of Good Hope or overland freight corridors; adjust supplier lead-time buffers +14 days.`;
    }

    return {
      activeConflictRisk: activeRisk,
      chokepointsAtRisk: atRiskChokepoints,
      sanctionExposure,
      supplyRouteVulnerability: routeVulnerability,
      projectedFreightInflationPercent: Math.max(0, projectedFreightInflation),
      guidance,
    };
  }

  /**
   * Computes Enterprise Business Valuation & Resilience Rating under multi-factor macro stress.
   */
  static evaluateBusinessValuation(
    tenantId: string,
    vector: StateSpaceVector16,
    annualizedRevenueMinor: number,
    annualizedEbitdaMinor: number,
    world: WorldMacroSignal,
  ): BusinessValuationInsight {
    const timestamp = new Date().toISOString();

    // Baseline multiples for modern tech-enabled retail / enterprise ERP SaaS
    let revenueMultiple = 3.5;
    let ebitdaMultiple = 12.0;

    // Adjust multiples for operational velocity
    if (vector.n1_demand_momentum > 1.2) {
      revenueMultiple += 0.5;
      ebitdaMultiple += 1.5;
    }
    if (vector.n12_liquidity_runway_days < 60) {
      revenueMultiple -= 0.5;
      ebitdaMultiple -= 2.0;
    }

    // Geopolitical and war tension discount
    const geoRisk = world.geopolitical?.bilateralTensionIndex ?? world.supplyDisruptionIndex;
    const warDiscountPercent = Math.round(geoRisk * 20.0); // Up to 20% discount during major geopolitical war

    // Currency devaluation discount
    const fxRisk = world.commoditiesForex?.devaluationRiskScore ?? (world.fxVolatilityPercent / 100.0);
    const fxDiscountPercent = Math.round(fxRisk * 15.0); // Up to 15% discount for unhedged FX exposure

    const netDiscount = (100 - warDiscountPercent - fxDiscountPercent) / 100.0;
    const adjustedRevenueMultiple = Math.max(1.0, revenueMultiple * netDiscount);
    const adjustedEbitdaMultiple = Math.max(4.0, ebitdaMultiple * netDiscount);

    // Blended Enterprise Value: 50% revenue multiple + 50% EBITDA multiple (or revenue-driven if EBITDA negative)
    let estimatedEnterpriseValueMinor = 0;
    if (annualizedEbitdaMinor > 0) {
      estimatedEnterpriseValueMinor = Math.round(
        (annualizedRevenueMinor * adjustedRevenueMultiple +
          annualizedEbitdaMinor * adjustedEbitdaMultiple) /
          2.0,
      );
    } else {
      estimatedEnterpriseValueMinor = Math.round(annualizedRevenueMinor * adjustedRevenueMultiple);
    }

    // Resilience score (0-100)
    let resilienceScore = 100;
    resilienceScore -= vector.n9_burn_rate_velocity * 25.0;
    resilienceScore -= (1.0 - vector.n8_supplier_reliability_index) * 20.0;
    resilienceScore -= warDiscountPercent * 0.75;
    resilienceScore -= fxDiscountPercent * 0.75;
    resilienceScore -= vector.n15_refund_fraud_anomaly * 15.0;
    const netResilience = Math.max(10, Math.min(100, Math.round(resilienceScore)));

    let rating: BusinessValuationInsight['resilienceRating'] = 'BBB';
    if (netResilience >= 90) rating = 'AAA';
    else if (netResilience >= 80) rating = 'AA';
    else if (netResilience >= 70) rating = 'A';
    else if (netResilience >= 60) rating = 'BBB';
    else if (netResilience >= 50) rating = 'BB';
    else if (netResilience >= 40) rating = 'B';
    else rating = 'CCC';

    const recommendations: string[] = [];
    if (warDiscountPercent > 5) {
      recommendations.push(
        `Diversify maritime supply lanes to recover ${warDiscountPercent}% geopolitical enterprise valuation discount.`,
      );
    }
    if (fxDiscountPercent > 5) {
      recommendations.push(
        `Execute currency forward hedging on foreign-denominated procurement to neutralize ${fxDiscountPercent}% FX valuation penalty.`,
      );
    }
    if (vector.n15_refund_fraud_anomaly > 0.4) {
      recommendations.push(
        `Mandate Verilo-style LiveProof video verification on return claims to eliminate fraud leakage.`,
      );
    }
    if (vector.n12_liquidity_runway_days < 90) {
      recommendations.push(
        `Accelerate receivables collections (Wing 3 Liquidity Shield) to expand cash runway above 90 days.`,
      );
    }
    if (recommendations.length === 0) {
      recommendations.push('Strong balance sheet and stable market intercept trajectory. Maintain current growth vector.');
    }

    return {
      tenantId,
      calculatedAt: timestamp,
      estimatedEnterpriseValueMinor,
      annualizedRevenueMinor,
      projectedEbitdaMinor: annualizedEbitdaMinor,
      impliedRevenueMultiple: Number(adjustedRevenueMultiple.toFixed(2)),
      impliedEbitdaMultiple: Number(adjustedEbitdaMultiple.toFixed(2)),
      geopoliticalWarDiscountPercent: warDiscountPercent,
      forexDevaluationDiscountPercent: fxDiscountPercent,
      netEnterpriseResilienceScore: netResilience,
      resilienceRating: rating,
      strategicRecommendations: recommendations,
    };
  }
}
