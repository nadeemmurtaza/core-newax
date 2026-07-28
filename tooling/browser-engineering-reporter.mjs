const MAX_BROWSER_TEXT = 4_000;

function cleanText(value, maximum = MAX_BROWSER_TEXT) {
  return String(value ?? '')
    .replaceAll(/\b(api[_-]?key|password|passwd|secret|token)\s*[:=]\s*[^\s,;]+/gi, '$1=<redacted>')
    .slice(0, maximum);
}

function cleanUrl(value) {
  try {
    const url = new URL(String(value));
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeSameOriginEndpoint(value, locationHref) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError('Browser engineering reporter requires a same-origin endpoint.');
  }
  const endpoint = value.trim();
  if (typeof locationHref === 'string' && locationHref.length > 0) {
    const current = new URL(locationHref);
    const candidate = new URL(endpoint, current);
    if (candidate.origin !== current.origin) {
      throw new TypeError('Browser engineering reporter requires a same-origin endpoint.');
    }
    return endpoint;
  }
  if (!endpoint.startsWith('/') || endpoint.startsWith('//') || endpoint.includes('\\')) {
    throw new TypeError('Browser engineering reporter requires a same-origin endpoint.');
  }
  return endpoint;
}

function errorDetails(value) {
  if (value instanceof Error) {
    return {
      summary: cleanText(value.message || value.name),
      details: cleanText(value.stack),
    };
  }
  return {
    summary: cleanText(value),
    details: null,
  };
}

export function createBrowserEngineeringReporter(options = {}) {
  const windowObject = options?.windowObject ?? globalThis.window;
  const endpoint = normalizeSameOriginEndpoint(options?.endpoint, windowObject?.location?.href);
  const fetchImplementation = options?.fetchImplementation ?? globalThis.fetch;
  if (typeof fetchImplementation !== 'function') {
    throw new TypeError('Browser engineering reporter requires fetch.');
  }

  const consoleObject = options?.consoleObject ?? globalThis.console;
  const environment = options.environment ?? 'production';
  const service = options.service ?? 'browser';
  const release = options.release ?? null;
  let originalConsoleError = null;
  let installed = false;
  let reportingConsole = false;

  async function report(input) {
    const payload = {
      schemaVersion: 1,
      sourceType: input.sourceType ?? 'browser-console',
      environment,
      severity: input.severity ?? 'error',
      occurredAt: new Date().toISOString(),
      service,
      component: input.component ?? 'browser',
      operation: input.operation ?? 'Browser runtime failure',
      release,
      traceId: input.traceId ?? null,
      summary: cleanText(input.summary),
      details: cleanText(input.details),
      evidenceUrls: [cleanUrl(input.url ?? windowObject?.location?.href)].filter(Boolean),
    };

    try {
      const response = await fetchImplementation(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      });
      return response?.ok === true;
    } catch {
      return false;
    }
  }

  function onError(event) {
    const details = errorDetails(event?.error ?? event?.message ?? 'Unknown browser error');
    void report({
      sourceType: 'runtime-exception',
      operation: 'window.error',
      summary: details.summary,
      details: details.details,
      url: event?.filename,
    });
  }

  function onUnhandledRejection(event) {
    const details = errorDetails(event?.reason ?? 'Unhandled promise rejection');
    void report({
      sourceType: 'runtime-exception',
      operation: 'window.unhandledrejection',
      summary: details.summary,
      details: details.details,
    });
  }

  function install({ captureConsoleErrors = false } = {}) {
    if (installed) {
      return uninstall;
    }
    installed = true;
    windowObject?.addEventListener?.('error', onError);
    windowObject?.addEventListener?.('unhandledrejection', onUnhandledRejection);

    if (captureConsoleErrors && typeof consoleObject?.error === 'function') {
      originalConsoleError = consoleObject.error.bind(consoleObject);
      consoleObject.error = (...values) => {
        originalConsoleError(...values);
        if (reportingConsole) {
          return;
        }
        reportingConsole = true;
        try {
          void report({
            sourceType: 'browser-console',
            operation: 'console.error',
            summary: values.map((value) => cleanText(value)).join(' '),
          });
        } finally {
          reportingConsole = false;
        }
      };
    }

    return uninstall;
  }

  function uninstall() {
    if (!installed) {
      return;
    }
    installed = false;
    windowObject?.removeEventListener?.('error', onError);
    windowObject?.removeEventListener?.('unhandledrejection', onUnhandledRejection);
    if (originalConsoleError !== null) {
      consoleObject.error = originalConsoleError;
      originalConsoleError = null;
    }
  }

  return { install, report, uninstall };
}
