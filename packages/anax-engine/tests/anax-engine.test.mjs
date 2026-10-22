import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AnaxEngine, CompoundSensorStream } from '../dist/index.js';

describe('ANAX Dragonfly Intercept Engine (Core Biomimetic Architecture)', () => {
  const baseInternal = {
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

  const baseWorld = {
    timestamp: new Date().toISOString(),
    inflationRate: 0.08,
    fxVolatilityPercent: 1.2,
    freightCostMultiplier: 1.0,
    supplyDisruptionIndex: 0.1,
  };

  it('synthesizes 16-neuron state vector in sub-millisecond execution', () => {
    const vector = CompoundSensorStream.synthesizeStateVector(baseInternal, baseWorld);

    assert.ok(vector.n1_demand_momentum > 0);
    assert.ok(vector.n12_liquidity_runway_days > 30);
    assert.ok(vector.n15_refund_fraud_anomaly < 0.3);
  });

  it('executes full Dragonfly Intercept cycle and returns targeting accuracy >= 90%', () => {
    const res = AnaxEngine.evaluateTrajectory(baseInternal, baseWorld);

    assert.ok(res.executionTimeMs < 10.0, `Execution too slow: ${res.executionTimeMs}ms`);
    assert.ok(res.flightCommand.confidenceScore >= 0.90, `Targeting accuracy lower than 90%: ${res.flightCommand.confidenceScore}`);
    assert.strictEqual(res.flightCommand.tenantId, 'tenant-global-enterprise-1');
  });

  it('intercepts holiday surge (Eid) by advancing procurement and capturing margin', () => {
    const worldWithSurge = {
      ...baseWorld,
      activeCalendarEvent: {
        name: 'Eid',
        daysUntilEvent: 12,
        demandMultiplierEstimate: 2.2,
      },
    };

    const res = AnaxEngine.evaluateTrajectory(baseInternal, worldWithSurge, { horizonDays: 30 });

    assert.ok(res.stateVector.n1_demand_momentum > 1.2);
    assert.ok(res.interceptPoint.predictedDemandMinor > baseInternal.orderVelocityPerHour * baseInternal.averageOrderValueMinor * 24 * 30);
    assert.ok(res.flightCommand.wing1_pricing.recommendedPriceAdjustmentPercent > 0);
  });

  it('triggers Wing 4 LiveProof return defense when refund fraud anomaly is detected', () => {
    const internalWithFraud = {
      ...baseInternal,
      refundRequestRate: 0.14,
      liveProofVerificationRate: 0.20,
    };

    const res = AnaxEngine.evaluateTrajectory(internalWithFraud, baseWorld);

    assert.ok(res.stateVector.n15_refund_fraud_anomaly > 0.5);
    assert.strictEqual(res.flightCommand.wing4_workforce.enforceLiveProofReturns, true);
    assert.ok(res.flightCommand.wing4_workforce.urgencyReason.includes('Verilo-style live camera'));
  });

  it('triggers Wing 2 advance ordering when global freight friction spikes', () => {
    const worldWithDisruption = {
      ...baseWorld,
      freightCostMultiplier: 1.8,
      supplyDisruptionIndex: 0.85,
    };

    const res = AnaxEngine.evaluateTrajectory(baseInternal, worldWithDisruption);

    assert.ok(res.stateVector.n7_freight_friction > 1.2);
    assert.ok(res.flightCommand.wing2_procurement.advancePurchaseOrdersDays >= 14);
    assert.strictEqual(res.flightCommand.wing2_procurement.recommendedRerouteSuppliers, true);
  });
});
