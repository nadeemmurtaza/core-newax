const DEFAULT_HOSTNAME = '0.0.0.0';
const DEFAULT_PORT = 3001;
const DEFAULT_SEARCH_INDEXING_ENABLED = false;
const DEFAULT_API_INTERNAL_ORIGIN = 'http://127.0.0.1:3000';

export interface WebEnvironment {
  readonly HOSTNAME: string;
  readonly PORT: number;
  readonly SEARCH_INDEXING_ENABLED: boolean;
  readonly API_INTERNAL_ORIGIN: string;
}

export interface WebEnvironmentSource {
  readonly [key: string]: string | undefined;
  readonly HOSTNAME?: string;
  readonly PORT?: string;
  readonly SEARCH_INDEXING_ENABLED?: string;
  readonly API_INTERNAL_ORIGIN?: string;
}

function parseHostname(value: string | undefined): string {
  if (value === undefined) {
    return DEFAULT_HOSTNAME;
  }

  const hostname = value.trim();

  if (hostname.length === 0) {
    throw new Error('HOSTNAME must not be empty.');
  }

  return hostname;
}

function parsePort(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_PORT;
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new Error('PORT must not be empty.');
  }

  const port = Number(normalizedValue);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return port;
}

function parseApiInternalOrigin(value: string | undefined): string {
  const source = value === undefined ? DEFAULT_API_INTERNAL_ORIGIN : value.trim();
  if (source.length === 0) {
    throw new Error('API_INTERNAL_ORIGIN must not be empty.');
  }
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    throw new Error('API_INTERNAL_ORIGIN must be an absolute HTTP or HTTPS URL.');
  }
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.search.length > 0 ||
    url.hash.length > 0
  ) {
    throw new Error(
      'API_INTERNAL_ORIGIN must be an absolute HTTP or HTTPS origin without credentials, query, or fragment.',
    );
  }
  url.pathname = url.pathname.replace(/\/+$/u, '');
  return url.toString().replace(/\/$/u, '');
}

function parseSearchIndexingEnabled(value: string | undefined): boolean {
  if (value === undefined) {
    return DEFAULT_SEARCH_INDEXING_ENABLED;
  }

  const normalizedValue = value.trim();

  if (normalizedValue === 'true') {
    return true;
  }

  if (normalizedValue === 'false') {
    return false;
  }

  throw new Error('SEARCH_INDEXING_ENABLED must be either true or false.');
}

export function readWebEnvironment(source: WebEnvironmentSource = process.env): WebEnvironment {
  return {
    HOSTNAME: parseHostname(source.HOSTNAME),
    PORT: parsePort(source.PORT),
    SEARCH_INDEXING_ENABLED: parseSearchIndexingEnabled(source.SEARCH_INDEXING_ENABLED),
    API_INTERNAL_ORIGIN: parseApiInternalOrigin(source.API_INTERNAL_ORIGIN),
  };
}
