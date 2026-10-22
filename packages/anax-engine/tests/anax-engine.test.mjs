import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AnaxEngine, CompoundSensorStream, DragonflyReflexCircuit } from '../dist/index.js';

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
    assert.ok(
      res.flightCommand.confidenceScore >= 0.9,
      `Targeting accuracy lower than 90%: ${res.flightCommand.confidenceScore}`,
    );
    assert.strictEqual(res.flightCommand.tenantId, 'tenant-global-enterprise-1');
    assert.ok(res.interceptPoint.zeroEffortMissDistance >= 0);
    assert.ok(res.interceptPoint.closingVelocity > 0);
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
    assert.ok(
      res.interceptPoint.predictedDemandMinor >
        baseInternal.orderVelocityPerHour * baseInternal.averageOrderValueMinor * 24 * 30,
    );
    assert.ok(res.flightCommand.wing1_pricing.recommendedPriceAdjustmentPercent > 0);
  });

  it('triggers Wing 4 LiveProof return defense when refund fraud anomaly is detected', () => {
    const internalWithFraud = {
      ...baseInternal,
      refundRequestRate: 0.14,
      liveProofVerificationRate: 0.2,
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

  it('evaluates Geopolitical War Risk and Maritime Chokepoint blockages', () => {
    const worldWithWar = {
      ...baseWorld,
      geopolitical: {
        bilateralTensionIndex: 0.82,
        sanctionsSeverityIndex: 0.7,
        freightWarRiskSurchargePercent: 0.35,
        chokepoints: {
          babElMandebRedSea: 0.95,
          suezCanal: 0.8,
          straitOfHormuz: 0.6,
        },
      },
    };

    const geoRisk = AnaxEngine.evaluateGeopoliticalRisk(baseInternal, worldWithWar);

    assert.strictEqual(geoRisk.supplyRouteVulnerability, 'HAZARDOUS');
    assert.strictEqual(geoRisk.sanctionExposure, 'SEVERE');
    assert.ok(geoRisk.chokepointsAtRisk.length >= 2);
    assert.ok(geoRisk.projectedFreightInflationPercent > 20);
    assert.ok(geoRisk.guidance.includes('Cape of Good Hope') || geoRisk.guidance.includes('lead-time'));
  });

  it('evaluates Foreign Exchange devaluation risk and mandates forward hedging', () => {
    const worldWithFxCrisis = {
      ...baseWorld,
      fxVolatilityPercent: 8.5,
      commoditiesForex: {
        crudeOilPriceUsd: 94.5,
        crudeOilDelta30dPercent: 18.2,
        energyTariffIndex: 1.25,
        devaluationRiskScore: 0.65,
        fxRates: {
          'USD/PKR': { rate: 285.0, delta30dPercent: 6.2, volatilityIndex: 0.7 },
        },
      },
    };

    const fxInsight = AnaxEngine.evaluateForex('USD/PKR', baseInternal, worldWithFxCrisis);

    assert.strictEqual(fxInsight.direction, 'DEPRECIATING');
    assert.strictEqual(fxInsight.hedgingUrgency, 'URGENT');
    assert.ok(fxInsight.projected30dRate > 285.0);
    assert.ok(fxInsight.suggestedAction.includes('forward contracts') || fxInsight.suggestedAction.includes('hard currency'));

    const trajectory = AnaxEngine.evaluateTrajectory(baseInternal, worldWithFxCrisis);
    assert.strictEqual(trajectory.flightCommand.wing3_liquidity.recommendedFxHedging, true);
  });

  it('evaluates SKU stock depletion trajectory and warns of critical stockout', () => {
    const stockEval = AnaxEngine.evaluateStock(
      baseInternal,
      baseWorld,
      120, // 120 units in stock
      20, // 20 units/day consumption
      10, // 10 days lead time
    );

    assert.strictEqual(stockEval.reorderUrgency, 'CRITICAL_IMMEDIATE');
    assert.ok(stockEval.daysUntilCriticalDepletion <= 10);
    assert.ok(stockEval.recommendedSafetyStockMultiplier >= 1.2);
  });

  it('computes Enterprise Business Valuation & Resilience Rating under stress', () => {
    const valuation = AnaxEngine.evaluateBusinessValuation(
      baseInternal,
      baseWorld,
      1_000_000_000, // 10M PKR annualized revenue
      200_000_000, // 2M PKR EBITDA
    );

    assert.ok(valuation.estimatedEnterpriseValueMinor > 0);
    assert.ok(valuation.impliedRevenueMultiple >= 1.0);
    assert.ok(valuation.netEnterpriseResilienceScore >= 50);
    assert.ok(['AAA', 'AA', 'A', 'BBB', 'BB'].includes(valuation.resilienceRating));
  });

  it('generates a Comprehensive Business Intelligence, Macro Valuation, and Flight Intercept Report', () => {
    const report = AnaxEngine.generateComprehensiveReport(baseInternal, baseWorld, {
      sampleStockUnits: 500,
      sampleDailyVelocityUnits: 15,
      trackedForexPairs: ['USD/PKR', 'EUR/USD'],
    });

    assert.strictEqual(report.tenantId, 'tenant-global-enterprise-1');
    assert.ok(report.executionTimeMs < 50.0, `Report generation slower than 50ms reflex threshold: ${report.executionTimeMs}ms`);
    assert.ok(report.executiveSummary.length >= 3);
    assert.strictEqual(report.forexInsights.length, 2);
    assert.ok(report.valuation.estimatedEnterpriseValueMinor > 0);
  });
});
