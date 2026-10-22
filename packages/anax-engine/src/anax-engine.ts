import { CompoundSensorStream } from './sensors.js';
import { DragonflyReflexCircuit } from './reflex-circuit.js';
import { DragonflyFlightController } from './flight-controller.js';
import type {
  FourWingFlightCommand,
  InterceptPoint,
  InternalTelemetrySignal,
  StateSpaceVector16,
  WorldMacroSignal,
} from './types.js';

export interface AnaxEvaluationResult {
  stateVector: StateSpaceVector16;
  interceptPoint: InterceptPoint;
  flightCommand: FourWingFlightCommand;
  executionTimeMs: number;
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
    const start = performance.now();

    const baselineDemand = options?.baselineDemandMinor ?? internal.orderVelocityPerHour * internal.averageOrderValueMinor * 24 * 30;
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

    const executionTimeMs = performance.now() - start;

    return {
      stateVector,
      interceptPoint,
      flightCommand,
      executionTimeMs,
    };
  }
}
