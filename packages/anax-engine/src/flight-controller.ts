import type { FourWingFlightCommand, InterceptPoint, StateSpaceVector16 } from './types.js';

/**
 * DragonflyFlightController: The 4-Wing Independent Business Actuation Layer.
 *
 * Translates trajectory intercept predictions into harmonized, non-conflicting operational commands
 * for the 4 wings of the business: Pricing, Procurement, Liquidity, and Customer Defense.
 */
export class DragonflyFlightController {
  static synthesizeFlightCommands(
    tenantId: string,
    vector: StateSpaceVector16,
    intercept: InterceptPoint,
  ): FourWingFlightCommand {
    const timestamp = new Date().toISOString();

    // WING 1: Pricing & Demand Steering
    let recommendedPriceAdjustment = 0.0;
    let promoBudgetMultiplier = 1.0;
    let wing1Reason = 'Stable market trajectory. Maintain baseline pricing.';

    if (vector.n1_demand_momentum > 1.3 && vector.n6_stock_depletion_velocity < 0.6) {
      recommendedPriceAdjustment = +4.5;
      promoBudgetMultiplier = 0.8;
      wing1Reason = 'High demand momentum detected. Capture surplus margin without churn.';
    } else if (vector.n2_demand_acceleration < 0 && vector.n6_stock_depletion_velocity > 0.4) {
      recommendedPriceAdjustment = -3.0;
      promoBudgetMultiplier = 1.35;
      wing1Reason = 'Demand deceleration with inventory surplus. Stimulate volume velocity.';
    }

    // WING 2: Procurement & Supply Chain
    let advanceDays = 0;
    let safetyStockPercent = 15.0;
    let rerouteSuppliers = false;
    let wing2Reason = 'Supply chain lead time within normal parameters.';

    if (vector.n7_freight_friction > 1.2 || vector.n8_supplier_reliability_index < 0.6) {
      advanceDays = 14;
      safetyStockPercent = 35.0;
      rerouteSuppliers = true;
      wing2Reason = 'Global freight friction / supply lane disruption detected. Advance replenishment order window.';
    } else if (intercept.projectedStockoutCount > 5) {
      advanceDays = 7;
      safetyStockPercent = 25.0;
      wing2Reason = 'Projected trajectory reaches stockout inflection point within forecast horizon.';
    }

    // WING 3: Working Capital & Liquidity Shield
    const burnRisk = vector.n9_burn_rate_velocity > 0.4 || vector.n12_liquidity_runway_days < 45;
    let paymentTermExtDays = 0;
    let discountEarlySettlement = false;
    let wing3Reason = 'Healthy liquidity runway. Standard capital allocation.';

    if (burnRisk) {
      paymentTermExtDays = 15;
      discountEarlySettlement = true;
      wing3Reason = 'Liquidity valley projected at intercept horizon. Extend payable cycles and accelerate receivables.';
    }

    // WING 4: Retention, Workforce & Fraud Defense
    let supportShiftPercent = 0.0;
    let enforceLiveProof = false;
    let proactiveOutreachCount = 0;
    let wing4Reason = 'Normal customer sentiment and return ratios.';

    if (vector.n15_refund_fraud_anomaly > 0.5) {
      enforceLiveProof = true;
      wing4Reason = 'Abnormal return fraud cluster detected. Mandate Verilo-style live camera video verification for all RMA claims.';
    }

    if (vector.n14_support_stress_ratio > 0.6) {
      supportShiftPercent = 25.0;
      proactiveOutreachCount = 50;
      wing4Reason += ' High ticket backlog; shift operational workforce to resolve customer friction points.';
    }

    // Calculate targeting accuracy confidence score (mirroring Dragonfly 95% hunt rate)
    const variancePenalty = Math.abs(vector.n1_demand_momentum - 1.0) * 0.05 + Math.abs(vector.n7_freight_friction - 1.0) * 0.05;
    const confidenceScore = Math.max(0.85, Math.min(0.98, 0.95 - variancePenalty));

    return {
      tenantId,
      calculatedAt: timestamp,
      interceptHorizonDays: intercept.timeHorizonDays,
      confidenceScore,
      wing1_pricing: {
        recommendedPriceAdjustmentPercent: recommendedPriceAdjustment,
        promotionalBudgetMultiplier: promoBudgetMultiplier,
        urgencyReason: wing1Reason,
      },
      wing2_procurement: {
        advancePurchaseOrdersDays: advanceDays,
        recommendedSafetyStockBufferPercent: safetyStockPercent,
        recommendedRerouteSuppliers: rerouteSuppliers,
        urgencyReason: wing2Reason,
      },
      wing3_liquidity: {
        recommendedCashReserveMinor: Math.round(intercept.predictedCashPositionMinor * 0.2),
        suggestedPaymentTermExtensionDays: paymentTermExtDays,
        discountEarlySettlementOffer: discountEarlySettlement,
        urgencyReason: wing3Reason,
      },
      wing4_workforce: {
        supportCapacityShiftPercent: supportShiftPercent,
        enforceLiveProofReturns: enforceLiveProof,
        proactiveOutreachTargetCount: proactiveOutreachCount,
        urgencyReason: wing4Reason.trim(),
      },
    };
  }
}
