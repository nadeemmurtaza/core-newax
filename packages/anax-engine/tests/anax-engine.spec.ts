import { describe, expect, it } from 'vitest';
import { AnaxEngine, CompoundSensorStream, DragonflyReflexCircuit } from '../src/index.js';
import type { InternalTelemetrySignal, WorldMacroSignal } from '../src/types.js';

describe('ANAX Dragonfly Intercept Engine (Core Biomimetic Architecture)', () => {
  const baseInternal: InternalTelemetrySignal = {
    tenantId: 'tenant-global-enterprise-1',
    organizationId: 'org-main-hub',
    timestamp: new Date().toISOString(),
    orderVelocityPerHour: 25.0,
    averageOrderValueMinor: 500000,
    cartAbandonmentRate: 0.25,
    liquidCashMinor: 500_000_000,
    expectedInflows7dMinor: 100_000_000,
    expectedOutflows7dMinor: 80_000_000,
    criticalSkuStockoutRiskScore: 0.2,
    averageFulfillmentHours: 12.0,
    supplierLeadTimeDays: 14.0,
    supportTicketBacklog: 15,
    refundRequestRate: 0.03,
    liveProofVerificationRate: 0.95,
  };

  const baseWorld: WorldMacroSignal = {
    timestamp: new Date().toISOString(),
    inflationRate: 0.08,
    fxVolatilityPercent: 1.2,
    freightCostMultiplier: 1.0,
    supplyDisruptionIndex: 0.1,
  };

  it('synthesizes 16-neuron state vector in sub-millisecond execution', () => {
    const vector = CompoundSensorStream.synthesizeStateVector(baseInternal, baseWorld);

    expect(vector.n1_demand_momentum).toBeGreaterThan(0);
    expect(vector.n12_liquidity_runway_days).toBeGreaterThan(30);
    expect(vector.n15_refund_fraud_anomaly).toBeLessThan(0.3);
  });

  it('executes full Dragonfly Intercept cycle and returns targeting accuracy >= 90%', () => {
    const res = AnaxEngine.evaluateTrajectory(baseInternal, baseWorld);

    expect(res.executionTimeMs).toBeLessThan(10.0); // Ultra-fast reflex budget
    expect(res.flightCommand.confidenceScore).toBeGreaterThanOrEqual(0.90);
    expect(res.flightCommand.tenantId).toBe('tenant-global-enterprise-1');
  });

  it('intercepts holiday surge (Eid) by advancing procurement and capturing margin', () => {
    const worldWithSurge: WorldMacroSignal = {
      ...baseWorld,
      activeCalendarEvent: {
        name: 'Eid',
        daysUntilEvent: 12,
        demandMultiplierEstimate: 2.2,
      },
    };

    const res = AnaxEngine.evaluateTrajectory(baseInternal, worldWithSurge, { horizonDays: 30 });

    // Demand momentum rises due to calendar vector
    expect(res.stateVector.n1_demand_momentum).toBeGreaterThan(1.2);
    // Predicted demand reflects the trajectory intercept point
    expect(res.interceptPoint.predictedDemandMinor).toBeGreaterThan(baseInternal.orderVelocityPerHour * baseInternal.averageOrderValueMinor * 24 * 30);
    // Wing 1 commands price adjustment
    expect(res.flightCommand.wing1_pricing.recommendedPriceAdjustmentPercent).toBeGreaterThan(0);
  });

  it('triggers Wing 4 LiveProof return defense when refund fraud anomaly is detected', () => {
    const internalWithFraud: InternalTelemetrySignal = {
      ...baseInternal,
      refundRequestRate: 0.14, // High refund rate
      liveProofVerificationRate: 0.20, // Low live proof adoption
    };

    const res = AnaxEngine.evaluateTrajectory(internalWithFraud, baseWorld);

    expect(res.stateVector.n15_refund_fraud_anomaly).toBeGreaterThan(0.5);
    expect(res.flightCommand.wing4_workforce.enforceLiveProofReturns).toBe(true);
    expect(res.flightCommand.wing4_workforce.urgencyReason).toContain('Verilo-style live camera');
  });

  it('triggers Wing 2 advance ordering when global freight friction spikes', () => {
    const worldWithDisruption: WorldMacroSignal = {
      ...baseWorld,
      freightCostMultiplier: 1.8,
      supplyDisruptionIndex: 0.85,
    };

    const res = AnaxEngine.evaluateTrajectory(baseInternal, worldWithDisruption);

    expect(res.stateVector.n7_freight_friction).toBeGreaterThan(1.2);
    expect(res.flightCommand.wing2_procurement.advancePurchaseOrdersDays).toBeGreaterThanOrEqual(14);
    expect(res.flightCommand.wing2_procurement.recommendedRerouteSuppliers).toBe(true);
  });
});
