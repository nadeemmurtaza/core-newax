import type { InternalTelemetrySignal, StateSpaceVector16, WorldMacroSignal } from './types.js';

/**
 * CompoundSensorStream: The 30,000-Ommatidia Multi-Spectral Ingestion Layer.
 * Fuses high-frequency internal operational metrics with macro world indicators.
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
    // 1. Demand Dimension (Neurons 1-4)
    const calendarBoost = world.activeCalendarEvent
      ? Math.max(0, (30 - world.activeCalendarEvent.daysUntilEvent) / 30) *
        (world.activeCalendarEvent.demandMultiplierEstimate - 1.0)
      : 0.0;

    const n1_demand_momentum = Math.min(2.5, (internal.orderVelocityPerHour / 25.0) * (1.0 + calendarBoost));
    const n2_demand_acceleration = internal.cartAbandonmentRate > 0.4 ? -0.3 : 0.4;
    const n3_price_elasticity_drift = world.inflationRate > 0.15 ? 0.6 : 0.1;
    const n4_market_share_velocity = Math.min(1.0, internal.orderVelocityPerHour * internal.averageOrderValueMinor / 100_000_000);

    // 2. Supply & Logistics Dimension (Neurons 5-8)
    const n5_lead_time_compression = Math.max(0.1, 14.0 / (internal.supplierLeadTimeDays || 14.0));
    const n6_stock_depletion_velocity = internal.criticalSkuStockoutRiskScore; // 0.0 to 1.0
    const n7_freight_friction = Math.min(2.0, world.freightCostMultiplier * (1.0 + world.supplyDisruptionIndex));
    const n8_supplier_reliability_index = Math.max(0.0, 1.0 - world.supplyDisruptionIndex * 0.7);

    // 3. Cash & Liquidity Dimension (Neurons 9-12)
    const net7dCash = internal.expectedInflows7dMinor - internal.expectedOutflows7dMinor;
    const n9_burn_rate_velocity = net7dCash < 0 ? Math.min(1.0, Math.abs(net7dCash) / (internal.liquidCashMinor || 1)) : 0.0;
    const n10_receivable_lag_ratio = internal.expectedInflows7dMinor > 0 ? internal.expectedOutflows7dMinor / internal.expectedInflows7dMinor : 1.0;
    const n11_margin_pressure_index = Math.min(1.0, world.inflationRate + world.fxVolatilityPercent / 100);
    const n12_liquidity_runway_days = internal.liquidCashMinor > 0 && internal.expectedOutflows7dMinor > 0
      ? Math.min(365, (internal.liquidCashMinor / (internal.expectedOutflows7dMinor / 7.0)))
      : 30;

    // 4. Workforce & Customer Retention Dimension (Neurons 13-16)
    const n13_churn_risk_acceleration = internal.supportTicketBacklog > 50 ? 0.7 : 0.1;
    const n14_support_stress_ratio = Math.min(1.0, internal.supportTicketBacklog / 100.0);
    const n15_refund_fraud_anomaly = internal.refundRequestRate > 0.08 && internal.liveProofVerificationRate < 0.5 ? 0.85 : 0.15;
    const n16_workforce_capacity_utilization = Math.min(1.0, (internal.averageFulfillmentHours / 24.0));

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
