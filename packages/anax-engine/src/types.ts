/**
 * NEWAX ANAX Engine (Dragonfly Predictive Intercept Architecture)
 *
 * Implements Sandia National Labs-inspired biological guidance and trajectory interception
 * for enterprise SaaS business operations.
 *
 * Principle: Never chase past lagging events (Pure Pursuit).
 * Calculate the target's trajectory and position operations at the exact intercept point (Proportional Navigation).
 */

export interface InternalTelemetrySignal {
  /** Enterprise tenant ID for multi-tenant isolation */
  tenantId: string;
  organizationId?: string;
  timestamp: string;

  /** Sales & Transaction velocity */
  orderVelocityPerHour: number;
  averageOrderValueMinor: number;
  cartAbandonmentRate: number;

  /** Cash & Capital */
  liquidCashMinor: number;
  expectedInflows7dMinor: number;
  expectedOutflows7dMinor: number;

  /** Inventory & Fulfillment */
  criticalSkuStockoutRiskScore: number; // 0.0 to 1.0
  averageFulfillmentHours: number;
  supplierLeadTimeDays: number;

  /** Customer Experience & Fraud */
  supportTicketBacklog: number;
  refundRequestRate: number;
  liveProofVerificationRate: number; // Percentage of returns verified via live camera
}

export interface WorldMacroSignal {
  timestamp: string;
  /** Regional / Global inflation rate indicator (e.g. 0.12 for 12%) */
  inflationRate: number;
  /** Currency volatility delta (e.g. PKR/USD or EUR/USD drift percentage) */
  fxVolatilityPercent: number;
  /** Shipping & Freight index modifier (e.g. container index baseline = 1.0) */
  freightCostMultiplier: number;
  /** Impending major world/regional calendar event */
  activeCalendarEvent?: {
    name: 'Ramadan' | 'Eid' | 'BlackFriday' | 'CyberMonday' | 'NewYear' | 'TaxYearEnd' | string;
    daysUntilEvent: number;
    demandMultiplierEstimate: number;
  };
  /** Geopolitical / Supply lane disruption severity (0.0 normal, 1.0 severe) */
  supplyDisruptionIndex: number;
}

/**
 * The 16-Neuron State-Space Feature Vector.
 * Encodes the business trajectory in normalized mathematical dimensions for sub-millisecond calculation.
 */
export interface StateSpaceVector16 {
  // Demand Dimension (Neurons 1-4)
  n1_demand_momentum: number;
  n2_demand_acceleration: number;
  n3_price_elasticity_drift: number;
  n4_market_share_velocity: number;

  // Supply & Logistics Dimension (Neurons 5-8)
  n5_lead_time_compression: number;
  n6_stock_depletion_velocity: number;
  n7_freight_friction: number;
  n8_supplier_reliability_index: number;

  // Cash & Liquidity Dimension (Neurons 9-12)
  n9_burn_rate_velocity: number;
  n10_receivable_lag_ratio: number;
  n11_margin_pressure_index: number;
  n12_liquidity_runway_days: number;

  // Workforce & Customer Retention Dimension (Neurons 13-16)
  n13_churn_risk_acceleration: number;
  n14_support_stress_ratio: number;
  n15_refund_fraud_anomaly: number;
  n16_workforce_capacity_utilization: number;
}

export interface InterceptPoint {
  timeHorizonDays: number;
  predictedDemandMinor: number;
  predictedCashPositionMinor: number;
  projectedStockoutCount: number;
  projectedFraudClaimsCount: number;
  closingVelocity: number; // Speed at which the business outcome is approaching
  lineOfSightRate: number; // Rate of trajectory change
}

export interface FourWingFlightCommand {
  tenantId: string;
  calculatedAt: string;
  interceptHorizonDays: number;
  confidenceScore: number; // 0.0 to 1.0 (Targeting accuracy, mirroring dragonfly 95%)

  /** Wing 1: Dynamic Pricing & Demand Steering */
  wing1_pricing: {
    recommendedPriceAdjustmentPercent: number; // e.g., +3.5% or -2.0%
    promotionalBudgetMultiplier: number;
    urgencyReason: string;
  };

  /** Wing 2: Preemptive Procurement & Supply Chain Interception */
  wing2_procurement: {
    advancePurchaseOrdersDays: number; // How many days ahead to place orders before lead time cliff
    recommendedSafetyStockBufferPercent: number;
    recommendedRerouteSuppliers: boolean;
    urgencyReason: string;
  };

  /** Wing 3: Working Capital & Liquidity Shield */
  wing3_liquidity: {
    recommendedCashReserveMinor: number;
    suggestedPaymentTermExtensionDays: number;
    discountEarlySettlementOffer: boolean;
    urgencyReason: string;
  };

  /** Wing 4: Workforce & Customer Defense */
  wing4_workforce: {
    supportCapacityShiftPercent: number; // Shift extra staff to high-friction channels
    enforceLiveProofReturns: boolean; // Mandate live camera capture if fraud anomaly detected
    proactiveOutreachTargetCount: number; // Auto-intervene with at-risk accounts
    urgencyReason: string;
  };
}
