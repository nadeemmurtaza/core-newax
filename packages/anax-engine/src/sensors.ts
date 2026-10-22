import type {
  InternalTelemetrySignal,
  StateSpaceVector16,
  WorldMacroSignal,
} from './types.js';

/**
 * CompoundSensorStream: The 30,000-Ommatidia Multi-Spectral Ingestion Layer.
 * Fuses high-frequency internal operational metrics (POS, Orders, LiveProof, Returns, Cash)
 * with macro world indicators (Oil, Currency, War & Bilateral Tensions, Holidays, Weather).
 */
export class CompoundSensorStream {
  /**
   * Compresses heterogeneous internal operations and external world shocks
   * into a standardized 16-neuron state-space feature vector.
   * Execution budget: < 0.2 milliseconds.
   */
  static synthesizeStateVector(
    internal: InternalTelemetrySignal,
    world: WorldMacroSignal,
  ): StateSpaceVector16 {
    // Extract sub-signals or safe defaults
    const geo = world.geopolitical;
    const fx = world.commoditiesForex;
    const market = world.marketTrades;

    // Calculate Geopolitical War & Chokepoint Friction (0.0 = tranquil, 1.0 = severe global conflict)
    let chokepointSeverity = 0.0;
    if (geo?.chokepoints) {
      const vals = Object.values(geo.chokepoints).filter((v): v is number => typeof v === 'number');
      if (vals.length > 0) {
        chokepointSeverity = Math.max(...vals);
      }
    }
    const warConflictFriction = geo
      ? Math.max(
          geo.bilateralTensionIndex,
          geo.sanctionsSeverityIndex,
          chokepointSeverity,
          geo.freightWarRiskSurchargePercent,
        )
      : world.supplyDisruptionIndex;

    // Calculate Commodity & Energy Shock (Crude Oil drift & Energy tariff)
    const oilSurge = fx?.crudeOilDelta30dPercent
      ? Math.max(0, fx.crudeOilDelta30dPercent / 100)
      : 0.0;
    const energyTariffShock = fx?.energyTariffIndex ? Math.max(0, fx.energyTariffIndex - 1.0) : 0.0;
    const commodityFriction = oilSurge * 0.5 + energyTariffShock * 0.5;

    // Calculate Currency Devaluation Pressure
    const fxDevaluationRisk = fx?.devaluationRiskScore ?? Math.min(1.0, world.fxVolatilityPercent / 100);

    // 1. Demand Dimension (Neurons 1-4)
    const calendarBoost = world.activeCalendarEvent
      ? Math.max(0, (30 - world.activeCalendarEvent.daysUntilEvent) / 30) *
        (world.activeCalendarEvent.demandMultiplierEstimate - 1.0)
      : 0.0;

    const baseVelocity = internal.orderVelocityPerHour / 25.0;
    const competitorDampening = market?.competitorPricingPressure ? market.competitorPricingPressure * 0.2 : 0.0;
    const n1_demand_momentum = Math.min(
      3.0,
      Math.max(0.05, baseVelocity * (1.0 + calendarBoost) - competitorDampening),
    );

    const n2_demand_acceleration = internal.cartAbandonmentRate > 0.4 ? -0.3 : 0.4;
    const n3_price_elasticity_drift = Math.min(
      1.0,
      (world.inflationRate > 0.15 ? 0.6 : 0.1) + fxDevaluationRisk * 0.3,
    );
    const n4_market_share_velocity = Math.min(
      1.0,
      (internal.orderVelocityPerHour * internal.averageOrderValueMinor) / 100_000_000,
    );

    // 2. Supply & Logistics Dimension (Neurons 5-8)
    // When war disrupts sea lanes (Suez, Bab-el-Mandeb), lead times expand
    const warLeadTimeExpansionDays = warConflictFriction * 14.0; // up to 14 days extra maritime delay
    const effectiveLeadTime = (internal.supplierLeadTimeDays || 14.0) + warLeadTimeExpansionDays;
    const n5_lead_time_compression = Math.max(0.05, 14.0 / effectiveLeadTime);

    const n6_stock_depletion_velocity = Math.min(
      1.0,
      internal.criticalSkuStockoutRiskScore * (1.0 + warConflictFriction * 0.5),
    );

    // Freight friction incorporates baseline freight multiplier + war surcharges + oil surge
    const totalFreightCostMultiplier = world.freightCostMultiplier *
      (1.0 + (geo?.freightWarRiskSurchargePercent || 0.0)) *
      (1.0 + commodityFriction);

    const n7_freight_friction = Math.min(
      3.0,
      totalFreightCostMultiplier * (1.0 + warConflictFriction + chokepointSeverity),
    );

    const supplierHealth = market?.supplierHealthIndex ?? 1.0;
    const n8_supplier_reliability_index = Math.max(
      0.0,
      supplierHealth - warConflictFriction * 0.6 - (geo?.sanctionsSeverityIndex || 0.0) * 0.3,
    );

    // 3. Cash & Liquidity Dimension (Neurons 9-12)
    const net7dCash = internal.expectedInflows7dMinor - internal.expectedOutflows7dMinor;
    const n9_burn_rate_velocity =
      net7dCash < 0
        ? Math.min(1.0, Math.abs(net7dCash) / (internal.liquidCashMinor || 1))
        : 0.0;

    const n10_receivable_lag_ratio =
      internal.expectedInflows7dMinor > 0
        ? internal.expectedOutflows7dMinor / internal.expectedInflows7dMinor
        : 1.0;

    // Margin pressure is squeezed by inflation, FX devaluation, and fuel/energy spikes
    const n11_margin_pressure_index = Math.min(
      1.0,
      world.inflationRate + fxDevaluationRisk + commodityFriction * 0.4,
    );

    // Liquidity runway is degraded if foreign currency devalues domestic purchasing power
    const fxRunwayAdjustment = 1.0 - fxDevaluationRisk * 0.25;
    const n12_liquidity_runway_days =
      internal.liquidCashMinor > 0 && internal.expectedOutflows7dMinor > 0
        ? Math.min(
            365,
            (internal.liquidCashMinor / (internal.expectedOutflows7dMinor / 7.0)) * fxRunwayAdjustment,
          )
        : 30;

    // 4. Workforce & Customer Retention Dimension (Neurons 13-16)
    const n13_churn_risk_acceleration = internal.supportTicketBacklog > 50 ? 0.7 : 0.1;
    const n14_support_stress_ratio = Math.min(1.0, internal.supportTicketBacklog / 100.0);

    // LiveProof Return verification directly mitigates refund fraud
    // High refund rate without camera proof creates severe fraud anomaly
    const n15_refund_fraud_anomaly =
      internal.refundRequestRate > 0.08 && internal.liveProofVerificationRate < 0.5
        ? 0.85
        : internal.refundRequestRate > 0.05
          ? 0.45
          : 0.15;

    const n16_workforce_capacity_utilization = Math.min(
      1.0,
      internal.averageFulfillmentHours / 24.0,
    );

    return {
      n1_demand_momentum,
      n2_demand_acceleration,
      n3_price_elasticity_drift,
      n4_market_share_velocity,
      n5_lead_time_compression,
      n6_stock_depletion_velocity,
      n7_freight_friction,
      n8_supplier_reliability_index,
      n9_burn_rate_velocity,
      n10_receivable_lag_ratio,
      n11_margin_pressure_index,
      n12_liquidity_runway_days,
      n13_churn_risk_acceleration,
      n14_support_stress_ratio,
      n15_refund_fraud_anomaly,
      n16_workforce_capacity_utilization,
    };
  }
}
