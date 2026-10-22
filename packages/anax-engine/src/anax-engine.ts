import { CompoundSensorStream } from './sensors.js';
import { DragonflyReflexCircuit } from './reflex-circuit.js';
import { DragonflyFlightController } from './flight-controller.js';
import type {
  BusinessValuationInsight,
  ForexPredictionInsight,
  FourWingFlightCommand,
  GeopoliticalRelationshipInsight,
  InterceptPoint,
  InternalTelemetrySignal,
  StateSpaceVector16,
  StockInventoryEvaluation,
  WorldMacroSignal,
} from './types.js';

export interface AnaxEvaluationResult {
  stateVector: StateSpaceVector16;
  interceptPoint: InterceptPoint;
  flightCommand: FourWingFlightCommand;
  executionTimeMs: number;
}

export interface ComprehensiveBusinessIntelligenceReport {
  tenantId: string;
  evaluatedAt: string;
  executionTimeMs: number;
  trajectory: AnaxEvaluationResult;
  valuation: BusinessValuationInsight;
  geopoliticalRisk: GeopoliticalRelationshipInsight;
  stockEvaluation?: StockInventoryEvaluation | undefined;
  forexInsights: ForexPredictionInsight[];
  summaryUrgency: 'CRITICAL_ACTION_REQUIRED' | 'ELEVATED_RISK' | 'OPERATING_STABLE';
  executiveSummary: string[];
}

/**
 * ANAX Engine: The Central Biomimetic Dragonfly Intercept Intelligence Kernel.
 *
 * Provides sub-millisecond, proactive trajectory projection and automated actuation
 * for enterprise SaaS deployments in NEWAX Core.
 */
export class AnaxEngine {
  /**
   * Executes one full Dragonfly Intercept cycle:
   * 1. 30,000-Lens Compound Sensor fusion
   * 2. 16-Neuron State-Space Proportional Navigation Intercept
   * 3. 4-Wing Harmonic Flight Control command synthesis
   */
  static evaluateTrajectory(
    internal: InternalTelemetrySignal,
    world: WorldMacroSignal,
    options?: {
      baselineDemandMinor?: number;
      baselineCashMinor?: number;
      horizonDays?: number;
    },
  ): AnaxEvaluationResult {
    const start = Date.now();

    const baselineDemand =
      options?.baselineDemandMinor ??
      internal.orderVelocityPerHour * internal.averageOrderValueMinor * 24 * 30;
    const baselineCash = options?.baselineCashMinor ?? internal.liquidCashMinor;
    const horizonDays = options?.horizonDays ?? 30;

    // 1. Compound Sensor Stream
    const stateVector = CompoundSensorStream.synthesizeStateVector(internal, world);

    // 2. 16-Neuron Reflex Interception
    const interceptPoint = DragonflyReflexCircuit.calculateIntercept(
      stateVector,
      baselineDemand,
      baselineCash,
      horizonDays,
    );

    // 3. 4-Wing Flight Controller
    const flightCommand = DragonflyFlightController.synthesizeFlightCommands(
      internal.tenantId,
      stateVector,
      interceptPoint,
    );

    const executionTimeMs = Math.max(0.1, Date.now() - start);

    return {
      stateVector,
      interceptPoint,
      flightCommand,
      executionTimeMs,
    };
  }

  /**
   * Evaluates Stock / SKU replenishment trajectory.
   */
  static evaluateStock(
    internal: InternalTelemetrySignal,
    world: WorldMacroSignal,
    stockUnits: number,
    dailyVelocityUnits: number,
    supplierLeadDays: number,
  ): StockInventoryEvaluation {
    const stateVector = CompoundSensorStream.synthesizeStateVector(internal, world);
    return DragonflyReflexCircuit.evaluateStock(
      stateVector,
      stockUnits,
      dailyVelocityUnits,
      supplierLeadDays,
    );
  }

  /**
   * Evaluates Foreign Exchange rates, currency depreciation risk, and forward hedging.
   */
  static evaluateForex(
    pair: string,
    internal: InternalTelemetrySignal,
    world: WorldMacroSignal,
  ): ForexPredictionInsight {
    const stateVector = CompoundSensorStream.synthesizeStateVector(internal, world);
    return DragonflyReflexCircuit.evaluateForex(pair, stateVector, world);
  }

  /**
   * Evaluates Geopolitical War Tension, sea lane chokepoints, and sanctions exposure.
   */
  static evaluateGeopoliticalRisk(
    internal: InternalTelemetrySignal,
    world: WorldMacroSignal,
  ): GeopoliticalRelationshipInsight {
    const stateVector = CompoundSensorStream.synthesizeStateVector(internal, world);
    return DragonflyReflexCircuit.evaluateGeopoliticalRisk(stateVector, world);
  }

