import type { FourWingFlightCommand, InterceptPoint, StateSpaceVector16 } from './types.js';

/**
 * DragonflyFlightController: The 4-Wing Independent Business Actuation Layer.
 *
 * Translates trajectory intercept predictions into harmonized, non-conflicting operational commands
 * for the 4 wings of the business: Pricing, Procurement, Liquidity, and Customer Defense.
 *
 * Each wing is actuated independently by its own muscle matrix (mirroring the 4 independently
 * controlled wings of the Dragonfly that allow hover, 360-degree pitch, roll, and upside-down flight).
 */
export class DragonflyFlightController {
  static synthesizeFlightCommands(
    tenantId: string,
    vector: StateSpaceVector16,
    intercept: InterceptPoint,
  ): FourWingFlightCommand {
    const timestamp = new Date().toISOString();

    // WING 1: Dynamic Pricing & Demand Steering (ڈائنامک قیمت اور ڈیمانڈ)
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
    } else if (vector.n11_margin_pressure_index > 0.4) {
      recommendedPriceAdjustment = +2.5;
      promoBudgetMultiplier = 0.9;
      wing1Reason = 'Macro inflation / fuel freight costs squeezing margins. Pass through partial cost inflation to protect profitability.';
    }

    // WING 2: Preemptive Procurement & Supply Chain Interception (اسٹاک و انوینٹری کی پیشگی ترسیل)
    let advanceDays = 0;
    let safetyStockPercent = 15.0;
    let rerouteSuppliers = false;
    let wing2Reason = 'Supply chain lead time within normal parameters.';

    if (vector.n7_freight_friction > 1.2 || vector.n8_supplier_reliability_index < 0.6) {
      advanceDays = 14;
      safetyStockPercent = 35.0;
      rerouteSuppliers = true;
      wing2Reason = 'Global freight friction / geopolitical supply lane disruption detected. Advance replenishment order window.';
    } else if (intercept.projectedStockoutCount > 5) {
      advanceDays = 7;
      safetyStockPercent = 25.0;
      wing2Reason = 'Projected trajectory reaches stockout inflection point within forecast horizon.';
    }

    // WING 3: Working Capital, Liquidity Shield & Forex Hedging (کیش فلو اور لیکویڈیٹی شیلڈ)
    const burnRisk = vector.n9_burn_rate_velocity > 0.4 || vector.n12_liquidity_runway_days < 45;
    let paymentTermExtDays = 0;
    let discountEarlySettlement = false;
    let recommendFxHedging = false;
    let wing3Reason = 'Healthy liquidity runway. Standard capital allocation.';

    if (burnRisk) {
      paymentTermExtDays = 15;
      discountEarlySettlement = true;
      wing3Reason = 'Liquidity valley projected at intercept horizon. Extend payable cycles and accelerate receivables.';
    }

    if (vector.n11_margin_pressure_index > 0.3 || vector.n3_price_elasticity_drift > 0.4) {
      recommendFxHedging = true;
      wing3Reason += (burnRisk ? ' Additionally, ' : '') + 'Foreign exchange volatility and import inflation indicate currency hedging is necessary.';
    }

    // WING 4: Customer Retention, Workforce & Fraud Defense (کسٹمر ریٹینشن اور فراڈ بچاؤ)
    let supportShiftPercent = 0.0;
    let enforceLiveProof = false;
    let proactiveOutreachCount = 0;
    let wing4Reason = 'Normal customer sentiment and return ratios.';

    if (vector.n15_refund_fraud_anomaly > 0.4) {
      enforceLiveProof = true;
      wing4Reason = 'Abnormal return fraud cluster detected. Mandate Verilo-style live camera video verification for all RMA claims.';
    }

    if (vector.n14_support_stress_ratio > 0.6) {
      supportShiftPercent = 25.0;
      proactiveOutreachCount = 50;
      wing4Reason += ' High ticket backlog; shift operational workforce to resolve customer friction points.';
    }

    // Calculate targeting accuracy confidence score (mirroring Dragonfly 95% hunt rate)
    const variancePenalty =
      Math.abs(vector.n1_demand_momentum - 1.0) * 0.04 +
      Math.abs(vector.n7_freight_friction - 1.0) * 0.04;
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
        recommendedFxHedging: recommendFxHedging,
        urgencyReason: wing3Reason.trim(),
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
