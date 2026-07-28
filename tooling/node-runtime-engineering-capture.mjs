import { deliverExternalFailure } from './deliver-engineering-event.mjs';

function describeError(value) {
  if (value instanceof Error) {
    return {
      summary: value.message || value.name,
      details: value.stack ?? null,
    };
  }
  return {
    summary: String(value),
    details: null,
  };
}

export async function reportNodeRuntimeFailure(error, context = {}, options = {}) {
  const described = describeError(error);
  return deliverExternalFailure(
    {
      sourceType: context.sourceType ?? 'runtime-exception',
      environment: context.environment ?? process.env.ENGINEERING_ENVIRONMENT ?? 'unknown',
      severity: context.severity ?? 'error',
      sourceId: context.sourceId,
      repository: context.repository ?? process.env.GITHUB_REPOSITORY,
      commitSha: context.commitSha ?? process.env.GITHUB_SHA,
      service: context.service ?? process.env.ENGINEERING_SERVICE,
      component: context.component,
      operation: context.operation ?? 'Node.js runtime exception',
      release: context.release ?? process.env.ENGINEERING_RELEASE,
      traceId: context.traceId,
      summary: described.summary,
      details: described.details,
      evidenceUrls: context.evidenceUrls,
    },
    options,
  );
}

export function installNodeRuntimeFailureCapture(context = {}, options = {}) {
  const processObject = options.processObject ?? process;
  let captureInProgress = false;

  const onUncaughtException = (error, origin) => {
    if (captureInProgress) {
      return;
    }
    captureInProgress = true;
    void reportNodeRuntimeFailure(
      error,
      {
        ...context,
        operation: context.operation ?? `Node.js ${origin ?? 'uncaught exception'}`,
      },
      options.deliveryOptions,
    ).finally(() => {
      captureInProgress = false;
    });
  };

  const onUnhandledRejection = (reason) => {
    if (captureInProgress) {
      return;
    }
    captureInProgress = true;
    void reportNodeRuntimeFailure(
      reason,
      {
        ...context,
        operation: context.operation ?? 'Node.js unhandled rejection',
      },
      options.deliveryOptions,
    ).finally(() => {
      captureInProgress = false;
    });
  };

  processObject.on('uncaughtExceptionMonitor', onUncaughtException);
  if (options.captureUnhandledRejections === true) {
    processObject.on('unhandledRejection', onUnhandledRejection);
  }

  return () => {
    processObject.off('uncaughtExceptionMonitor', onUncaughtException);
    if (options.captureUnhandledRejections === true) {
      processObject.off('unhandledRejection', onUnhandledRejection);
    }
  };
}