  /**
   * Computes Enterprise Business Valuation & Resilience Rating.
   */
  static evaluateBusinessValuation(
    internal: InternalTelemetrySignal,
    world: WorldMacroSignal,
    annualizedRevenueMinor: number,
    annualizedEbitdaMinor: number,
  ): BusinessValuationInsight {
    const stateVector = CompoundSensorStream.synthesizeStateVector(internal, world);
    return DragonflyReflexCircuit.evaluateBusinessValuation(
      internal.tenantId,
      stateVector,
      annualizedRevenueMinor,
      annualizedEbitdaMinor,
      world,
    );
  }

  /**
   * Generates a Comprehensive Business Intelligence, Macro Valuation, and Flight Intercept Report.
   */
  static generateComprehensiveReport(
    internal: InternalTelemetrySignal,
    world: WorldMacroSignal,
    options?: {
      annualizedRevenueMinor?: number;
      annualizedEbitdaMinor?: number;
      sampleStockUnits?: number;
      sampleDailyVelocityUnits?: number;
      trackedForexPairs?: string[];
    },
  ): ComprehensiveBusinessIntelligenceReport {
    const start = Date.now();
    const evaluatedAt = new Date().toISOString();

    const trajectory = this.evaluateTrajectory(internal, world);

    const revenueMinor =
      options?.annualizedRevenueMinor ??
      internal.orderVelocityPerHour * internal.averageOrderValueMinor * 24 * 365;
    const ebitdaMinor = options?.annualizedEbitdaMinor ?? Math.round(revenueMinor * 0.18);

    const valuation = DragonflyReflexCircuit.evaluateBusinessValuation(
      internal.tenantId,
      trajectory.stateVector,
      revenueMinor,
      ebitdaMinor,
      world,
    );

    const geopoliticalRisk = DragonflyReflexCircuit.evaluateGeopoliticalRisk(
      trajectory.stateVector,
      world,
    );

    let stockEvaluation: StockInventoryEvaluation | undefined;
    if (options?.sampleStockUnits !== undefined && options?.sampleDailyVelocityUnits !== undefined) {
      stockEvaluation = DragonflyReflexCircuit.evaluateStock(
        trajectory.stateVector,
        options.sampleStockUnits,
        options.sampleDailyVelocityUnits,
        internal.supplierLeadTimeDays || 14,
      );
    }

    const trackedPairs = options?.trackedForexPairs ?? ['USD/PKR', 'EUR/USD', 'USD/AED'];
    const forexInsights = trackedPairs.map((pair) =>
      DragonflyReflexCircuit.evaluateForex(pair, trajectory.stateVector, world),
    );

    let summaryUrgency: ComprehensiveBusinessIntelligenceReport['summaryUrgency'] = 'OPERATING_STABLE';
    if (
      geopoliticalRisk.supplyRouteVulnerability === 'HAZARDOUS' ||
      trajectory.flightCommand.wing4_workforce.enforceLiveProofReturns ||
      valuation.netEnterpriseResilienceScore < 50
    ) {
      summaryUrgency = 'CRITICAL_ACTION_REQUIRED';
    } else if (
      geopoliticalRisk.supplyRouteVulnerability === 'DISRUPTED' ||
      trajectory.flightCommand.wing2_procurement.advancePurchaseOrdersDays > 7 ||
      forexInsights.some((f) => f.hedgingUrgency === 'URGENT')
    ) {
      summaryUrgency = 'ELEVATED_RISK';
    }

    const executiveSummary: string[] = [
      `Targeting Confidence: ${(trajectory.flightCommand.confidenceScore * 100).toFixed(1)}% (Sandia PN Intercept active).`,
      `Enterprise Valuation: Rs ${(valuation.estimatedEnterpriseValueMinor / 100).toLocaleString()} (Resilience: ${valuation.resilienceRating}).`,
      `Maritime & War Lane Status: ${geopoliticalRisk.supplyRouteVulnerability} (${geopoliticalRisk.chokepointsAtRisk.join(', ') || 'No active chokepoint blocks'}).`,
      `Flight Commands: Pricing (${trajectory.flightCommand.wing1_pricing.recommendedPriceAdjustmentPercent > 0 ? '+' : ''}${trajectory.flightCommand.wing1_pricing.recommendedPriceAdjustmentPercent}%), Procurement (+${trajectory.flightCommand.wing2_procurement.advancePurchaseOrdersDays}d lead buffer), FX Hedging (${trajectory.flightCommand.wing3_liquidity.recommendedFxHedging ? 'REQUIRED' : 'STANDARD'}), LiveProof Returns (${trajectory.flightCommand.wing4_workforce.enforceLiveProofReturns ? 'MANDATORY' : 'OPTIONAL'}).`,
    ];

    const executionTimeMs = Math.max(0.1, Date.now() - start);

    return {
      tenantId: internal.tenantId,
      evaluatedAt,
      executionTimeMs,
      trajectory,
      valuation,
      geopoliticalRisk,
      stockEvaluation,
      forexInsights,
      summaryUrgency,
      executiveSummary,
    };
  }
}
