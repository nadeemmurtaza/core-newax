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

  /** Sales & Transaction velocity (POS & Web) */
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

export interface GeopoliticalWarSignal {
  /** Active conflict or war zones with trade impact */
  activeConflictZones?: Array<{
    zone: string;
    severity: number; // 0.0 to 1.0
    tradeImpact: 'low' | 'medium' | 'high' | 'critical';
  }>;
  /** Sea and maritime chokepoint blockages / risks (0.0 = clear, 1.0 = impassable) */
  chokepoints?: {
    suezCanal?: number;
    babElMandebRedSea?: number;
    straitOfHormuz?: number;
    malaccaStrait?: number;
    panamaCanal?: number;
    blackSea?: number;
  };
  /** Bilateral tension between key trading partners (0.0 = friendly, 1.0 = hostilities/embargo) */
  bilateralTensionIndex: number;
  /** Sanctions and export control severity (0.0 to 1.0) */
  sanctionsSeverityIndex: number;
  /** War risk shipping insurance surcharge percentage (e.g. 0.25 = 25% premium) */
  freightWarRiskSurchargePercent: number;
}

export interface CommodityForexSignal {
  /** Crude oil price in USD (Brent or WTI benchmark) */
  crudeOilPriceUsd: number;
  /** 30-day percentage drift in crude oil price */
  crudeOilDelta30dPercent: number;
  /** Energy and utility tariff shock multiplier (baseline = 1.0) */
  energyTariffIndex: number;
  /** Exchange rates dictionary (e.g. USD/PKR, EUR/USD, AED/USD, CNY/USD) */
  fxRates: Record<
    string,
    {
      rate: number;
      delta30dPercent: number;
      volatilityIndex: number;
    }
  >;
  /** Foreign exchange devaluation risk score (0.0 to 1.0) */
  devaluationRiskScore: number;
}

export interface MarketTradesAndEquitiesSignal {
  /** Aggregate market trade velocity / liquidity index (baseline = 1.0) */
  marketTradeVolumeIndex: number;
  /** Sector equity momentum and peer valuations */
  sectorEquityMomentum: number;
  /** Key supplier financial solvency index (1.0 = solvent, 0.0 = distressed) */
  supplierHealthIndex: number;
  /** Competitor pricing aggression and discount pressure (0.0 to 1.0) */
  competitorPricingPressure: number;
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

  /** Advanced Geopolitical and War Tension Sub-System */
  geopolitical?: GeopoliticalWarSignal;

  /** Advanced Commodity and Foreign Exchange Sub-System */
  commoditiesForex?: CommodityForexSignal;

  /** Advanced Market Equities and Trades Sub-System */
  marketTrades?: MarketTradesAndEquitiesSignal;
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
  zeroEffortMissDistance: number; // Projected miss if no flight correction applied
  interceptAngleRad: number; // Commanded trajectory angle
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
    recommendedFxHedging: boolean;
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

/**
 * Enterprise Business Insights and Multi-Factor Evaluations produced by ANAX
 */
export interface BusinessValuationInsight {
  tenantId: string;
  calculatedAt: string;
  estimatedEnterpriseValueMinor: number;
  annualizedRevenueMinor: number;
  projectedEbitdaMinor: number;
  impliedRevenueMultiple: number;
  impliedEbitdaMultiple: number;
  geopoliticalWarDiscountPercent: number;
  forexDevaluationDiscountPercent: number;
  netEnterpriseResilienceScore: number; // 0.0 to 100.0
  resilienceRating: 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC';
  strategicRecommendations: string[];
}

export interface StockInventoryEvaluation {
  stockoutRiskScore: number; // 0.0 to 1.0
  daysUntilCriticalDepletion: number;
  warSupplyFrictionBufferDays: number;
  reorderUrgency: 'CRITICAL_IMMEDIATE' | 'ELEVATED' | 'BALANCED' | 'SURPLUS';
  recommendedSafetyStockMultiplier: number;
  mitigationAdvice: string;
}

export interface ForexPredictionInsight {
  pair: string;
  currentRate: number;
  projected30dRate: number;
  projected90dRate: number;
  depreciationRiskScore: number; // 0.0 to 1.0
  direction: 'APPRECIATING' | 'DEPRECIATING' | 'RANGEBOUND';
  hedgingUrgency: 'URGENT' | 'MONITOR' | 'UNNECESSARY';
  suggestedAction: string;
}

export interface GeopoliticalRelationshipInsight {
  activeConflictRisk: number; // 0.0 to 1.0
  chokepointsAtRisk: string[];
  sanctionExposure: 'NONE' | 'MODERATE' | 'SEVERE';
  supplyRouteVulnerability: 'SAFE' | 'CONGESTED' | 'DISRUPTED' | 'HAZARDOUS';
  projectedFreightInflationPercent: number;
  guidance: string;
}
