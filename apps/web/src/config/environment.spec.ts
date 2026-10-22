import { describe, expect, it } from 'vitest';

import { readWebEnvironment } from './environment';

describe('readWebEnvironment', () => {
  it('applies safe defaults when configuration is absent', () => {
    expect(readWebEnvironment({})).toEqual({
      HOSTNAME: '0.0.0.0',
      PORT: 3001,
      SEARCH_INDEXING_ENABLED: false,
      API_INTERNAL_ORIGIN: 'http://127.0.0.1:3000',
    });
  });

  it('normalizes valid configuration values', () => {
    expect(
      readWebEnvironment({
        HOSTNAME: ' 127.0.0.1 ',
        PORT: ' 4100 ',
        SEARCH_INDEXING_ENABLED: ' true ',
        API_INTERNAL_ORIGIN: ' https://api.internal.example/ ',
      }),
    ).toEqual({
      HOSTNAME: '127.0.0.1',
      PORT: 4100,
      SEARCH_INDEXING_ENABLED: true,
      API_INTERNAL_ORIGIN: 'https://api.internal.example',
    });
  });

  it('rejects an empty hostname', () => {
    expect(() => readWebEnvironment({ HOSTNAME: '   ' })).toThrow('HOSTNAME must not be empty.');
  });

  it.each([
    ['', 'PORT must not be empty.'],
    ['0', 'PORT must be an integer between 1 and 65535.'],
    ['65536', 'PORT must be an integer between 1 and 65535.'],
    ['1.5', 'PORT must be an integer between 1 and 65535.'],
    ['not-a-port', 'PORT must be an integer between 1 and 65535.'],
  ])('rejects invalid port value %j', (invalidPort, expectedMessage) => {
    expect(() => readWebEnvironment({ PORT: invalidPort })).toThrow(expectedMessage);
  });

  it.each(['', 'relative/path', 'ftp://example.com', 'https://user:secret@example.com'])(
    'rejects invalid API origin %j',
    (origin) => {
      expect(() => readWebEnvironment({ API_INTERNAL_ORIGIN: origin })).toThrow(
        /API_INTERNAL_ORIGIN/u,
      );
    },
  );

  it('accepts an explicit false indexing value', () => {
    expect(readWebEnvironment({ SEARCH_INDEXING_ENABLED: 'false' }).SEARCH_INDEXING_ENABLED).toBe(
      false,
    );
  });

  it.each(['', 'TRUE', '1', 'yes'])('rejects invalid indexing value %j', (invalidBoolean) => {
    expect(() => readWebEnvironment({ SEARCH_INDEXING_ENABLED: invalidBoolean })).toThrow(
      'SEARCH_INDEXING_ENABLED must be either true or false.',
    );
  });
});
