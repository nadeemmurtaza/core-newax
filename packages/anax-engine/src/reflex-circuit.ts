import type { InterceptPoint, StateSpaceVector16 } from './types.js';

/**
 * DragonflyReflexCircuit: The 16-Neuron Target-Selective Descending Circuit (TSDMNs).
 *
 * Implements Proportional Navigation (PN) guidance law:
 *   a_cmd = N * V_c * (d_lambda / dt)
 *
 * Rather than chasing current numbers (Pure Pursuit), it projects the Line of Sight (LOS)
 * to predict where the business equilibrium will be and intercept it with zero lag.
 */
export class DragonflyReflexCircuit {
  /** Effective navigation gain constant (standard Sandia guidance ratio: 3.5 to 4.5) */
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
    // Closing velocity: Rate at which market pressure is approaching the business horizon
    const demandClosingSpeed = 1.0 + vector.n1_demand_momentum * 0.4 + vector.n2_demand_acceleration * 0.2;
    const supplyFrictionSpeed = vector.n7_freight_friction * 0.3 + (1.0 - vector.n8_supplier_reliability_index) * 0.4;
    const closingVelocity = (demandClosingSpeed + supplyFrictionSpeed) / 2.0;

    // Line-of-sight angular drift (rate of market direction change)
    const lineOfSightRate = (vector.n3_price_elasticity_drift + vector.n11_margin_pressure_index) / 2.0;

    // Proportional Navigation acceleration command
    const pnFactor = this.NAVIGATION_RATIO * closingVelocity * lineOfSightRate;

    // Projected Future Metrics at the Intercept Point
    const demandGrowthMultiplier = Math.max(0.2, 1.0 + (vector.n1_demand_momentum - 1.0) * (horizonDays / 30.0) * closingVelocity);
    const predictedDemandMinor = Math.round(baselineDemandMinor * demandGrowthMultiplier);

    const cashDeltaRate = 1.0 - (vector.n9_burn_rate_velocity * 0.5) - (vector.n11_margin_pressure_index * 0.2);
    const predictedCashPositionMinor = Math.round(baselineCashMinor * Math.max(0.1, cashDeltaRate));

    const projectedStockoutCount = Math.round(vector.n6_stock_depletion_velocity * (horizonDays / 7.0) * (1.0 + pnFactor * 0.1));
    const projectedFraudClaimsCount = Math.round(vector.n15_refund_fraud_anomaly * 25.0 * (horizonDays / 30.0));

    return {
      timeHorizonDays: horizonDays,
      predictedDemandMinor,
      predictedCashPositionMinor,
      projectedStockoutCount,
      projectedFraudClaimsCount,
      closingVelocity,
      lineOfSightRate,
    };
  }
}
